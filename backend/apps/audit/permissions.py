from rest_framework.permissions import BasePermission

from apps.common.services import get_actor_user, is_analyst, is_super_admin


class AuditReadPermission(BasePermission):
    def has_permission(self, request, view):
        user = get_actor_user(request)
        if not (user and user.is_authenticated):
            return False

        if not (is_super_admin(user) or is_analyst(user)):
            return False

        return request.method in ('GET', 'HEAD', 'OPTIONS')

