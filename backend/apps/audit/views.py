from rest_framework import viewsets

from apps.audit.filters import AccessLogFilter, SystemEventLogFilter
from apps.audit.models import AccessLog, SystemEventLog
from apps.audit.permissions import AuditReadPermission, SystemEventReadPermission
from apps.audit.serializers import AccessLogSerializer, SystemEventLogSerializer
from apps.common.services import apply_tenant_scope, is_viewer


class AccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AccessLogSerializer
    permission_classes = [AuditReadPermission]
    filterset_class = AccessLogFilter
    search_fields = ['user__first_name', 'user__last_name', 'dashboard__name', 'ip_address', 'details']
    ordering_fields = ['accessed_at', 'status', 'origin']
    ordering = ['-accessed_at']

    def get_queryset(self):
        queryset = AccessLog.objects.select_related('user', 'tenant', 'dashboard')
        queryset = apply_tenant_scope(queryset, self.request.user)
        if is_viewer(self.request.user):
            return queryset.none()
        return queryset


class SystemEventLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SystemEventLogSerializer
    permission_classes = [SystemEventReadPermission]
    filterset_class = SystemEventLogFilter
    search_fields = ['action', 'message', 'endpoint', 'request_id', 'resource_type', 'resource_id']
    ordering_fields = ['created_at', 'level', 'category', 'status_code']
    ordering = ['-created_at']

    def get_queryset(self):
        return SystemEventLog.objects.select_related('user', 'tenant')

