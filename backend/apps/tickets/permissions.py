from rest_framework.permissions import BasePermission

from apps.common.services import get_actor_user, is_analyst, is_super_admin


def can_access_ticket(user, ticket) -> bool:
    if not user or not user.is_authenticated:
        return False
    if is_super_admin(user):
        return True
    if is_analyst(user):
        return getattr(ticket, 'requester_id', None) == getattr(user, 'id', None)
    return False


class TicketPermission(BasePermission):
    def has_permission(self, request, view):
        user = get_actor_user(request)
        if not (user and user.is_authenticated):
            return False
        return is_super_admin(user) or is_analyst(user)

    def has_object_permission(self, request, view, obj):
        user = get_actor_user(request)
        if request.method == 'DELETE':
            return bool(user and user.is_authenticated and is_super_admin(user))
        return can_access_ticket(user, obj)


class TicketNotificationPermission(BasePermission):
    def has_permission(self, request, view):
        user = get_actor_user(request)
        return bool(user and user.is_authenticated and is_analyst(user))
