from rest_framework import viewsets

from apps.audit.filters import AccessLogFilter
from apps.audit.models import AccessLog
from apps.audit.permissions import AuditReadPermission
from apps.audit.serializers import AccessLogSerializer
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

