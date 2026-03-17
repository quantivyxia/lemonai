"""Application services for common app."""

from __future__ import annotations

from django.db.models import QuerySet


SUPER_ADMIN = 'super_admin'
ANALYST = 'analyst'
VIEWER = 'viewer'
SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')


def get_user_role_code(user) -> str | None:
    if not getattr(user, 'is_authenticated', False):
        return None
    role = getattr(user, 'role', None)
    return getattr(role, 'code', None)


def is_super_admin(user) -> bool:
    return get_user_role_code(user) == SUPER_ADMIN or getattr(user, 'is_superuser', False)


def is_analyst(user) -> bool:
    return get_user_role_code(user) == ANALYST


def is_viewer(user) -> bool:
    return get_user_role_code(user) == VIEWER


def get_actor_user(request):
    actor_user = getattr(request, 'actor_user', None)
    if actor_user and getattr(actor_user, 'is_authenticated', False):
        return actor_user
    user = getattr(request, 'user', None)
    if user and getattr(user, 'is_authenticated', False):
        return user
    return actor_user or user


def get_effective_user(request):
    effective_user = getattr(request, 'effective_user', None)
    if effective_user and getattr(effective_user, 'is_authenticated', False):
        return effective_user
    user = getattr(request, 'user', None)
    if user and getattr(user, 'is_authenticated', False):
        return user
    return effective_user or user


def is_view_as_mode(request) -> bool:
    return bool(getattr(request, 'view_as_mode', False))


def can_actor_view_as_target(actor, target) -> bool:
    if not actor or not getattr(actor, 'is_authenticated', False):
        return False

    if not target or not getattr(target, 'is_authenticated', True):
        return False

    if is_super_admin(actor):
        return True

    if is_analyst(actor):
        return bool(actor.tenant_id and actor.tenant_id == getattr(target, 'tenant_id', None))

    return False


def apply_tenant_scope(queryset: QuerySet, user, tenant_field: str = 'tenant') -> QuerySet:
    if is_super_admin(user):
        return queryset

    tenant_id = getattr(user, 'tenant_id', None)
    if not tenant_id:
        return queryset.none()

    lookup_field = tenant_field
    if tenant_field not in ('id', 'pk') and not tenant_field.endswith('_id'):
        lookup_field = f'{tenant_field}_id'

    return queryset.filter(**{lookup_field: tenant_id})


def enforce_same_tenant(user, tenant_id) -> bool:
    if is_super_admin(user):
        return True
    return bool(tenant_id and tenant_id == getattr(user, 'tenant_id', None))
