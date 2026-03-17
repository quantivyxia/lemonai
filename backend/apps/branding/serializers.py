from rest_framework import serializers

from apps.branding.models import ClientBranding
from apps.common.services import enforce_same_tenant


class ClientBrandingSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = ClientBranding
        fields = [
            'id',
            'tenant',
            'tenant_name',
            'platform_name',
            'logo_url',
            'favicon_url',
            'primary_color',
            'secondary_color',
            'domain',
            'custom_domain_enabled',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'tenant': {'required': False},
        }

    def validate_tenant(self, tenant):
        request = self.context.get('request')
        if request and not enforce_same_tenant(request.user, tenant.id):
            raise serializers.ValidationError('Sem permissao para alterar branding de outro tenant.')
        return tenant

