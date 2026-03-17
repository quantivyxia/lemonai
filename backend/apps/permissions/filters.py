import django_filters

from apps.permissions.models import DashboardAccess, Permission, RLSRule, Role


class RoleFilter(django_filters.FilterSet):
    code = django_filters.CharFilter(field_name='code')

    class Meta:
        model = Role
        fields = ['code', 'name']


class PermissionFilter(django_filters.FilterSet):
    module = django_filters.CharFilter(field_name='module')
    code = django_filters.CharFilter(field_name='code', lookup_expr='icontains')

    class Meta:
        model = Permission
        fields = ['module', 'code', 'name']


class DashboardAccessFilter(django_filters.FilterSet):
    tenant = django_filters.UUIDFilter(field_name='tenant_id')
    dashboard = django_filters.UUIDFilter(field_name='dashboard_id')
    user = django_filters.UUIDFilter(field_name='user_id')
    group = django_filters.UUIDFilter(field_name='group_id')
    role = django_filters.UUIDFilter(field_name='role_id')
    is_active = django_filters.BooleanFilter(field_name='is_active')

    class Meta:
        model = DashboardAccess
        fields = ['tenant', 'dashboard', 'user', 'group', 'role', 'is_active']


class RLSRuleFilter(django_filters.FilterSet):
    tenant = django_filters.UUIDFilter(field_name='tenant_id')
    dashboard = django_filters.UUIDFilter(field_name='dashboard_id')
    user = django_filters.UUIDFilter(field_name='user_id')
    table_name = django_filters.CharFilter(field_name='table_name', lookup_expr='icontains')
    column_name = django_filters.CharFilter(field_name='column_name', lookup_expr='icontains')
    operator = django_filters.CharFilter(field_name='operator')
    is_active = django_filters.BooleanFilter(field_name='is_active')
    rule_type = django_filters.CharFilter(field_name='rule_type')

    class Meta:
        model = RLSRule
        fields = ['tenant', 'dashboard', 'user', 'table_name', 'column_name', 'operator', 'is_active', 'rule_type']

