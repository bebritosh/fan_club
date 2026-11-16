from rest_framework.permissions import SAFE_METHODS, BasePermission


class RoleWritePermission(BasePermission):
    """Allow reads to authenticated users and writes to configured roles."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        allowed_roles = set(getattr(view, "write_roles", ()))
        return user.groups.filter(name__in=allowed_roles).exists()


class StaffPermission(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.is_superuser)
        )
