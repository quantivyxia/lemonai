from rest_framework.permissions import BasePermission

from apps.common.services import get_actor_user, is_analyst, is_super_admin


class BrandingPermission(BasePermission):
    def has_permission(self, request, view):
        user = get_actor_user(request)
        if not (user and user.is_authenticated):
            return False

        return is_super_admin(user) or is_analyst(user)

