import json

from django.contrib.admin.models import ADDITION, CHANGE, DELETION, LogEntry
from django.contrib.contenttypes.models import ContentType

ACTION_FLAGS = {"create": ADDITION, "update": CHANGE, "delete": DELETION}


def audit(request, obj, action, message=None):
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return None
    content_type = ContentType.objects.get_for_model(obj, for_concrete_model=False)
    flag = ACTION_FLAGS.get(action, CHANGE)
    return LogEntry.objects.create(
        user_id=user.pk,
        content_type=content_type,
        object_id=str(obj.pk),
        object_repr=str(obj)[:200],
        action_flag=flag,
        change_message=json.dumps(
            {"type": action, "message": message or ""}, ensure_ascii=False
        ),
    )
