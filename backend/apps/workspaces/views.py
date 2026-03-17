from rest_framework import viewsets

from apps.common.services import apply_tenant_scope, is_super_admin
from apps.workspaces.filters import WorkspaceFilter
from apps.workspaces.models import Workspace
from apps.workspaces.permissions import WorkspacePermission
from apps.workspaces.serializers import WorkspaceSerializer


class WorkspaceViewSet(viewsets.ModelViewSet):
    serializer_class = WorkspaceSerializer
    permission_classes = [WorkspacePermission]
    filterset_class = WorkspaceFilter
    search_fields = ['name', 'external_workspace_id']
    ordering_fields = ['name', 'status', 'last_sync_at', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        queryset = Workspace.objects.select_related('tenant')
        return apply_tenant_scope(queryset, self.request.user)

    def perform_create(self, serializer):
        if not is_super_admin(self.request.user):
            serializer.save(tenant=self.request.user.tenant)
            return
        serializer.save()


