from rest_framework import serializers

from apps.common.services import enforce_same_tenant
from apps.workspaces.models import Workspace


class WorkspaceSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    dashboards_count = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = [
            'id',
            'tenant',
            'tenant_name',
            'name',
            'external_workspace_id',
            'status',
            'last_sync_at',
            'dashboards_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'tenant': {'required': False},
        }

    def get_dashboards_count(self, obj):
        return obj.dashboards.count()

    def validate_tenant(self, tenant):
        request = self.context.get('request')
        if request and not enforce_same_tenant(request.user, tenant.id):
            raise serializers.ValidationError('Nao e permitido criar/editar workspace em outro tenant.')
        return tenant

