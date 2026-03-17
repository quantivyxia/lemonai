from rest_framework import serializers

from apps.common.services import enforce_same_tenant
from apps.powerbi.models import PowerBIConnection, PowerBIGateway, PowerBIGatewayDataSource


class PowerBIConnectionSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    has_client_secret = serializers.SerializerMethodField()
    client_secret = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = PowerBIConnection
        fields = [
            'id',
            'tenant',
            'tenant_name',
            'aad_tenant_id',
            'client_id',
            'client_secret',
            'has_client_secret',
            'scope',
            'api_base_url',
            'default_workspace_id',
            'is_active',
            'last_tested_at',
            'last_sync_at',
            'last_error',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'last_tested_at', 'last_sync_at', 'last_error', 'created_at', 'updated_at']
        extra_kwargs = {
            'tenant': {'required': False},
        }

    def get_has_client_secret(self, obj):
        return bool(obj.client_secret)

    def validate(self, attrs):
        request = self.context.get('request')
        tenant = attrs.get('tenant') or getattr(self.instance, 'tenant', None)
        if request and tenant and not enforce_same_tenant(request.user, tenant.id):
            raise serializers.ValidationError({'tenant': 'Operacao permitida apenas no tenant do usuario logado.'})

        if tenant:
            tenant_connection = (
                PowerBIConnection.objects.filter(tenant=tenant)
                .exclude(id=getattr(self.instance, 'id', None))
                .first()
            )
            if tenant_connection:
                raise serializers.ValidationError(
                    {
                        'tenant': (
                            f'O tenant "{tenant.name}" ja possui conexao Power BI cadastrada. '
                            'Cada tenant deve ter apenas uma conexao exclusiva.'
                        )
                    }
                )

        if not self.instance and not attrs.get('client_secret'):
            raise serializers.ValidationError(
                {'client_secret': 'Client secret e obrigatoria para criar a conexao.'},
            )

        client_id = attrs.get('client_id') or getattr(self.instance, 'client_id', '')
        if client_id:
            duplicated_client = (
                PowerBIConnection.objects.select_related('tenant')
                .filter(client_id=client_id)
                .exclude(id=getattr(self.instance, 'id', None))
                .first()
            )
            if duplicated_client:
                raise serializers.ValidationError(
                    {
                        'client_id': (
                            f'Este Client ID ja esta vinculado ao tenant "{duplicated_client.tenant.name}". '
                            'Cada tenant deve usar uma conexao/licenca Power BI exclusiva.'
                        )
                    }
                )
        return attrs

    def create(self, validated_data):
        return super().create(validated_data)

    def update(self, instance, validated_data):
        client_secret = validated_data.pop('client_secret', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if client_secret:
            instance.client_secret = client_secret
        instance.save()
        return instance


class PowerBIGatewaySerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    connection_name = serializers.CharField(source='connection.tenant.name', read_only=True)
    datasources_count = serializers.SerializerMethodField()

    class Meta:
        model = PowerBIGateway
        fields = [
            'id',
            'tenant',
            'tenant_name',
            'connection',
            'connection_name',
            'name',
            'external_gateway_id',
            'gateway_type',
            'status',
            'notes',
            'last_sync_at',
            'datasources_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'last_sync_at', 'created_at', 'updated_at']
        extra_kwargs = {
            'tenant': {'required': False},
        }

    def get_datasources_count(self, obj):
        return obj.datasources.count()

    def validate_tenant(self, tenant):
        request = self.context.get('request')
        if request and not enforce_same_tenant(request.user, tenant.id):
            raise serializers.ValidationError('Operacao permitida apenas no tenant do usuario logado.')
        return tenant

    def validate(self, attrs):
        tenant = attrs.get('tenant') or getattr(self.instance, 'tenant', None)
        connection = attrs.get('connection') or getattr(self.instance, 'connection', None)
        if tenant and connection and connection.tenant_id != tenant.id:
            raise serializers.ValidationError(
                {'connection': 'A conexao Power BI precisa pertencer ao mesmo tenant do gateway.'}
            )
        return attrs


class PowerBIGatewayDataSourceSerializer(serializers.ModelSerializer):
    gateway_name = serializers.CharField(source='gateway.name', read_only=True)
    tenant_id = serializers.CharField(source='gateway.tenant_id', read_only=True)

    class Meta:
        model = PowerBIGatewayDataSource
        fields = [
            'id',
            'gateway',
            'gateway_name',
            'tenant_id',
            'name',
            'external_datasource_id',
            'datasource_type',
            'connection_details',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_gateway(self, gateway):
        request = self.context.get('request')
        if request and not enforce_same_tenant(request.user, gateway.tenant_id):
            raise serializers.ValidationError('Operacao permitida apenas no tenant do usuario logado.')
        return gateway
