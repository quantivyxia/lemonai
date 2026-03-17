import django_filters

from apps.tenants.models import Tenant


class TenantFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(field_name='status')
    name = django_filters.CharFilter(field_name='name', lookup_expr='icontains')

    class Meta:
        model = Tenant
        fields = ['status', 'name', 'max_users', 'max_dashboards']

