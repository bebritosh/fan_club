import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from api.models import Athlete, Club

MOJIBAKE_MARKERS = ("\u0420\u203a", "\u0420\u0455\u0420", "\u00d0")


class Command(BaseCommand):
    help = "Verify imported database content against real_data.json."

    def handle(self, *args, **options):
        source = Path(settings.BASE_DIR) / "data" / "real_data.json"
        payload = json.loads(source.read_text(encoding="utf-8"))
        clubs_data = payload["clubs"]
        athletes_data = payload["athletes"]
        errors = []

        expected_sports = Counter(item["sport"] for item in athletes_data)
        actual_sports = Counter(Athlete.objects.values_list("sport", flat=True))
        expected_dict = dict(expected_sports)
        actual_dict = dict(actual_sports)
        expected_keys = set(expected_dict)
        actual_keys = set(actual_dict)
        self.stdout.write(f"expected_sports_ascii={expected_dict!a}")
        self.stdout.write(f"actual_sports_ascii={actual_dict!a}")
        for key in sorted(expected_keys - actual_keys, key=ascii):
            self.stdout.write(f"missing_in_database_key={key!a}")
        for key in sorted(actual_keys - expected_keys, key=ascii):
            self.stdout.write(f"unexpected_database_key={key!a}")
        for key in sorted(expected_keys & actual_keys, key=ascii):
            if expected_dict[key] != actual_dict[key]:
                self.stdout.write(
                    f"count_mismatch_key={key!a} expected={expected_dict[key]} "
                    f"actual={actual_dict[key]}"
                )

        club_samples = []
        for item in clubs_data[:5]:
            club = Club.objects.filter(name=item["name"]).first()
            actual = {"name": club.name, "league": club.league} if club else None
            expected = {"name": item["name"], "league": item["league"]}
            matches = actual == expected
            club_samples.append({"expected": expected, "actual": actual, "matches": matches})
            if not matches:
                errors.append(f"Club mismatch: {item['name']!r}")

        athlete_samples = []
        for item in athletes_data[:10]:
            parts = item["full_name"].split()
            first_name, last_name = ("", parts[0]) if len(parts) == 1 else (parts[0], " ".join(parts[1:]))
            athlete = Athlete.objects.filter(
                first_name=first_name,
                last_name=last_name,
                birth_date=date.fromisoformat(item["birth_date"]),
            ).first()
            actual = {
                "full_name": athlete.full_name,
                "sport": athlete.sport,
                "position": athlete.position,
            } if athlete else None
            expected = {
                "full_name": item["full_name"],
                "sport": item["sport"],
                "position": item["position"],
            }
            matches = actual == expected
            athlete_samples.append({"expected": expected, "actual": actual, "matches": matches})
            if not matches:
                errors.append(f"Athlete mismatch: {item['full_name']!r}")

        self.stdout.write(
            json.dumps(
                {"club_samples": club_samples, "athlete_samples": athlete_samples},
                ensure_ascii=True,
                indent=2,
            )
        )

        choice_violations = defaultdict(list)
        choice_counts = Counter()
        for field in Athlete._meta.fields:
            if not field.choices:
                continue
            allowed_values = {value for value, _label in field.flatchoices}
            for athlete in Athlete.objects.all().only(
                "id", "first_name", "last_name", "middle_name", field.name
            ):
                value = getattr(athlete, field.attname)
                if value not in allowed_values:
                    choice_counts[field.name] += 1
                    if len(choice_violations[field.name]) < 3:
                        choice_violations[field.name].append(
                            {
                                "id": athlete.pk,
                                "full_name": athlete.full_name,
                                "value": value,
                            }
                        )
        choice_report = {
            field.name: {
                "violations": choice_counts[field.name],
                "examples": choice_violations[field.name],
            }
            for field in Athlete._meta.fields
            if field.choices
        }
        self.stdout.write(
            "choice_violations="
            + json.dumps(choice_report, ensure_ascii=True, indent=2)
        )
        if any(choice_counts.values()):
            errors.append("Athlete values violate model choices.")

        strings = []
        for club in Club.objects.all().only("name", "league"):
            strings.extend((club.name, club.league))
        for athlete in Athlete.objects.all().only(
            "first_name", "last_name", "middle_name", "sport", "position"
        ):
            strings.extend(
                (
                    athlete.first_name,
                    athlete.last_name,
                    athlete.middle_name,
                    athlete.full_name,
                    athlete.sport,
                    athlete.position,
                )
            )
        mojibake = [
            value for value in strings
            if any(marker in value for marker in MOJIBAKE_MARKERS)
        ]
        manager = get_user_model().objects.filter(username="manager").first()
        totals = {
            "clubs": Club.objects.count(),
            "athletes": Athlete.objects.count(),
            "sports": actual_dict,
            "expected_sports_match": expected_dict == actual_dict,
            "mojibake_count": len(mojibake),
            "mojibake_examples": mojibake[:20],
            "manager_exists": bool(manager),
            "manager_is_staff": manager.is_staff if manager else None,
            "manager_is_superuser": manager.is_superuser if manager else None,
        }
        self.stdout.write(json.dumps(totals, ensure_ascii=True, indent=2))

        if totals["clubs"] != 37 or totals["athletes"] != 232:
            errors.append("Database totals differ from expected values.")
        if expected_dict != actual_dict:
            errors.append("Sport distribution differs from real_data.json.")
        if mojibake:
            errors.append(f"Found mojibake strings: {len(mojibake)}.")
        if not manager or not manager.is_staff or manager.is_superuser:
            errors.append("Manager flags are incorrect.")
        if errors:
            raise CommandError("\n".join(errors))
