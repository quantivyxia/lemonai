from rest_framework.permissions import BasePermission

from apps.common.services import get_actor_user, is_analyst, is_super_admin


class RoleReadPermission(BasePermission):
    def has_permission(self, request, view):
        user = get_actor_user(request)
        if not (user and user.is_authenticated):
            return False
        if is_super_admin(user) or is_analyst(user):
            return request.method in ('GET', 'HEAD', 'OPTIONS')
        return False


class DashboardAccessPermission(BasePermission):
    def has_permission(self, request, view):
        user = get_actor_user(request)
        if not (user and user.is_authenticated):
            return False
        return is_super_admin(user) or is_analyst(user)


class RLSRulePermission(BasePermission):
    def has_permission(self, request, view):
        user = get_actor_user(request)
        if not (user and user.is_authenticated):
            return False
        return is_super_admin(user) or is_analyst(user)


class RolePermissionManagePermission(BasePermission):
    def has_permission(self, request, view):
        user = get_actor_user(request)
        if not (user and user.is_authenticated):
            return False
        return is_super_admin(user)

