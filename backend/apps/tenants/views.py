from rest_framework import viewsets
from django.db.models import Count

from apps.common.services import apply_tenant_scope
from apps.tenants.filters import TenantFilter
from apps.tenants.models import Tenant
from apps.tenants.permissions import TenantPermission
from apps.tenants.serializers import TenantSerializer


class TenantViewSet(viewsets.ModelViewSet):
    serializer_class = TenantSerializer
    permission_classes = [TenantPermission]
    filterset_class = TenantFilter
    search_fields = ['name']
    ordering_fields = ['name', 'status', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        queryset = Tenant.objects.annotate(
            users_count=Count('users', distinct=True),
            dashboards_count=Count('dashboards', distinct=True),
            workspaces_count=Count('workspaces', distinct=True),
        )
        return apply_tenant_scope(queryset, self.request.user, tenant_field='id')

