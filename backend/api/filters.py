from datetime import date

import django_filters
from django.utils import timezone

from .models import Athlete
from .utils import normalize_choice


def birthday_cutoff(year, month, day):
    """Build a valid date in a target year; Feb 29 falls back to Feb 28."""
    try:
        return date(year, month, day)
    except ValueError:
        if month == 2 and day == 29:
            return date(year, 2, 28)
        raise


class AthleteFilter(django_filters.FilterSet):
    sport = django_filters.CharFilter(field_name="sport", lookup_expr="iexact")
    position = django_filters.CharFilter(field_name="position", lookup_expr="iexact")
    club = django_filters.NumberFilter(field_name="club_id")
    status = django_filters.CharFilter(method="filter_status")
    age_min = django_filters.NumberFilter(method="filter_age_min")
    age_max = django_filters.NumberFilter(method="filter_age_max")
    height_min = django_filters.NumberFilter(field_name="height", lookup_expr="gte")
    height_max = django_filters.NumberFilter(field_name="height", lookup_expr="lte")
    weight_min = django_filters.NumberFilter(field_name="weight", lookup_expr="gte")
    weight_max = django_filters.NumberFilter(field_name="weight", lookup_expr="lte")
    free_agents = django_filters.BooleanFilter(method="filter_free_agents")

    class Meta:
        model = Athlete
        fields = ()

    def filter_age_min(self, queryset, name, value):
        today = timezone.localdate()
        cutoff = birthday_cutoff(today.year - int(value), today.month, today.day)
        return queryset.filter(birth_date__lte=cutoff)

    def filter_age_max(self, queryset, name, value):
        today = timezone.localdate()
        cutoff = birthday_cutoff(today.year - int(value) - 1, today.month, today.day)
        return queryset.filter(birth_date__gt=cutoff)

    def filter_free_agents(self, queryset, name, value):
        return queryset.filter(club__isnull=value)

    def filter_status(self, queryset, name, value):
        normalized = normalize_choice(value, Athlete.STATUS_CHOICES)
        return queryset.filter(status=normalized)
