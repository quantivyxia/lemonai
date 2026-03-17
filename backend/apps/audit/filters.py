import django_filters

from apps.audit.models import AccessLog


class AccessLogFilter(django_filters.FilterSet):
    tenant = django_filters.UUIDFilter(field_name='tenant_id')
    user = django_filters.UUIDFilter(field_name='user_id')
    dashboard = django_filters.UUIDFilter(field_name='dashboard_id')
    status = django_filters.CharFilter(field_name='status')
    origin = django_filters.CharFilter(field_name='origin')
    accessed_from = django_filters.DateTimeFilter(field_name='accessed_at', lookup_expr='gte')
    accessed_to = django_filters.DateTimeFilter(field_name='accessed_at', lookup_expr='lte')

    class Meta:
        model = AccessLog
        fields = ['tenant', 'user', 'dashboard', 'status', 'origin', 'accessed_from', 'accessed_to']

