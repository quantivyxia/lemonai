from rest_framework import serializers

from apps.audit.models import AccessLog


class AccessLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    dashboard_name = serializers.CharField(source='dashboard.name', read_only=True)

    class Meta:
        model = AccessLog
        fields = [
            'id',
            'user',
            'user_name',
            'tenant',
            'tenant_name',
            'dashboard',
            'dashboard_name',
            'ip_address',
            'accessed_at',
            'status',
            'origin',
            'details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'accessed_at', 'created_at', 'updated_at']

