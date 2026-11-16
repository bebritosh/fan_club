from datetime import date, time

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APIClient

from api.models import Athlete, Event, Transfer
from api.services import pending_status_value
from api.utils import normalize_choice

pytestmark = pytest.mark.django_db


def api_client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def test_role_write_permissions(manager, user_factory, athlete_factory, clubs):
    athlete = athlete_factory()
    viewer = user_factory("viewer")
    medic = user_factory("medic")
    assert api_client(viewer).patch(f"/api/athletes/{athlete.pk}/", {"height": 181}).status_code == 403
    assert api_client(medic).patch(f"/api/athletes/{athlete.pk}/", {"height": 181}).status_code == 200
    assert api_client(medic).post("/api/clubs/", {"name": "Denied"}).status_code == 403
    assert api_client(manager).patch(f"/api/athletes/{athlete.pk}/", {"height": 182}).status_code == 200


def test_transfer_approve_reject_and_repeat(pending_transfer, manager, clubs):
    transfer = pending_transfer
    client = api_client(manager)
    response = client.post(f"/api/transfers/{transfer.pk}/approve/")
    assert response.status_code == 200
    transfer.athlete.refresh_from_db()
    assert transfer.athlete.club_id == clubs[1].pk
    assert response.data["status"] == "Одобрен"
    assert client.post(f"/api/transfers/{transfer.pk}/approve/").status_code == 400

    second = Transfer.objects.create(
        athlete=transfer.athlete,
        from_club=clubs[1],
        to_club=clubs[2],
        date=date.today(),
        status=pending_status_value(),
    )
    assert client.post(f"/api/transfers/{second.pk}/reject/").data["status"] == "Отклонён"
    assert client.post(f"/api/transfers/{second.pk}/reject/").status_code == 400


@override_settings(TRANSFER_WINDOWS=(("01-01", "01-02"),), MAX_SQUAD_SIZE=1)
def test_transfer_validation_returns_all_issues(athlete_factory, clubs, manager):
    athlete = athlete_factory(club=clubs[0])
    occupied = athlete_factory(club=clubs[1], number=90)
    Transfer.objects.create(athlete=athlete, from_club=clubs[0], to_club=clubs[2], date=date.today(), status=pending_status_value())
    response = api_client(manager).post("/api/transfers/", {
        "athlete": athlete.pk,
        "from_club": clubs[1].pk,
        "to_club": clubs[1].pk,
        "date": "2026-06-15",
        "amount": "100.00",
        "status": "В процессе",
    })
    assert response.status_code == 400
    errors = response.data["error"]["details"]["errors"]
    assert len(errors) >= 5
    assert occupied.pk


def test_transfer_status_normalization():
    approved = dict(Transfer.STATUS_CHOICES)[next(key for key, label in Transfer.STATUS_CHOICES if label == "Одобрен")]
    broken = "Одобрен".encode().decode("cp1251")
    assert normalize_choice("Одобрен", Transfer.STATUS_CHOICES) == approved
    assert normalize_choice("approved", Transfer.STATUS_CHOICES) == approved
    assert normalize_choice(broken, Transfer.STATUS_CHOICES) == approved


def test_transfer_patch_status_uses_decision_service(pending_transfer, manager, clubs):
    response = api_client(manager).patch(f"/api/transfers/{pending_transfer.pk}/", {"status": "approved"})
    assert response.status_code == 200
    pending_transfer.athlete.refresh_from_db()
    assert pending_transfer.athlete.club_id == clubs[1].pk


@override_settings(TRANSFER_WINDOWS=(("01-01", "12-31"),), MAX_SQUAD_SIZE=40)
def test_transfer_number_collision_is_warning(athlete_factory, clubs, manager):
    athlete = athlete_factory(club=clubs[0], number=7)
    athlete_factory(club=clubs[1], number=7)
    response = api_client(manager).post("/api/transfers/", {
        "athlete": athlete.pk,
        "from_club": clubs[0].pk,
        "to_club": clubs[1].pk,
        "date": date.today().isoformat(),
        "amount": "100.00",
        "status": "В процессе",
    })
    assert response.status_code == 201
    assert response.data["warnings"] == ["В клубе назначения уже занят игровой номер спортсмена."]


