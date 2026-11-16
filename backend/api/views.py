import csv
import io
from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.contrib.admin.models import LogEntry
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .audit import audit
from .filters import AthleteFilter, birthday_cutoff
from .models import Athlete, Club, Event, Transfer
from .pagination import ScoutPagination
from .permissions import RoleWritePermission, StaffPermission
from .serializers import (
    AthleteSerializer,
    ClubSerializer,
    EventSerializer,
    RegisterSerializer,
    TransferSerializer,
    UserSerializer,
)
from .services import (
    approved_status_value,
    decide_transfer,
)
from .utils import calc_age, fix_mojibake, normalize_choice


def _clean(value):
    return fix_mojibake(value) if isinstance(value, str) else value


def _clean_status(value):
    return fix_mojibake(str(value))


def _next_birthday(birth_date, today):
    month, day = birth_date.month, birth_date.day
    candidate = birthday_cutoff(today.year, month, day)
    if candidate < today:
        candidate = birthday_cutoff(today.year + 1, month, day)
    return candidate


def _age_group(age):
    if age < 18:
        return "U18"
    if age < 21:
        return "U21"
    if age < 23:
        return "U23"
    return "Взрослые"


def _valuation(athlete):
    age = calc_age(athlete.birth_date)
    if age < 19:
        age_factor = 0.8
    elif age <= 23:
        age_factor = 1.3
    elif age <= 28:
        age_factor = 1.5
    elif age <= 32:
        age_factor = 1.0
    else:
        age_factor = 0.5
    injured = _clean_status(athlete.status) == "Травма"
    injury_factor = 0.6 if injured else 1.0
    achievement_count = len(athlete.achievements or [])
    achievement_factor = 1 + min(achievement_count, 10) * 0.05
    base = settings.ATHLETE_VALUE_BASE
    value = round(base * age_factor * injury_factor * achievement_factor, 2)
    return {
        "value": value,
        "currency": "KZT",
        "breakdown": {
            "base": base,
            "age": age,
            "age_factor": age_factor,
            "injury_factor": injury_factor,
            "achievement_count": achievement_count,
            "achievement_factor": achievement_factor,
        },
        "disclaimer": "Расчётная оценка для справки, не является предложением о сделке.",
    }


def _quality_report():
    athletes = list(Athlete.objects.select_related("club").all())
    names = defaultdict(list)
    numbers = defaultdict(list)
    for athlete in athletes:
        names[(athlete.full_name.casefold(), athlete.birth_date)].append(athlete.pk)
        if athlete.club_id and athlete.number:
            numbers[(athlete.club_id, athlete.number)].append(athlete.pk)
    blocks = {
        "duplicate_athletes": sorted({pk for ids in names.values() if len(ids) > 1 for pk in ids}),
        "duplicate_numbers": sorted({pk for ids in numbers.values() if len(ids) > 1 for pk in ids}),
        "without_club": [athlete.pk for athlete in athletes if not athlete.club_id],
        "without_photo": [athlete.pk for athlete in athletes if not athlete.photo_url],
        "invalid_height_weight": [
            athlete.pk for athlete in athletes
            if not 120 <= athlete.height <= 240 or not 30 <= athlete.weight <= 200
        ],
        "future_birth_date": [athlete.pk for athlete in athletes if athlete.birth_date > date.today()],
        "mojibake": [
            athlete.pk for athlete in athletes
            if any(
                fix_mojibake(value) != value
                for value in (
                    athlete.first_name,
                    athlete.last_name,
                    athlete.middle_name,
                    athlete.sport,
                    athlete.position,
                    athlete.status,
                    athlete.medical_notes,
                    athlete.club.name if athlete.club_id else "",
                    *(athlete.achievements or []),
                )
            )
        ],
    }
    total_issues = sum(len(ids) for ids in blocks.values())
    denominator = max(len(athletes), 1)
    score = max(0, min(100, round(100 - (total_issues / denominator * 100))))
    return {
        "quality_score": score,
        "total_athletes": len(athletes),
        "blocks": {
            key: {"count": len(ids), "ids": ids[:20]}
            for key, ids in blocks.items()
        },
    }


def _can_decide(user):
    return user.is_staff or user.is_superuser or user.groups.filter(name="manager").exists()


