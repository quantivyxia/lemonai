from rest_framework.permissions import BasePermission

from apps.common.services import get_actor_user, is_analyst, is_super_admin, is_viewer


class WorkspacePermission(BasePermission):
    def has_permission(self, request, view):
        user = get_actor_user(request)
        if not (user and user.is_authenticated):
            return False

        if is_super_admin(user) or is_analyst(user):
            return True

        if is_viewer(user):
            return request.method in ('GET', 'HEAD', 'OPTIONS')

        return False

