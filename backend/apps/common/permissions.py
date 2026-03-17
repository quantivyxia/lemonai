from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.services import is_analyst, is_super_admin, is_viewer


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and is_super_admin(request.user))


class IsSuperAdminOrAnalyst(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return is_super_admin(user) or is_analyst(user)


class IsSuperAdminOrAnalystReadOnlyForViewer(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False

        if is_super_admin(user) or is_analyst(user):
            return True

        if is_viewer(user):
            return request.method in SAFE_METHODS

        return False

