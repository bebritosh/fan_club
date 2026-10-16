from datetime import date
from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Athlete, Club, Event, Transfer
from .serializers import AthleteSerializer, ClubSerializer, EventSerializer, RegisterSerializer, TransferSerializer, UserSerializer

class RegisterView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        serializer = RegisterSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user, context={"request": request}).data, status=status.HTTP_201_CREATED)

class ProfileView(APIView):
    def get(self, request): return Response(UserSerializer(request.user, context={"request": request}).data)
    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True); serializer.save()
        return Response(UserSerializer(request.user, context={"request": request}).data)

class PasswordChangeView(APIView):
    def post(self, request):
        old, new = request.data.get("old_password", ""), request.data.get("new_password", "")
        if not request.user.check_password(old): return Response({"old_password": ["Текущий пароль указан неверно."]}, status=400)
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError
        try: validate_password(new, request.user)
        except ValidationError as exc: return Response({"new_password": list(exc.messages)}, status=400)
        request.user.set_password(new); request.user.save(update_fields=["password"])
        return Response({"detail": "Пароль успешно обновлён."})

class AthleteViewSet(viewsets.ModelViewSet):
    serializer_class = AthleteSerializer
    queryset = Athlete.objects.select_related("club").prefetch_related("transfers__from_club", "transfers__to_club")
    def get_queryset(self):
        qs = super().get_queryset(); q = self.request.query_params.get("search", "")
        sport, state = self.request.query_params.get("sport"), self.request.query_params.get("status")
        if q: qs = qs.filter(first_name__icontains=q) | qs.filter(last_name__icontains=q) | qs.filter(club__name__icontains=q)
        if sport: qs = qs.filter(sport=sport)
        if state: qs = qs.filter(status=state)
        return qs.distinct()

class ClubViewSet(viewsets.ModelViewSet):
    serializer_class = ClubSerializer
    queryset = Club.objects.annotate(athlete_count=Count("athletes"))
class TransferViewSet(viewsets.ModelViewSet):
    serializer_class = TransferSerializer
    queryset = Transfer.objects.select_related("athlete", "from_club", "to_club")
    def perform_update(self, serializer):
        transfer = serializer.save()
        if transfer.status == "Одобрен" and transfer.to_club_id:
            Athlete.objects.filter(pk=transfer.athlete_id).update(club_id=transfer.to_club_id)
class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    queryset = Event.objects.prefetch_related("clubs")

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    sports = Athlete.objects.values("sport").annotate(value=Count("id")).order_by("sport")
    months, today = [], timezone.localdate()
    for offset in range(5, -1, -1):
        index = today.month - 1 - offset; year = today.year + index // 12; month = index % 12 + 1
        count = Athlete.objects.filter(created_at__year=year, created_at__month=month).count()
        months.append({"month": date(year, month, 1).strftime("%b"), "athletes": count})
    events = Event.objects.filter(date__gte=today).prefetch_related("clubs")[:4]
    transfers = Transfer.objects.select_related("athlete").order_by("-date")[:4]
    activities = [{"id": t.id, "user": "Fan Club", "action": "обновлён переход спортсмена", "target": t.athlete.name, "time": t.date.isoformat(), "type": "transfer"} for t in transfers]
    return Response({"metrics": {"athletes": Athlete.objects.count(), "clubs": Club.objects.filter(is_active=True).count(), "injured": Athlete.objects.filter(status="Травма").count(), "tournaments": len(events)}, "sports": list(sports), "registrations": months, "activities": activities, "events": EventSerializer(events, many=True, context={"request": request}).data})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics(request):
    performance = []
    for i, club in enumerate(Club.objects.annotate(athlete_count=Count("athletes"))):
        performance.append({"name": club.name, "wins": [18,15,13,11,9][i%5], "draws": [4,6,5,7,4][i%5], "losses": [3,4,7,7,10][i%5], "athletes": club.athlete_count})
    injuries = [{"season": f"{year}/{str(year+1)[-2:]}", "injuries": Athlete.objects.filter(status="Травма", created_at__year=year).count()} for year in range(date.today().year-3, date.today().year+1)]
    return Response({"club_performance": performance, "injuries": injuries, "sports": list(Athlete.objects.values("sport").annotate(value=Count("id")))})