class RegisterView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=RegisterSerializer, responses={201: UserSerializer})
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user, context={"request": request}).data, status=status.HTTP_201_CREATED)


class ProfileView(APIView):
    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)

    @extend_schema(request=UserSerializer, responses=UserSerializer)
    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user, context={"request": request}).data)


class PasswordChangeView(APIView):
    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        old_password = request.data.get("old_password", "")
        new_password = request.data.get("new_password", "")
        if not request.user.check_password(old_password):
            return Response({"old_password": ["Текущий пароль указан неверно."]}, status=400)
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            validate_password(new_password, request.user)
        except DjangoValidationError as exc:
            raise ValidationError({"new_password": exc.messages}) from exc
        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])
        return Response({"detail": "Пароль успешно обновлён."})


@extend_schema_view(list=extend_schema(description="База спортсменов."))
class AthleteViewSet(viewsets.ModelViewSet):
    permission_classes = [RoleWritePermission]
    write_roles = ("manager", "medic")
    serializer_class = AthleteSerializer
    queryset = Athlete.objects.select_related("club").prefetch_related(
        "transfers__from_club", "transfers__to_club"
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = AthleteFilter
    search_fields = ["first_name", "last_name", "middle_name", "club__name", "sport"]
    ordering_fields = ["first_name", "last_name", "birth_date", "height", "weight", "created_at", "number"]
    ordering = ["last_name", "first_name"]

    def perform_create(self, serializer):
        athlete = serializer.save()
        audit(self.request, athlete, "create")

    def perform_update(self, serializer):
        athlete = serializer.save()
        audit(self.request, athlete, "update")

    def perform_destroy(self, instance):
        audit(self.request, instance, "delete")
        instance.delete()

    @action(detail=True, methods=["get"])
    def valuation(self, request, pk=None):
        return Response(_valuation(self.get_object()))

    @action(detail=True, methods=["get"])
    def similar(self, request, pk=None):
        athlete = self.get_object()
        candidates = Athlete.objects.filter(
            sport=athlete.sport, position=athlete.position
        ).exclude(pk=athlete.pk).select_related("club").prefetch_related(
            "transfers__from_club", "transfers__to_club"
        )
        rows = []
        for candidate in candidates.select_related("club"):
            candidate_age = calc_age(candidate.birth_date)
            distance = abs(calc_age(athlete.birth_date) - candidate_age) * 2
            if athlete.height is not None and candidate.height is not None:
                distance += abs(athlete.height - candidate.height) / 5
            if athlete.weight is not None and candidate.weight is not None:
                distance += abs(athlete.weight - candidate.weight) / 5
            rows.append((distance, candidate))
        rows.sort(key=lambda item: (item[0], item[1].pk))
        return Response([
            {**AthleteSerializer(candidate, context={"request": request}).data, "distance": round(distance, 2)}
            for distance, candidate in rows[:5]
        ])

    @action(detail=False, methods=["get"], pagination_class=ScoutPagination)
    def scout(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page if page is not None else queryset, many=True)
        return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)

    @action(detail=False, methods=["get"])
    def compare(self, request):
        raw_ids = request.query_params.get("ids", "")
        try:
            ids = [int(value) for value in raw_ids.split(",") if value.strip()]
        except ValueError as exc:
            raise ValidationError({"ids": ["Передайте идентификаторы через запятую."]}) from exc
        if not 2 <= len(ids) <= 4 or len(set(ids)) != len(ids):
            raise ValidationError({"ids": ["Для сравнения укажите от 2 до 4 разных спортсменов."]})
        athletes = list(self.get_queryset().filter(pk__in=ids))
        if len(athletes) != len(ids):
            raise ValidationError({"ids": ["Один или несколько спортсменов не найдены."]})
        athletes.sort(key=lambda athlete: ids.index(athlete.pk))
        return Response([
            {
                "id": athlete.pk,
                "name": athlete.full_name,
                "club": _clean(athlete.club.name) if athlete.club_id else None,
                "age": calc_age(athlete.birth_date),
                "height": athlete.height,
                "weight": athlete.weight,
                "bmi": round(athlete.weight / ((athlete.height / 100) ** 2), 2) if athlete.height else None,
                "transfers_count": athlete.transfers.count(),
                "valuation": _valuation(athlete)["value"],
                "status": _clean_status(athlete.status),
            }
            for athlete in athletes
        ])

    @action(detail=False, methods=["get"])
    def birthdays(self, request):
        try:
            days = int(request.query_params.get("days", 30))
        except ValueError as exc:
            raise ValidationError({"days": ["Укажите число дней от 1 до 366."]}) from exc
        if not 1 <= days <= 366:
            raise ValidationError({"days": ["Укажите число дней от 1 до 366."]})
        today = timezone.localdate()
        end = today + timedelta(days=days)
        rows = []
        for athlete in Athlete.objects.select_related("club").only(
            "id", "first_name", "last_name", "birth_date", "club_id", "club__name", "sport"
        ):
            upcoming = _next_birthday(athlete.birth_date, today)
            if upcoming <= end:
                age = calc_age(athlete.birth_date, upcoming)
                rows.append({
                    "id": athlete.pk,
                    "name": athlete.full_name,
                    "club": _clean(athlete.club.name) if athlete.club_id else None,
                    "sport": _clean(athlete.sport),
                    "birth_date": athlete.birth_date.isoformat(),
                    "birthday": upcoming.isoformat(),
                    "turning_age": age,
                    "age_group": _age_group(age),
                    "days_until": (upcoming - today).days,
                })
        rows.sort(key=lambda row: (row["birthday"], row["name"]))
        breakdown = Counter(row["age_group"] for row in rows)
        return Response({
            "days": days,
            "count": len(rows),
            "breakdown": {group: breakdown.get(group, 0) for group in ("U18", "U21", "U23", "Взрослые")},
            "results": rows,
        })

    @action(detail=False, methods=["post"], url_path="import", parser_classes=[MultiPartParser, FormParser])
    def import_csv(self, request):
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise ValidationError({"file": ["Прикрепите CSV-файл в поле file."]})
        if uploaded.size > settings.MAX_IMPORT_BYTES:
            raise ValidationError({"file": [f"Размер файла не должен превышать {settings.MAX_IMPORT_BYTES} байт."]})
        try:
            text = uploaded.read().decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValidationError({"file": ["Файл должен быть в кодировке UTF-8 или UTF-8-SIG."]}) from exc
        sample = text[:4096]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;")
        except csv.Error:
            delimiter = ";" if sample.count(";") > sample.count(",") else ","
            dialect = csv.excel
            dialect.delimiter = delimiter
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        if not reader.fieldnames:
            raise ValidationError({"file": ["CSV-файл должен содержать заголовки столбцов."]})
        parsed_rows = list(reader)
        if len(parsed_rows) > settings.MAX_IMPORT_ROWS:
            raise ValidationError({"file": [f"Файл может содержать не более {settings.MAX_IMPORT_ROWS} строк."]})
        valid = []
        errors = []
        imported_numbers = defaultdict(list)
        for row_number, row in enumerate(parsed_rows, start=2):
            data = {
                key.strip(): value.strip()
                for key, value in row.items()
                if key and value is not None and value.strip()
            }
            if not data:
                continue
            serializer = AthleteSerializer(data=data, context={"request": request})
            if serializer.is_valid():
                valid.append((row_number, serializer))
                club_id = serializer.validated_data.get("club")
                number = serializer.validated_data.get("number")
                if club_id and number:
                    imported_numbers[(club_id.pk, number)].append(row_number)
            else:
                errors.append({"row": row_number, "errors": serializer.errors})
        duplicate_rows = {
            row_number
            for row_numbers in imported_numbers.values()
            if len(row_numbers) > 1
            for row_number in row_numbers
        }
        if duplicate_rows:
            valid = [item for item in valid if item[0] not in duplicate_rows]
            errors.extend(
                {
                    "row": row_number,
                    "errors": {"number": ["Игровой номер повторяется в этом CSV для одного клуба."]},
                }
                for row_number in sorted(duplicate_rows)
            )
        dry_run = request.query_params.get("dry_run", "false").lower() in {"1", "true", "yes"}
        imported = 0
        if not errors and not dry_run:
            with transaction.atomic():
                for _, serializer in valid:
                    athlete = serializer.save()
                    audit(request, athlete, "import")
                    imported += 1
        return Response({"valid": len(valid), "errors": errors, "imported": imported})

    @action(detail=False, methods=["post"])
    def bulk(self, request):
        ids = request.data.get("ids", [])
        operation = request.data.get("op")
        value = request.data.get("value")
        if not isinstance(ids, list) or not ids:
            raise ValidationError({"ids": ["Передайте непустой список идентификаторов."]})
        if len(ids) > 200:
            raise ValidationError({"ids": ["За один запрос можно обработать не более 200 спортсменов."]})
        try:
            normalized_ids = [int(item) for item in ids]
        except (TypeError, ValueError) as exc:
            raise ValidationError({"ids": ["Все идентификаторы должны быть целыми числами."]}) from exc
        if any(item <= 0 for item in normalized_ids) or len(set(normalized_ids)) != len(normalized_ids):
            raise ValidationError({"ids": ["Идентификаторы должны быть положительными и не повторяться."]})
        if operation not in {"set_status", "set_club", "delete"}:
            raise ValidationError({"op": ["Допустимые операции: set_status, set_club, delete."]})
        queryset = self.get_queryset().filter(pk__in=normalized_ids)
        found_ids = set(queryset.values_list("pk", flat=True))
        skipped = [item for item in normalized_ids if item not in found_ids]
        if operation == "set_status":
            status_value = normalize_choice(value, Athlete.STATUS_CHOICES)
            if status_value not in dict(Athlete.STATUS_CHOICES):
                raise ValidationError({"value": ["Укажите корректный статус спортсмена."]})
        if operation == "set_club" and value not in (None, "") and not str(value).isdigit():
            raise ValidationError({"value": ["Идентификатор клуба должен быть целым числом."]})
        if (
            operation == "set_club"
            and value not in (None, "")
            and not Club.objects.filter(pk=value).exists()
        ):
            raise ValidationError({"value": ["Клуб не найден."]})
        affected = 0
        with transaction.atomic():
            for athlete in queryset.select_for_update():
                if operation == "set_status":
                    athlete.status = status_value
                    athlete.save(update_fields=["status"])
                elif operation == "set_club":
                    athlete.club_id = int(value) if value not in (None, "") else None
                    athlete.save(update_fields=["club"])
                else:
                    audit(request, athlete, "bulk_delete")
                    athlete.delete()
                if operation != "delete":
                    audit(request, athlete, "bulk_update", operation)
                affected += 1
        audit(request, request.user, "bulk", f"{operation}: {affected}")
        return Response({"affected": affected, "skipped": skipped})