def test_club_balance_valuation_and_squad(athlete_factory, clubs, manager):
    athlete = athlete_factory(club=clubs[1], birth_date=date.today().replace(year=date.today().year - 25), achievements=["a", "b"])
    Transfer.objects.create(athlete=athlete, from_club=clubs[0], to_club=clubs[1], date=date.today(), amount="1000", status=next(key for key, label in Transfer.STATUS_CHOICES if label == "Одобрен"))
    client = api_client(manager)
    balance = client.get(f"/api/clubs/{clubs[1].pk}/balance/?year={date.today().year}").data
    assert balance["earned"] == 1000
    valuation = client.get(f"/api/athletes/{athlete.pk}/valuation/").data
    assert valuation["value"] == 1_650_000
    squad = client.get(f"/api/clubs/{clubs[2].pk}/squad/").data
    assert squad["size"] == 0 and squad["age"]["average"] == 0
    assert squad["thin_positions"] == []


def test_scout_filters_and_page(manager, athlete_factory, clubs):
    athlete_factory(sport="Hockey", position="Goalkeeper", club=None, height=190, weight=88)
    response = api_client(manager).get("/api/athletes/scout/?sport=Hockey&free_agents=true&height_min=185&page=1")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert len(response.data["results"]) == 1


def test_similar_and_compare_bounds(manager, athlete_factory):
    first = athlete_factory()
    second = athlete_factory()
    client = api_client(manager)
    assert len(client.get(f"/api/athletes/{first.pk}/similar/").data) == 1
    assert client.get(f"/api/athletes/compare/?ids={first.pk}").status_code == 400
    assert client.get(f"/api/athletes/compare/?ids={first.pk},2,3,4,5").status_code == 400
    response = client.get(f"/api/athletes/compare/?ids={first.pk},{second.pk}")
    assert response.status_code == 200
    assert len(response.data) == 2
    assert "bmi" in response.data[0]


def test_birthdays_leap_day_and_year_boundary(manager, athlete_factory, monkeypatch):
    athlete = athlete_factory(birth_date=date(2000, 2, 29))
    monkeypatch.setattr("api.views.timezone.localdate", lambda: date(2027, 2, 27))
    response = api_client(manager).get("/api/athletes/birthdays/?days=2")
    assert response.status_code == 200
    assert response.data["results"][0]["id"] == athlete.pk
    assert response.data["results"][0]["birthday"] == "2027-02-28"


def test_birthdays_include_new_year_boundary(manager, athlete_factory, monkeypatch):
    athlete = athlete_factory(birth_date=date(2001, 1, 1))
    monkeypatch.setattr("api.views.timezone.localdate", lambda: date(2026, 12, 31))
    response = api_client(manager).get("/api/athletes/birthdays/?days=1")
    assert response.status_code == 200
    assert response.data["results"][0]["id"] == athlete.pk
    assert response.data["results"][0]["days_until"] == 1


def test_events_conflicts_and_ics(manager, clubs):
    today = date.today()
    first = Event.objects.create(title="Cup; Final", type=Event.TYPE_CHOICES[0][0], date=today, time=time(12), location="Arena, Main")
    first.clubs.add(clubs[0])
    second = Event.objects.create(title="Second", type=Event.TYPE_CHOICES[0][0], date=today, time=time(14), location="Arena")
    second.clubs.add(clubs[0])
    client = api_client(manager)
    conflicts = client.get("/api/events/conflicts/")
    assert conflicts.status_code == 200 and len(conflicts.data) == 1
    calendar = client.get("/api/events/calendar.ics/")
    assert calendar.status_code == 200
    assert calendar["Content-Type"] == "text/calendar; charset=utf-8"
    assert b"\r\n" in calendar.content and b"UID:event-" in calendar.content
    assert b"Cup\\; Final" in calendar.content and b"Arena\\, Main" in calendar.content


