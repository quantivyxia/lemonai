import django_filters

from apps.audit.models import AccessLog, SystemEventLog


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


class SystemEventLogFilter(django_filters.FilterSet):
    tenant = django_filters.UUIDFilter(field_name='tenant_id')
    user = django_filters.UUIDFilter(field_name='user_id')
    category = django_filters.CharFilter(field_name='category')
    level = django_filters.CharFilter(field_name='level')
    action = django_filters.CharFilter(field_name='action', lookup_expr='icontains')
    created_from = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_to = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')

    class Meta:
        model = SystemEventLog
        fields = ['tenant', 'user', 'category', 'level', 'action', 'created_from', 'created_to']

