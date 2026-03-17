from rest_framework import serializers

from apps.common.services import enforce_same_tenant
from apps.dashboards.models import Dashboard, DashboardColumn


class DashboardColumnSerializer(serializers.ModelSerializer):
    dashboard_name = serializers.CharField(source='dashboard.name', read_only=True)

    class Meta:
        model = DashboardColumn
        fields = ['id', 'dashboard', 'dashboard_name', 'name', 'label', 'values', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class DashboardSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    workspace_name = serializers.CharField(source='workspace.name', read_only=True)
    columns = DashboardColumnSerializer(many=True, read_only=True)

    class Meta:
        model = Dashboard
        fields = [
            'id',
            'tenant',
            'tenant_name',
            'workspace',
            'workspace_name',
            'name',
            'description',
            'category',
            'status',
            'embed_url',
            'report_id',
            'dataset_id',
            'external_workspace_id',
            'thumbnail_url',
            'last_sync_at',
            'refresh_schedule',
            'tags',
            'columns',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'tenant': {'required': False},
        }

    def validate(self, attrs):
        request = self.context.get('request')
        tenant = attrs.get('tenant') or getattr(self.instance, 'tenant', None)
        workspace = attrs.get('workspace') or getattr(self.instance, 'workspace', None)

        if request and tenant and not enforce_same_tenant(request.user, tenant.id):
            raise serializers.ValidationError({'tenant': 'Operacao permitida apenas no tenant do usuario logado.'})

        if tenant and workspace and workspace.tenant_id != tenant.id:
            raise serializers.ValidationError({'workspace': 'Workspace deve pertencer ao mesmo tenant do dashboard.'})

        if self.instance is None and tenant:
            tenant_dashboards_count = Dashboard.objects.filter(tenant_id=tenant.id).count()
            if tenant_dashboards_count >= tenant.max_dashboards:
                raise serializers.ValidationError(
                    {
                        'tenant': (
                            f'Limite de dashboards deste tenant atingido '
                            f'({tenant_dashboards_count}/{tenant.max_dashboards}). '
                            'Aumente o limite para cadastrar novos dashboards.'
                        )
                    }
                )

        return attrs

