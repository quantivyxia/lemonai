from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.common.services import safe_related
from apps.users.models import User


class MeSerializer(serializers.ModelSerializer):
    role_code = serializers.SerializerMethodField()
    role_name = serializers.SerializerMethodField()
    tenant_name = serializers.SerializerMethodField()
    group_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'first_name',
            'last_name',
            'email',
            'role_code',
            'role_name',
            'tenant',
            'tenant_name',
            'primary_group',
            'group_name',
            'status',
            'avatar_url',
            'last_login',
        ]

    def get_role_code(self, obj):
        role = safe_related(obj, 'role')
        return getattr(role, 'code', None)

    def get_role_name(self, obj):
        role = safe_related(obj, 'role')
        return getattr(role, 'name', None)

    def get_tenant_name(self, obj):
        tenant = safe_related(obj, 'tenant')
        return getattr(tenant, 'name', None)

    def get_group_name(self, obj):
        group = safe_related(obj, 'primary_group')
        return getattr(group, 'name', None)


class InsightHubTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        role = safe_related(user, 'role')
        tenant = safe_related(user, 'tenant')
        token['user_id'] = str(user.id)
        token['role'] = getattr(role, 'code', None)
        token['tenant_id'] = str(user.tenant_id) if user.tenant_id else None
        token['tenant_name'] = getattr(tenant, 'name', None)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        if self.user.status != 'active':
            raise serializers.ValidationError('Usuario inativo.')
        if getattr(self.user, 'auth_provider', 'email') == 'microsoft':
            raise serializers.ValidationError(
                'Esta conta usa login com a Microsoft. Utilize o botao "Entrar com Microsoft".'
            )
        data['user'] = MeSerializer(self.user).data
        return data

