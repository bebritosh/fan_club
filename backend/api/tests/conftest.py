from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

from api.models import Athlete, Club, Transfer
from api.services import pending_status_value

User = get_user_model()


@pytest.fixture
def clubs(db):
    first = Club.objects.create(name="North", short_name="NOR", founded=2000, league="A", coach="Coach A")
    second = Club.objects.create(name="South", short_name="SOU", founded=2001, league="B", coach="Coach B")
    third = Club.objects.create(name="East", short_name="EAS", founded=2002, league="C", coach="Coach C")
    return first, second, third


@pytest.fixture
def athlete_factory(db, clubs):
    def create(**overrides):
        number = Athlete.objects.count() + 1
        values = {
            "first_name": f"Player{number}",
            "last_name": "Test",
            "middle_name": "",
            "gender": Athlete.GENDER_CHOICES[0][0],
            "birth_date": date(2000, 1, 1),
            "sport": "Football",
            "position": "Forward",
            "club": clubs[0],
            "number": number,
            "status": Athlete.STATUS_CHOICES[0][0],
            "height": 180,
            "weight": 75,
            "medical_notes": "",
            "achievements": [],
            "photo_url": "",
        }
        values.update(overrides)
        return Athlete.objects.create(**values)

    return create


@pytest.fixture
def user_factory(db):
    def create(role=None, is_staff=False):
        user = User.objects.create_user(username=f"user-{User.objects.count()}", password="StrongPass2026!", is_staff=is_staff)
        if role:
            group, _ = Group.objects.get_or_create(name=role)
            user.groups.add(group)
        return user

    return create


@pytest.fixture
def manager(user_factory):
    return user_factory("manager", is_staff=True)


@pytest.fixture
def pending_transfer(athlete_factory, clubs):
    athlete = athlete_factory(club=clubs[0])
    return Transfer.objects.create(
        athlete=athlete,
        from_club=clubs[0],
        to_club=clubs[1],
        date=date.today(),
        amount="100000.00",
        status=pending_status_value(),
    )
