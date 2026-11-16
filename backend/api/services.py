from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Athlete, Transfer
from .utils import fix_mojibake, normalize_choice


def transfer_status(value):
    return normalize_choice(value, Transfer.STATUS_CHOICES)


def _clean_status(value):
    return fix_mojibake(str(value))


@transaction.atomic
def decide_transfer(transfer_id, decision, *, user=None, request=None):
    """Approve/reject one pending transfer with row-level serialization."""
    transfer = (
        Transfer.objects.select_for_update(of=("self",))
        .select_related("athlete", "to_club")
        .get(pk=transfer_id)
    )
    if _clean_status(transfer.status) != "В процессе":
        raise ValidationError({"detail": ["Решение возможно только по ожидающему переходу."]})
    target_status = transfer_status(decision)
    clean_target = _clean_status(target_status)
    if clean_target not in {"Одобрен", "Отклонён"}:
        raise ValidationError({"detail": ["Укажите решение «Одобрен» или «Отклонён»."]})
    transfer.status = target_status
    transfer.save(update_fields=["status"])
    if clean_target == "Одобрен" and transfer.to_club_id:
        Athlete.objects.filter(pk=transfer.athlete_id).update(club_id=transfer.to_club_id)
    if request is not None:
        from .audit import audit

        audit(request, transfer, "approve" if clean_target == "Одобрен" else "reject")
    return transfer


def is_in_transfer_window(transfer_date):
    windows = getattr(settings, "TRANSFER_WINDOWS", ())
    if not windows:
        return True
    day = transfer_date.strftime("%m-%d")
    for window in windows:
        start, end = window
        if start <= end and start <= day <= end:
            return True
        if start > end and (day >= start or day <= end):
            return True
    return False


def validate_transfer_data(attrs, instance=None):
    """Return all transfer creation/update issues and non-blocking warnings."""
    errors = []
    warnings = []
    athlete = attrs.get("athlete", getattr(instance, "athlete", None))
    from_club = attrs.get("from_club", getattr(instance, "from_club", None))
    to_club = attrs.get("to_club", getattr(instance, "to_club", None))
    transfer_date = attrs.get("date", getattr(instance, "date", None))

    if from_club and to_club and from_club.pk == to_club.pk:
        errors.append("Клубы отправления и назначения должны различаться.")
    if athlete and from_club and athlete.club_id != from_club.pk:
        errors.append("Спортсмен не зарегистрирован в клубе отправления.")
    if athlete:
        pending = [
            row
            for row in Transfer.objects.filter(athlete=athlete).only("status")
            if _clean_status(row.status) == "В процессе"
            and (instance is None or row.pk != instance.pk)
        ]
        if pending:
            errors.append("У спортсмена уже есть переход, ожидающий решения.")
    if transfer_date and not is_in_transfer_window(transfer_date):
        errors.append("Дата перехода не входит в установленное трансферное окно.")
    if to_club and athlete:
        size = to_club.athletes.exclude(pk=athlete.pk).count()
        if size >= settings.MAX_SQUAD_SIZE:
            errors.append(f"В клубе назначения превышен лимит состава ({settings.MAX_SQUAD_SIZE}).")
        if athlete.number and to_club.athletes.exclude(pk=athlete.pk).filter(number=athlete.number).exists():
            warnings.append("В клубе назначения уже занят игровой номер спортсмена.")
    return errors, warnings


def pending_status_value():
    return next(key for key, label in Transfer.STATUS_CHOICES if _clean_status(key) == "В процессе")


def approved_status_value():
    return next(key for key, label in Transfer.STATUS_CHOICES if _clean_status(key) == "Одобрен")


def rejected_status_value():
    return next(key for key, label in Transfer.STATUS_CHOICES if _clean_status(key) == "Отклонён")
