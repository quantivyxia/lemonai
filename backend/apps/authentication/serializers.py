from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.users.models import User


class MeSerializer(serializers.ModelSerializer):
    role_code = serializers.CharField(source='role.code', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    group_name = serializers.CharField(source='primary_group.name', read_only=True)

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


class InsightHubTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = 'email'

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['user_id'] = str(user.id)
        token['role'] = getattr(user.role, 'code', None)
        token['tenant_id'] = str(user.tenant_id) if user.tenant_id else None
        token['tenant_name'] = getattr(user.tenant, 'name', None)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        if self.user.status != 'active':
            raise serializers.ValidationError('Usuario inativo.')
        data['user'] = MeSerializer(self.user).data
        return data

