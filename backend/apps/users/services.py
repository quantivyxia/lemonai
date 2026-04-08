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


def sync_user_dashboard_overrides(
    user,
    allowed_dashboard_ids: list[str] | None,
    blocked_dashboard_ids: list[str] | None,
) -> None:
    """
    Sincroniza as regras de dashboard por usuario.

    - is_active=True  => dashboard concedido diretamente
    - is_active=False => dashboard bloqueado explicitamente
    """
    if allowed_dashboard_ids is None and blocked_dashboard_ids is None:
        return

    desired_allowed_ids = set(allowed_dashboard_ids or [])
    desired_blocked_ids = set(blocked_dashboard_ids or [])

    if desired_allowed_ids & desired_blocked_ids:
        raise ValueError('O mesmo dashboard nao pode ser concedido e bloqueado ao mesmo tempo.')

    desired_dashboard_ids = desired_allowed_ids | desired_blocked_ids
    existing_rules = DashboardAccess.objects.filter(user=user)
    existing_by_dashboard_id = {str(rule.dashboard_id): rule for rule in existing_rules}

    rules_to_delete = existing_rules.exclude(dashboard_id__in=desired_dashboard_ids)
    if rules_to_delete.exists():
        rules_to_delete.delete()

    for dashboard_id in desired_dashboard_ids:
        desired_is_active = dashboard_id in desired_allowed_ids
        existing_rule = existing_by_dashboard_id.get(dashboard_id)

        if existing_rule is None:
            DashboardAccess.objects.create(
                tenant=user.tenant,
                dashboard_id=dashboard_id,
                user=user,
                group=None,
                role=None,
                access_level=AccessLevel.VIEW,
                is_active=desired_is_active,
            )
            continue

        updates = []
        if existing_rule.tenant_id != user.tenant_id:
            existing_rule.tenant = user.tenant
            updates.append('tenant')
        if existing_rule.access_level != AccessLevel.VIEW:
            existing_rule.access_level = AccessLevel.VIEW
            updates.append('access_level')
        if existing_rule.is_active != desired_is_active:
            existing_rule.is_active = desired_is_active
            updates.append('is_active')

        if updates:
            existing_rule.save(update_fields=[*updates, 'updated_at'])


def sync_user_direct_dashboard_access(user, dashboard_ids: list[str] | None) -> None:
    """
    Compatibilidade com o fluxo legado: dashboards diretos ativos, sem bloqueios.
    """
    sync_user_dashboard_overrides(user, dashboard_ids, [])
