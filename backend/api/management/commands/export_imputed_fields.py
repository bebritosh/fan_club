import csv
import json
from collections import Counter
from datetime import date
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from api.models import Athlete


class Command(BaseCommand):
    help = "Export values filled from model defaults for nullable source fields."

    fields = ("height", "weight", "number")
    columns = ("full_name", "birth_date", "sport", "club", "field", "value")

    def handle(self, *args, **options):
        source = Path(settings.BASE_DIR) / "data" / "real_data.json"
        target = Path(settings.BASE_DIR) / "data" / "imputed_fields.csv"
        try:
            payload = json.loads(source.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise CommandError(f"Cannot read {source}: {exc}") from exc

        counts = Counter()
        rows = []
        for row_number, item in enumerate(payload.get("athletes", []), start=1):
            full_name = item.get("full_name", "")
            parts = full_name.split()
            if len(parts) == 1:
                first_name, last_name = "", parts[0]
            else:
                first_name, last_name = parts[0], " ".join(parts[1:])
            try:
                birth_date = date.fromisoformat(item["birth_date"])
                athlete = Athlete.objects.get(
                    first_name=first_name,
                    last_name=last_name,
                    birth_date=birth_date,
                )
            except (KeyError, TypeError, ValueError, Athlete.DoesNotExist, Athlete.MultipleObjectsReturned) as exc:
                raise CommandError(
                    f"Athlete row {row_number} ({full_name!r}) cannot be matched: {exc}"
                ) from exc

            for field in self.fields:
                if item.get(field) is None:
                    rows.append(
                        {
                            "full_name": athlete.full_name,
                            "birth_date": athlete.birth_date.isoformat(),
                            "sport": athlete.sport,
                            "club": athlete.club.name if athlete.club else "",
                            "field": field,
                            "value": getattr(athlete, field),
                        }
                    )
                    counts[field] += 1

        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", encoding="utf-8-sig", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=self.columns, lineterminator="\r\n")
            writer.writeheader()
            writer.writerows(rows)

        self.stdout.write(f"CSV: {target}")
        for field in self.fields:
            self.stdout.write(f"{field}: {counts[field]}")
        self.stdout.write(f"total_rows: {len(rows)}")