def test_quality_search_notifications_and_audit(manager, athlete_factory, clubs):
    athlete = athlete_factory(photo_url="", club=None)
    client = api_client(manager)
    quality = client.get("/api/quality/")
    assert quality.status_code == 200 and "quality_score" in quality.data
    assert quality.data["blocks"]["without_club"]["ids"] == [athlete.pk]
    assert client.get("/api/search/?q=Pl").status_code == 200
    assert client.get("/api/search/?q=P").status_code == 400
    assert client.get("/api/notifications/").status_code == 200
    client.patch(f"/api/athletes/{athlete.pk}/", {"height": 181})
    audit_response = client.get("/api/audit/?type=update")
    assert audit_response.status_code == 200
    assert audit_response.data


def test_quality_detects_duplicates_and_data_issues(manager, athlete_factory, clubs):
    first = athlete_factory(first_name="Duplicate", last_name="Name", birth_date=date(2000, 1, 1), number=77, height=250, photo_url="")
    second = athlete_factory(first_name="Duplicate", last_name="Name", birth_date=date(2000, 1, 1), number=77, height=100, photo_url="")
    future = athlete_factory(birth_date=date(2999, 1, 1), club=None)
    response = api_client(manager).get("/api/quality/")
    blocks = response.data["blocks"]
    assert blocks["duplicate_athletes"]["count"] == 2
    assert blocks["duplicate_numbers"]["count"] == 2
    assert first.pk in blocks["invalid_height_weight"]["ids"]
    assert second.pk in blocks["invalid_height_weight"]["ids"]
    assert future.pk in blocks["future_birth_date"]["ids"]
    assert future.pk in blocks["without_club"]["ids"]
    assert response.data["quality_score"] < 100


def test_mojibake_is_cleaned_in_serializer_and_quality_report(manager, athlete_factory):
    corrupted = "Одобрен".encode().decode("cp1251")
    athlete = athlete_factory(first_name=corrupted)
    client = api_client(manager)
    detail = client.get(f"/api/athletes/{athlete.pk}/")
    assert detail.data["first_name"] == "Одобрен"
    quality = client.get("/api/quality/").data
    assert athlete.pk in quality["blocks"]["mojibake"]["ids"]


def test_notifications_include_transfer_injury_event_and_staff_quality(manager, athlete_factory, clubs):
    athlete = athlete_factory(status=next(key for key, label in Athlete.STATUS_CHOICES if label == "Травма"))
    Transfer.objects.create(athlete=athlete, from_club=clubs[0], to_club=clubs[1], date=date.today(), status=pending_status_value())
    event = Event.objects.create(title="Next event", type=Event.TYPE_CHOICES[0][0], date=date.today(), time=time(12), location="Arena")
    event.clubs.add(clubs[0])
    response = api_client(manager).get("/api/notifications/")
    assert response.status_code == 200
    types = {item["type"] for item in response.data}
    assert {"transfer", "medical", "event", "quality"} <= types


def test_import_dry_run_and_atomic_errors(manager, clubs):
    client = api_client(manager)
    good_csv = b"first_name,last_name,birth_date,sport,position,club,number,height,weight\nTest,Player,2000-01-01,Football,Forward,,1,180,75\n"
    dry = client.post("/api/athletes/import/?dry_run=true", {"file": SimpleUploadedFile("athletes.csv", good_csv)}, format="multipart")
    assert dry.status_code == 200 and dry.data["valid"] == 1 and dry.data["imported"] == 0
    assert Athlete.objects.count() == 0
    bad_csv = b"first_name,last_name,birth_date,sport,position,club,number,height,weight\nGood,Row,2000-01-01,Football,Forward,,1,180,75\nBad,Row,2099-01-01,Football,Forward,,2,180,75\n"
    result = client.post("/api/athletes/import/", {"file": SimpleUploadedFile("bad.csv", bad_csv)}, format="multipart")
    assert result.status_code == 200 and len(result.data["errors"]) == 1
    assert Athlete.objects.count() == 0


