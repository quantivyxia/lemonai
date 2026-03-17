"""Application services for permissions app."""

from __future__ import annotations

from collections import defaultdict
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


def build_user_rls_embed_payload(user, dashboard, rls_context: list[dict] | None = None) -> dict:
    """
    Gera payload RLS padronizado para embed token.

    Estrutura:
    - rules: formato legivel para auditoria/debug.
    - tokenString: formato compacto pensado para uso em DAX com CUSTOMDATA().
      Tokens:
      - `a:<coluna>:<valor>` para allow
      - `d:<coluna>:<valor>` para deny
    """
    context = rls_context if rls_context is not None else get_user_rls_context(user, dashboard)
    grouped: dict[tuple[str, str], dict[str, set[str]]] = defaultdict(lambda: {'allow': set(), 'deny': set()})

    for rule in context:
        table_name = str(rule.get('tableName', '')).strip()
        column_name = str(rule.get('columnName', '')).strip()
        rule_type = str(rule.get('ruleType', '')).strip().lower()
        values = rule.get('values') or []
        if not column_name or rule_type not in ('allow', 'deny'):
            continue

        target = grouped[(table_name, column_name)][rule_type]
        for raw_value in values:
            text = str(raw_value).strip()
            if text:
                target.add(text)

    rules = []
    token_parts = [
        'v1',
        f'uid:{getattr(user, "id", "")}',
        f'tid:{getattr(user, "tenant_id", "")}',
        f'did:{getattr(dashboard, "id", "")}',
    ]

    for table_name, column_name in sorted(grouped.keys(), key=lambda key: f'{key[0]}.{key[1]}'.lower()):
        deny_values = grouped[(table_name, column_name)]['deny']
        allow_values = grouped[(table_name, column_name)]['allow'] - deny_values

        allow_sorted = sorted(allow_values, key=str.lower)
        deny_sorted = sorted(deny_values, key=str.lower)
        operator = 'not_in' if deny_sorted and not allow_sorted else 'in'

        rules.append(
            {
                'tableName': table_name,
                'columnName': column_name,
                'allow': allow_sorted,
                'deny': deny_sorted,
                'operator': operator,
            }
        )

        normalized_table = _normalize_rls_token_part(table_name or 'default')
        normalized_column = _normalize_rls_token_part(column_name)
        for value in allow_sorted:
            token_parts.append(f'a:{normalized_table}:{normalized_column}:{_normalize_rls_token_part(value)}')
        for value in deny_sorted:
            token_parts.append(f'd:{normalized_table}:{normalized_column}:{_normalize_rls_token_part(value)}')

    return {
        'version': 1,
        'userId': str(getattr(user, 'id', '')),
        'userEmail': str(getattr(user, 'email', '')),
        'tenantId': str(getattr(user, 'tenant_id', '')),
        'dashboardId': str(getattr(dashboard, 'id', '')),
        'rules': rules,
        'tokenString': '|'.join(token_parts),
    }


def _normalize_rls_token_part(value: str) -> str:
    text = str(value).strip().lower()
    text = text.replace('|', ' ')
    text = text.replace(':', ' ')
    return ' '.join(text.split())


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
