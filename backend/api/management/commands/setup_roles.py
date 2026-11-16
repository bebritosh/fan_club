from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from api.models import Athlete, Club, Event, Transfer


class Command(BaseCommand):
    help = "Create the standard Fan Club authorization groups."

    def handle(self, *args, **options):
        role_models = {"athlete": Athlete, "club": Club, "event": Event, "transfer": Transfer}
        model_types = ContentType.objects.get_for_models(*role_models.values())
        role_permissions = {
            "manager": {"athlete": {"add", "change", "delete", "view"}, "club": {"add", "change", "delete", "view"}, "event": {"add", "change", "delete", "view"}, "transfer": {"add", "change", "delete", "view"}},
            "medic": {"athlete": {"add", "change", "view"}},
            "analyst": {model: {"view"} for model in ("athlete", "club", "event", "transfer")},
            "viewer": {model: {"view"} for model in ("athlete", "club", "event", "transfer")},
        }
        for role, models in role_permissions.items():
            group, _ = Group.objects.get_or_create(name=role)
            group.permissions.clear()
            for model_name, actions in models.items():
                content_type = model_types[role_models[model_name]]
                permissions = Permission.objects.filter(
                    content_type=content_type,
                    codename__in=[f"{action}_{model_name}" for action in actions],
                )
                group.permissions.add(*permissions)
        self.stdout.write(self.style.SUCCESS("Созданы роли: manager, medic, analyst, viewer."))
