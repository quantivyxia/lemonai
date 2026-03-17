import django_filters

from apps.powerbi.models import PowerBIConnection, PowerBIGateway, PowerBIGatewayDataSource


class PowerBIConnectionFilter(django_filters.FilterSet):
    tenant = django_filters.UUIDFilter(field_name='tenant_id')
    is_active = django_filters.BooleanFilter(field_name='is_active')
    has_error = django_filters.BooleanFilter(method='filter_has_error')

    class Meta:
        model = PowerBIConnection
        fields = ['tenant', 'is_active', 'has_error']

    def filter_has_error(self, queryset, name, value):  # noqa: ARG002
        if value:
            return queryset.exclude(last_error='')
        return queryset.filter(last_error='')


class PowerBIGatewayFilter(django_filters.FilterSet):
    tenant = django_filters.UUIDFilter(field_name='tenant_id')
    connection = django_filters.UUIDFilter(field_name='connection_id')
    name = django_filters.CharFilter(field_name='name', lookup_expr='icontains')
    status = django_filters.CharFilter(field_name='status')

    class Meta:
        model = PowerBIGateway
        fields = ['tenant', 'connection', 'name', 'status']


class PowerBIGatewayDataSourceFilter(django_filters.FilterSet):
    gateway = django_filters.UUIDFilter(field_name='gateway_id')
    datasource_type = django_filters.CharFilter(field_name='datasource_type', lookup_expr='icontains')
    status = django_filters.CharFilter(field_name='status')

    class Meta:
        model = PowerBIGatewayDataSource
        fields = ['gateway', 'datasource_type', 'status']

