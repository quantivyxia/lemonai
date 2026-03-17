import django_filters

from apps.dashboards.models import Dashboard, DashboardColumn


class DashboardFilter(django_filters.FilterSet):
    tenant = django_filters.UUIDFilter(field_name='tenant_id')
    workspace = django_filters.UUIDFilter(field_name='workspace_id')
    status = django_filters.CharFilter(field_name='status')
    category = django_filters.CharFilter(field_name='category', lookup_expr='icontains')

    class Meta:
        model = Dashboard
        fields = ['tenant', 'workspace', 'status', 'category', 'name']


class DashboardColumnFilter(django_filters.FilterSet):
    dashboard = django_filters.UUIDFilter(field_name='dashboard_id')
    name = django_filters.CharFilter(field_name='name', lookup_expr='icontains')

    class Meta:
        model = DashboardColumn
        fields = ['dashboard', 'name']

