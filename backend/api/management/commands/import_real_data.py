import json
from collections import Counter
from datetime import date
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import Athlete, Club


class ImportRowsError(Exception):
    def __init__(self, errors):
        self.errors = errors
        super().__init__("One or more records could not be imported.")


class Command(BaseCommand):
    help = "Import real clubs and athletes from a UTF-8 JSON file."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=Path,
            default=Path(settings.BASE_DIR) / "data" / "real_data.json",
            help="Path to the source JSON file.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate and count changes without writing to the database.",
        )

    def handle(self, *args, **options):
        source = options["file"]
        try:
            payload = json.loads(source.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise CommandError(f"?? ??????? ????????? ???? {source}: {exc}") from exc

        errors, clubs, athletes = self.validate_payload(payload)
        if errors:
            self.stderr.write("???????? ?????? ?? ????????; ???? ?? ????????:")
            for error in errors:
                self.stderr.write(f"- {error}")
            raise CommandError(f"??????? ??????: {len(errors)}.")

        counts_by_sport = Counter(item["sport"] for item in athletes)
        field_defaults = {
            name: Athlete._meta.get_field(name).get_default()
            for name in ("height", "weight", "number")
        }
        null_input_counts = Counter(
            {
                name: sum(item.get(name) is None for item in athletes)
                for name in ("height", "weight", "number")
            }
        )

        if options["dry_run"]:
            report = self.preview_changes(clubs, athletes)
            self.stdout.write(self.style.WARNING("DRY RUN: ?????? ? ???? ?? ???????????."))
        else:
            report = self.import_records(clubs, athletes)

        self.print_summary(
            report,
            counts_by_sport,
            field_defaults,
            null_input_counts,
            athletes,
        )

    def validate_payload(self, payload):
        errors = []
        if not isinstance(payload, dict):
            return ["???????? ???????? JSON ?????? ???? ????????."], [], []

        clubs = payload.get("clubs")
        athletes = payload.get("athletes")
        if not isinstance(clubs, list):
            errors.append("???? clubs ?????? ???? ???????.")
            clubs = []
        if not isinstance(athletes, list):
            errors.append("???? athletes ?????? ???? ???????.")
            athletes = []

        if len(clubs) != 37:
            errors.append(f"????????? 37 ??????, ???????? {len(clubs)}.")
        if len(athletes) != 232:
            errors.append(f"????????? 232 ??????????, ???????? {len(athletes)}.")

        club_names = set()
        short_names = set()
        short_name_limit = Club._meta.get_field("short_name").max_length
        for row, item in enumerate(clubs, start=1):
            if not isinstance(item, dict):
                errors.append(f"????, ?????? {row}: ???????? JSON-??????.")
                continue
            name = item.get("name")
            if not isinstance(name, str) or not name.strip():
                errors.append(f"????, ?????? {row}: name ?????? ??? ?? ???????? ???????.")
            elif name in club_names:
                errors.append(f"????, ?????? {row}: ??????????? name {name!r}.")
            else:
                club_names.add(name)

            short_name = item.get("short_name")
            if not isinstance(short_name, str) or not short_name.strip():
                errors.append(f"???? {name or row!r}: short_name ?????? ???? ????????.")
            else:
                if short_name in short_names:
                    errors.append(f"???? {name!r}: short_name {short_name!r} ?? ????????.")
                short_names.add(short_name)
                if len(short_name) > short_name_limit:
                    errors.append(
                        f"???? {name!r}: short_name ??????? max_length={short_name_limit}."
                    )
            if item.get("coach") is None:
                errors.append(f"???? {name or row!r}: coach ????? null.")

        gender_field = Athlete._meta.get_field("gender")
        allowed_genders = {value for value, _label in Athlete.GENDER_CHOICES}
        allowed_statuses = {value for value, _label in Athlete.STATUS_CHOICES}
        name_birth_pairs = set()

        for row, item in enumerate(athletes, start=1):
            if not isinstance(item, dict):
                errors.append(f"?????????, ?????? {row}: ???????? JSON-??????.")
                continue

            full_name = item.get("full_name")
            if not isinstance(full_name, str) or not full_name.strip():
                errors.append(f"?????????, ?????? {row}: full_name ?????? ??? ????????????.")
                continue

            try:
                birth_date = date.fromisoformat(item.get("birth_date"))
            except (TypeError, ValueError):
                errors.append(
                    f"????????? {full_name!r}, ?????? {row}: ???????????? birth_date "
                    f"{item.get('birth_date')!r}."
                )
                continue

            identity = (full_name, birth_date)
            if identity in name_birth_pairs:
                errors.append(
                    f"????????? {full_name!r}, ?????? {row}: ???????? full_name + birth_date."
                )
            name_birth_pairs.add(identity)

            club_name = item.get("club")
            if club_name and (
                not isinstance(club_name, str) or club_name not in club_names
            ):
                errors.append(
                    f"????????? {full_name!r}, ?????? {row}: ????? {club_name!r} ??? ? JSON."
                )

            gender = item.get("gender")
            if not isinstance(gender, str) or gender not in allowed_genders:
                errors.append(
                    f"????????? {full_name!r}, ?????? {row}: gender {gender!r} "
                    f"?? ?????? ? GENDER_CHOICES {sorted(allowed_genders)!r}."
                )
            elif len(gender) > gender_field.max_length:
                errors.append(
                    f"????????? {full_name!r}, ?????? {row}: gender {gender!r} "
                    f"????????? max_length={gender_field.max_length}."
                )

            status = item.get("status")
            if not isinstance(status, str) or status not in allowed_statuses:
                errors.append(
                    f"????????? {full_name!r}, ?????? {row}: status {status!r} "
                    f"?? ?????? ? STATUS_CHOICES {sorted(allowed_statuses)!r}."
                )

            parts = full_name.split()
            if len(parts) == 1:
                first_name, last_name = "", parts[0]
            else:
                first_name, last_name = parts[0], " ".join(parts[1:])
            athlete = Athlete(
                first_name=first_name,
                last_name=last_name,
                middle_name="",
                birth_date=birth_date,
            )
            if athlete.full_name != full_name:
                errors.append(
                    f"????????? {full_name!r}, ?????? {row}: ????? ??????? full_name "
                    f"????? {athlete.full_name!r}."
                )

        return errors, clubs, athletes

    @staticmethod
    def split_name(full_name):
        parts = full_name.split()
        if len(parts) == 1:
            return "", parts[0]
        return parts[0], " ".join(parts[1:])

    @classmethod
    def athlete_defaults(cls, item, club):
        defaults = {
            "middle_name": "",
            "gender": item["gender"],
            "sport": item["sport"],
            "position": item["position"],
            "club": club,
            "status": item["status"],
            "medical_notes": item.get("medical_notes") or "",
            "achievements": item.get("achievements") or [],
            "photo_url": item.get("photo") or "",
        }
        for field in ("height", "weight", "number"):
            if item.get(field) is not None:
                defaults[field] = item[field]
        return defaults

    def preview_changes(self, clubs, athletes):
        incoming_club_names = {item["name"] for item in clubs}
        current_club_names = set(
            Club.objects.filter(name__in=incoming_club_names).values_list("name", flat=True)
        )
        incoming_athletes = set()
        for item in athletes:
            first_name, last_name = self.split_name(item["full_name"])
            incoming_athletes.add(
                (first_name, last_name, date.fromisoformat(item["birth_date"]))
            )
        current_athletes = set(
            Athlete.objects.values_list("first_name", "last_name", "birth_date")
        )
        create_clubs = incoming_club_names - current_club_names
        update_clubs = incoming_club_names & current_club_names
        create_athletes = incoming_athletes - current_athletes
        update_athletes = incoming_athletes & current_athletes
        return {
            "created": len(create_clubs) + len(create_athletes),
            "updated": len(update_clubs) + len(update_athletes),
            "skipped": 0,
            "errors": 0,
            "created_identities": create_athletes,
        }

    def import_records(self, clubs, athletes):
        report = {
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 0,
            "created_identities": set(),
        }
        errors = []
        clubs_by_name = {}
        try:
            with transaction.atomic():
                for row, item in enumerate(clubs, start=1):
                    try:
                        with transaction.atomic():
                            club, created = Club.objects.update_or_create(
                                name=item["name"],
                                defaults={
                                    "short_name": item["short_name"],
                                    "league": item["league"],
                                    "founded": item["founded"],
                                    "color": item["color"],
                                    "coach": item["coach"],
                                },
                            )
                        clubs_by_name[item["name"]] = club
                        report["created" if created else "updated"] += 1
                    except Exception as exc:  # noqa: BLE001 - collect row errors and roll back all
                        errors.append(f"????, ?????? {row}, {item.get('name')!r}: {exc}")

                for row, item in enumerate(athletes, start=1):
                    try:
                        first_name, last_name = self.split_name(item["full_name"])
                        club_name = item.get("club")
                        club = clubs_by_name.get(club_name) if club_name else None
                        defaults = self.athlete_defaults(item, club)
                        birth_date = date.fromisoformat(item["birth_date"])
                        identity = (first_name, last_name, birth_date)
                        with transaction.atomic():
                            _athlete, created = Athlete.objects.update_or_create(
                                first_name=first_name,
                                last_name=last_name,
                                birth_date=birth_date,
                                defaults=defaults,
                            )
                        report["created" if created else "updated"] += 1
                        if created:
                            report["created_identities"].add(identity)
                    except Exception as exc:  # noqa: BLE001 - collect row errors and roll back all
                        errors.append(
                            f"?????????, ?????? {row}, {item.get('full_name')!r}: {exc}"
                        )

                if errors:
                    report["errors"] = len(errors)
                    raise ImportRowsError(errors)
                self.ensure_manager()
        except ImportRowsError as exc:
            self.stderr.write("?????? ???????; ?????????? ????????:")
            for error in exc.errors:
                self.stderr.write(f"- {error}")
            raise CommandError(f"?????? ???????: {len(exc.errors)}.") from exc
        return report

    @staticmethod
    def ensure_manager():
        user_model = get_user_model()
        manager, _created = user_model.objects.get_or_create(
            username="manager",
            defaults={"email": "manager@fanclub.local"},
        )
        manager.email = "manager@fanclub.local"
        manager.is_staff = True
        manager.is_superuser = False
        manager.set_password("FanClub2026!")
        manager.save()
        manager_group, _created = Group.objects.get_or_create(name="manager")
        manager.groups.add(manager_group)

    def print_summary(
        self,
        report,
        counts_by_sport,
        field_defaults,
        null_input_counts,
        athletes,
    ):
        self.stdout.write(
            "?????: "
            f"???????={report['created']}, ?????????={report['updated']}, "
            f"?????????={report['skipped']}, ??????={report['errors']}"
        )
        self.stdout.write("?????????? ?? ????? ??????:")
        for sport, number in sorted(counts_by_sport.items()):
            self.stdout.write(f"{sport}: {number}")

        created_identities = report.get("created_identities", set())
        self.stdout.write("Defaults height/weight/number ??? ????? ???????????:")
        for field in ("height", "weight", "number"):
            received_default = 0
            for item in athletes:
                first_name, last_name = self.split_name(item["full_name"])
                identity = (first_name, last_name, date.fromisoformat(item["birth_date"]))
                if identity in created_identities and item.get(field) is None:
                    received_default += 1
            self.stdout.write(
                f"{field}: default={field_defaults[field]!r}, "
                f"null ?? ?????={null_input_counts[field]}, ???????? default={received_default}"
            )