class ClubViewSet(viewsets.ModelViewSet):
    permission_classes = [RoleWritePermission]
    write_roles = ("manager",)
    serializer_class = ClubSerializer
    queryset = Club.objects.annotate(athlete_count=Count("athletes")).prefetch_related("athletes")

    def perform_create(self, serializer):
        audit(self.request, serializer.save(), "create")

    def perform_update(self, serializer):
        audit(self.request, serializer.save(), "update")

    def perform_destroy(self, instance):
        audit(self.request, instance, "delete")
        instance.delete()

    @action(detail=True, methods=["get"])
    def balance(self, request, pk=None):
        club = self.get_object()
        year = request.query_params.get("year")
        transfers = Transfer.objects.filter(status=approved_status_value())
        if year:
            try:
                year = int(year)
                transfers = transfers.filter(date__year=year)
            except ValueError as exc:
                raise ValidationError({"year": ["Укажите год числом."]}) from exc
        outgoing = transfers.filter(from_club=club).aggregate(amount=Sum("amount"), count=Count("id"))
        incoming = transfers.filter(to_club=club).aggregate(amount=Sum("amount"), count=Count("id"))
        spent = outgoing["amount"] or 0
        earned = incoming["amount"] or 0
        return Response({
            "club": club.pk,
            "year": year,
            "spent": spent,
            "earned": earned,
            "net_balance": earned - spent,
            "incoming": {"count": incoming["count"], "amount": earned},
            "outgoing": {"count": outgoing["count"], "amount": spent},
            "currency": "KZT",
        })

    @action(detail=True, methods=["get"])
    def squad(self, request, pk=None):
        club = self.get_object()
        athletes = list(Athlete.objects.filter(club=club).only(
            "id", "birth_date", "position", "status", "photo_url", "number"
        ))
        ages = [calc_age(athlete.birth_date) for athlete in athletes]
        positions = Counter(_clean(athlete.position) for athlete in athletes)
        injured = sum(_clean_status(athlete.status) == "Травма" for athlete in athletes)
        age_groups = Counter(_age_group(age) for age in ages)
        return Response({
            "club": club.pk,
            "size": len(athletes),
            "age": {
                "average": round(sum(ages) / len(ages), 1) if ages else 0,
                "min": min(ages) if ages else 0,
                "max": max(ages) if ages else 0,
            },
            "injured_share": round(injured / len(athletes), 4) if athletes else 0,
            "positions": dict(positions),
            "thin_positions": sorted(position for position, count in positions.items() if count < 2),
            "age_groups": {key: age_groups.get(key, 0) for key in ("U18", "U21", "U23", "Взрослые")},
            "without_photo": sum(not athlete.photo_url for athlete in athletes),
            "without_number": sum(not athlete.number for athlete in athletes),
        })


