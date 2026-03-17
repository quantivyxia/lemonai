"""Application services for users app."""

from __future__ import annotations

from apps.permissions.models import AccessLevel, DashboardAccess


def sync_group_dashboard_access(group) -> None:
    """
    Garante que cada dashboard vinculado ao grupo tenha uma regra DashboardAccess
    do tipo principal=group.
    """
    dashboard_ids = set(group.dashboards.values_list('id', flat=True))
    existing_rules = DashboardAccess.objects.filter(group=group).select_related('dashboard')
    existing_dashboard_ids = set(existing_rules.values_list('dashboard_id', flat=True))

    rules_to_delete = existing_rules.exclude(dashboard_id__in=dashboard_ids)
    if rules_to_delete.exists():
        rules_to_delete.delete()

    missing_ids = dashboard_ids - existing_dashboard_ids
    for dashboard_id in missing_ids:
        DashboardAccess.objects.create(
            tenant=group.tenant,
            dashboard_id=dashboard_id,
            user=None,
            group=group,
            role=None,
            access_level=AccessLevel.VIEW,
            is_active=True,
        )

    # Reativa regras existentes que por qualquer motivo estejam inativas.
    existing_rules.filter(dashboard_id__in=dashboard_ids, is_active=False).update(is_active=True)


def sync_user_direct_dashboard_access(user, dashboard_ids: list[str] | None) -> None:
    """
    Sincroniza regras diretas de dashboard por usuário.
    """
    if dashboard_ids is None:
        return

    desired_ids = set(dashboard_ids)
    existing_rules = DashboardAccess.objects.filter(user=user).select_related('dashboard')
    existing_dashboard_ids = set(existing_rules.values_list('dashboard_id', flat=True))

    rules_to_delete = existing_rules.exclude(dashboard_id__in=desired_ids)
    if rules_to_delete.exists():
        rules_to_delete.delete()

    missing_ids = desired_ids - existing_dashboard_ids
    for dashboard_id in missing_ids:
        DashboardAccess.objects.create(
            tenant=user.tenant,
            dashboard_id=dashboard_id,
            user=user,
            group=None,
            role=None,
            access_level=AccessLevel.VIEW,
            is_active=True,
        )

    existing_rules.filter(dashboard_id__in=desired_ids, is_active=False).update(is_active=True)