def test_import_commits_valid_semicolon_utf8_sig(manager):
    payload = "\ufefffirst_name;last_name;birth_date;sport;position;height;weight\nИрина;Тестова;2000-02-03;Баскетбол;Защитник;180;70\n".encode("utf-8")
    result = api_client(manager).post(
        "/api/athletes/import/",
        {"file": SimpleUploadedFile("players.csv", payload)},
        format="multipart",
    )
    assert result.status_code == 200
    assert result.data == {"valid": 1, "errors": [], "imported": 1}
    athlete = Athlete.objects.get(first_name="Ирина")
    assert athlete.birth_date == date(2000, 2, 3)


def test_bulk_atomicity_and_limit(manager, athlete_factory):
    first = athlete_factory()
    second = athlete_factory()
    client = api_client(manager)
    invalid = client.post("/api/athletes/bulk/", {"ids": [first.pk, second.pk], "op": "set_status", "value": "not-a-status"}, format="json")
    assert invalid.status_code == 400
    first.refresh_from_db()
    assert first.status == Athlete.STATUS_CHOICES[0][0]
    too_many = client.post("/api/athletes/bulk/", {"ids": list(range(201)), "op": "delete"}, format="json")
    assert too_many.status_code == 400
    success = client.post("/api/athletes/bulk/", {"ids": [first.pk, 99999], "op": "set_status", "value": "Травма"}, format="json")
    assert success.data["affected"] == 1 and success.data["skipped"] == [99999]


def test_athlete_validation_and_registration_switch(manager, athlete_factory):
    athlete = athlete_factory()
    duplicate_number = athlete_factory(club=athlete.club, number=999)
    client = api_client(manager)
    assert client.patch(f"/api/athletes/{athlete.pk}/", {"birth_date": "2999-01-01"}).status_code == 400
    assert client.patch(f"/api/athletes/{athlete.pk}/", {"height": 250}).status_code == 400
    assert client.patch(f"/api/athletes/{athlete.pk}/", {"weight": 20}).status_code == 400
    assert client.patch(f"/api/athletes/{athlete.pk}/", {"number": duplicate_number.number}).status_code == 400
    with override_settings(REGISTRATION_ENABLED=False):
        response = APIClient().post("/api/auth/register/", {
            "username": "closed", "password": "GoodPass2026!", "password_confirm": "GoodPass2026!",
        }, format="json")
    assert response.status_code == 400


def test_health_docs_and_legacy_response_shape(manager):
    client = api_client(manager)
    assert APIClient().get("/api/health/").data["status"] == "ok"
    assert APIClient().get("/api/docs/").status_code == 200
    schema = APIClient().get("/api/schema/").data
    assert "/api/athletes/{id}/valuation/" in schema["paths"]
    assert "/api/clubs/{id}/balance/" in schema["paths"]
    assert "/api/events/calendar.ics/" in schema["paths"]
    assert client.get("/api/athletes/").status_code == 200
    assert isinstance(client.get("/api/athletes/").data, list)
    assert client.get("/api/athletes/?page=1").data.keys() == {"count", "next", "previous", "results"}
    assert client.get("/api/dashboard/").status_code == 200
    assert client.get("/api/analytics/").status_code == 200


def test_athlete_list_query_count(manager, athlete_factory, django_assert_num_queries):
    athlete_factory()
    client = api_client(manager)
    with django_assert_num_queries(2):
        response = client.get("/api/athletes/")
    assert response.status_code == 200