class TransferViewSet(viewsets.ModelViewSet):
    permission_classes = [RoleWritePermission]
    write_roles = ("manager",)
    serializer_class = TransferSerializer
    queryset = Transfer.objects.select_related("athlete", "from_club", "to_club")

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        warnings = getattr(self, "_transfer_warnings", [])
        if warnings:
            response.data["warnings"] = warnings
        return response

    def perform_create(self, serializer):
        transfer = serializer.save()
        self._transfer_warnings = getattr(serializer, "_transfer_warnings", [])
        audit(self.request, transfer, "create")

    @transaction.atomic
    def perform_update(self, serializer):
        requested_status = serializer.validated_data.pop("status", None)
        transfer = serializer.save()
        if requested_status is not None:
            clean_status = _clean_status(requested_status)
            if clean_status in {"Одобрен", "Отклонён"}:
                transfer = decide_transfer(transfer.pk, requested_status, request=self.request)
                serializer.instance = transfer
                return
            raise ValidationError({"status": ["Изменить статус можно только решением approve или reject."]})
        audit(self.request, transfer, "update")

    def perform_destroy(self, instance):
        audit(self.request, instance, "delete")
        instance.delete()

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        transfer = decide_transfer(pk, "Одобрен", request=request)
        return Response(self.get_serializer(transfer).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        transfer = decide_transfer(pk, "Отклонён", request=request)
        return Response(self.get_serializer(transfer).data)


class EventViewSet(viewsets.ModelViewSet):
    permission_classes = [RoleWritePermission]
    write_roles = ("manager",)
    serializer_class = EventSerializer
    queryset = Event.objects.prefetch_related("clubs")

    def perform_create(self, serializer):
        audit(self.request, serializer.save(), "create")

    def perform_update(self, serializer):
        audit(self.request, serializer.save(), "update")

    def perform_destroy(self, instance):
        audit(self.request, instance, "delete")
        instance.delete()

    @action(detail=False, methods=["get"])
    def conflicts(self, request):
        events = Event.objects.prefetch_related("clubs").order_by("date", "time")
        buckets = defaultdict(list)
        club_names = {}
        for event in events:
            for club in event.clubs.all():
                buckets[(event.date, club.pk)].append(event)
                club_names[club.pk] = _clean(club.name)
        conflicts = []
        for (event_date, club_id), matching in buckets.items():
            if len(matching) > 1:
                conflicts.append({
                    "date": event_date.isoformat(),
                    "club": club_id,
                    "club_name": club_names[club_id],
                    "events": [{"id": row.pk, "title": _clean(row.title), "time": row.time.isoformat()} for row in matching],
                })
        return Response(conflicts)


class HealthView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        from django.db import connection

        connection.ensure_connection()
        return Response({"status": "ok", "database": "ok"})


class QualityView(APIView):
    permission_classes = [StaffPermission]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(_quality_report())


class SearchView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            raise ValidationError({"q": ["Введите не менее двух символов."]})
        athletes = Athlete.objects.select_related("club").filter(
            Q(first_name__icontains=query) | Q(last_name__icontains=query) | Q(middle_name__icontains=query)
        ).order_by("last_name", "first_name")[:5]
        clubs = Club.objects.filter(Q(name__icontains=query) | Q(short_name__icontains=query)).order_by("name")[:5]
        events = Event.objects.filter(Q(title__icontains=query) | Q(location__icontains=query)).order_by("date", "time")[:5]
        return Response({
            "athletes": [{"type": "athlete", "id": row.pk, "label": _clean(row.full_name), "link": f"/athletes/{row.pk}"} for row in athletes],
            "clubs": [{"type": "club", "id": row.pk, "label": _clean(row.name), "link": f"/clubs?search={query}"} for row in clubs],
            "events": [{"type": "event", "id": row.pk, "label": _clean(row.title), "link": "/events"} for row in events],
        })


class NotificationsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        notifications = []
        if _can_decide(request.user):
            count = sum(_clean_status(value) == "В процессе" for value in Transfer.objects.values_list("status", flat=True))
            if count:
                notifications.append({"type": "transfer", "severity": "warning", "message": "Трансферы ожидают решения.", "count": count, "link": "/transfers"})
        injury_count = sum(_clean_status(value) == "Травма" for value in Athlete.objects.values_list("status", flat=True))
        if injury_count:
            notifications.append({"type": "medical", "severity": "warning", "message": "Спортсмены с медицинским статусом «Травма».", "count": injury_count, "link": "/athletes?status=Травма"})
        today = timezone.localdate()
        event_count = Event.objects.filter(date__gte=today, date__lte=today + timedelta(days=7)).count()
        if event_count:
            notifications.append({"type": "event", "severity": "info", "message": "Мероприятия в ближайшие 7 дней.", "count": event_count, "link": "/events"})
        if request.user.is_staff or request.user.is_superuser:
            quality = _quality_report()
            issue_count = sum(block["count"] for block in quality["blocks"].values())
            if issue_count:
                notifications.append({"type": "quality", "severity": "error", "message": "В базе найдены проблемы качества данных.", "count": issue_count, "link": "/quality"})
        return Response(notifications)


class AuditView(APIView):
    permission_classes = [StaffPermission]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        entries = LogEntry.objects.select_related("user", "content_type").order_by("-action_time")
        user_id = request.query_params.get("user")
        action_type = request.query_params.get("type")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if user_id:
            if not user_id.isdigit():
                raise ValidationError({"user": ["Идентификатор пользователя должен быть целым числом."]})
            entries = entries.filter(user_id=user_id)
        if action_type:
            entries = entries.filter(change_message__icontains=f'"type": "{action_type}"')
        if date_from:
            try:
                parsed_from = date.fromisoformat(date_from)
            except ValueError as exc:
                raise ValidationError({"date_from": ["Укажите дату в формате ГГГГ-ММ-ДД."]}) from exc
            entries = entries.filter(action_time__date__gte=parsed_from)
        if date_to:
            try:
                parsed_to = date.fromisoformat(date_to)
            except ValueError as exc:
                raise ValidationError({"date_to": ["Укажите дату в формате ГГГГ-ММ-ДД."]}) from exc
            entries = entries.filter(action_time__date__lte=parsed_to)
        results = [{
            "id": entry.pk,
            "user": entry.user_id,
            "username": entry.user.get_username(),
            "content_type": entry.content_type.model if entry.content_type else None,
            "object_id": entry.object_id,
            "object_repr": _clean(entry.object_repr),
            "action": {1: "Добавлено", 2: "Изменено", 3: "Удалено"}.get(entry.action_flag, "Изменено"),
            "change_message": entry.change_message,
            "action_time": entry.action_time,
        } for entry in entries[:500]]
        return Response(results)


class CalendarICSView(APIView):
    @extend_schema(responses={200: OpenApiTypes.BINARY})
    def get(self, request):
        events = Event.objects.prefetch_related("clubs").order_by("date", "time")
        club_id = request.query_params.get("club")
        if club_id:
            if not str(club_id).isdigit() or not Club.objects.filter(pk=club_id).exists():
                raise ValidationError({"club": ["Клуб не найден."]})
            events = events.filter(clubs__pk=club_id).distinct()
        now_utc = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")

        def escape(value):
            value = _clean(str(value or ""))
            return (
                value.replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\r\n", "\\n")
                .replace("\n", "\\n")
                .replace("\r", "\\n")
            )

        def fold(line):
            folded = []
            current = ""
            width = 0
            for char in line:
                encoded_width = len(char.encode("utf-8"))
                if current and width + encoded_width > 75:
                    folded.append(current)
                    current = " "
                    width = 1
                current += char
                width += encoded_width
            folded.append(current)
            return folded

        lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fan Club//Athlete Database//RU", "CALSCALE:GREGORIAN"]
        zone = ZoneInfo(settings.TIME_ZONE)
        for event in events:
            start = datetime.combine(event.date, event.time, tzinfo=zone).astimezone(UTC)
            end = start + timedelta(hours=2)
            club_names = ", ".join(_clean(club.name) for club in event.clubs.all())
            description = event.description
            if club_names:
                description = f"{description}\nКлубы: {club_names}" if description else f"Клубы: {club_names}"
            lines.extend([
                "BEGIN:VEVENT",
                f"UID:event-{event.pk}@fan-club",
                f"DTSTAMP:{now_utc}",
                f"DTSTART:{start.strftime('%Y%m%dT%H%M%SZ')}",
                f"DTEND:{end.strftime('%Y%m%dT%H%M%SZ')}",
                f"SUMMARY:{escape(event.title)}",
                f"LOCATION:{escape(event.location)}",
                f"DESCRIPTION:{escape(description)}",
                "END:VEVENT",
            ])
        lines.append("END:VCALENDAR")
        body = "\r\n".join(folded for line in lines for folded in fold(line)) + "\r\n"
        return HttpResponse(body.encode("utf-8"), content_type="text/calendar; charset=utf-8")


@extend_schema(responses=OpenApiTypes.OBJECT)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    today = timezone.localdate()
    sports = Athlete.objects.values("sport").annotate(value=Count("id")).order_by("sport")
    months = []
    for offset in range(5, -1, -1):
        index = today.month - 1 - offset
        year = today.year + index // 12
        month = index % 12 + 1
        count = Athlete.objects.filter(created_at__year=year, created_at__month=month).count()
        months.append({"month": date(year, month, 1).strftime("%b"), "athletes": count})
    events = Event.objects.filter(date__gte=today).prefetch_related("clubs")[:4]
    activities = []
    action_labels = {1: "добавил запись", 2: "изменил запись", 3: "удалил запись"}
    audit_rows = LogEntry.objects.select_related("user", "content_type").order_by("-action_time")[:4]
    for entry in audit_rows:
        activities.append({
            "id": entry.pk,
            "user": _clean(entry.user.get_full_name() or entry.user.get_username()),
            "action": action_labels.get(entry.action_flag, "изменил запись"),
            "target": _clean(entry.object_repr),
            "time": entry.action_time.isoformat(),
            "type": entry.content_type.model if entry.content_type_id else "record",
        })
    injured_count = sum(_clean_status(value) == "Травма" for value in Athlete.objects.values_list("status", flat=True))
    return Response({
        "metrics": {
            "athletes": Athlete.objects.count(),
            "clubs": Club.objects.filter(is_active=True).count(),
            "injured": injured_count,
            "tournaments": len(events),
        },
        "sports": [{**row, "sport": _clean(row["sport"])} for row in sports],
        "registrations": months,
        "activities": activities,
        "events": EventSerializer(events, many=True, context={"request": request}).data,
    })


@extend_schema(responses=OpenApiTypes.OBJECT)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics(request):
    clubs = Club.objects.annotate(athlete_count=Count("athletes")).order_by("name")
    performance = [{
        "name": _clean(club.name),
        "wins": 0,
        "draws": 0,
        "losses": 0,
        "athletes": club.athlete_count,
        "is_demo": True,
    } for club in clubs]
    today = timezone.localdate()
    injuries = []
    athletes = list(Athlete.objects.only("status", "created_at"))
    for year in range(today.year - 3, today.year + 1):
        count = sum(
            _clean_status(athlete.status) == "Травма" and athlete.created_at.year == year
            for athlete in athletes
        )
        injuries.append({"season": f"{year}/{str(year + 1)[-2:]}", "injuries": count, "is_demo": True})
    sports = [
        {"sport": _clean(row["sport"]), "value": row["value"]}
        for row in Athlete.objects.values("sport").annotate(value=Count("id")).order_by("sport")
    ]
    return Response({"club_performance": performance, "injuries": injuries, "sports": sports})
