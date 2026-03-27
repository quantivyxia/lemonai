"""Application services for permissions app."""

from __future__ import annotations

from django.db.models import Q

from apps.common.services import is_analyst, is_super_admin
from apps.permissions.models import DashboardAccess, RLSRule


def get_user_accessible_dashboard_ids(user):
    if is_super_admin(user):
        return None

    user_role_id = getattr(user, 'role_id', None)
    group_ids = list(user.member_groups.values_list('id', flat=True))

    queryset = DashboardAccess.objects.filter(is_active=True).filter(
        Q(user=user) | Q(group_id__in=group_ids) | Q(role_id=user_role_id)
    )
    return list(queryset.values_list('dashboard_id', flat=True).distinct())


def has_dashboard_access(user, dashboard) -> bool:
    if is_super_admin(user):
        return True

    if not user.tenant_id or user.tenant_id != dashboard.tenant_id:
        return False
    if is_analyst(user):
        return True

    dashboard_ids = get_user_accessible_dashboard_ids(user)
    return dashboard_ids is None or dashboard.id in dashboard_ids


def get_user_rls_context(user, dashboard):
    rules = RLSRule.objects.filter(
        tenant_id=dashboard.tenant_id,
        dashboard=dashboard,
        user=user,
        is_active=True,
    ).order_by('column_name')

    return [
        {
            'tableName': rule.table_name,
            'columnName': rule.column_name,
            'operator': rule.operator,
            'ruleType': rule.rule_type,
            'values': rule.values,
        }
        for rule in rules
    ]


def build_user_report_filters(user, dashboard, rls_context: list[dict] | None = None) -> list[dict]:
    """
    Constrói filtros de relatorio para aplicar em "todas as paginas" no embed.
    """
    context = rls_context if rls_context is not None else get_user_rls_context(user, dashboard)
    filters: list[dict] = []

    for rule in context:
        table_name = str(rule.get('tableName', '')).strip()
        column_name = str(rule.get('columnName', '')).strip()
        values = rule.get('values') or []
        if not table_name or not column_name or not isinstance(values, list) or not values:
            continue

        no_op = str(rule.get('operator', '')).strip().lower()
        rule_type = str(rule.get('ruleType', '')).strip().lower()
        if no_op in ('not_in', 'notin'):
            operator = 'NotIn'
        elif no_op in ('in',):
            operator = 'In'
        else:
            operator = 'NotIn' if rule_type == 'deny' else 'In'

        cleaned_values = [str(value).strip() for value in values if str(value).strip()]
        if not cleaned_values:
            continue

        filters.append(
            {
                'table': table_name,
                'column': column_name,
                'operator': operator,
                'values': cleaned_values,
            }
        )

    return filters
