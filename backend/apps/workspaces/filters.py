import django_filters

from apps.workspaces.models import Workspace


class WorkspaceFilter(django_filters.FilterSet):
    tenant = django_filters.UUIDFilter(field_name='tenant_id')
    status = django_filters.CharFilter(field_name='status')
    name = django_filters.CharFilter(field_name='name', lookup_expr='icontains')

    class Meta:
        model = Workspace
        fields = ['tenant', 'status', 'name', 'external_workspace_id']

