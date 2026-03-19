from rest_framework import serializers

from apps.tenants.models import Tenant


class TenantSerializer(serializers.ModelSerializer):
    support_hours_total = serializers.DecimalField(max_digits=8, decimal_places=1, coerce_to_string=False)
    support_hours_consumed = serializers.DecimalField(max_digits=8, decimal_places=1, coerce_to_string=False)
    users_count = serializers.IntegerField(read_only=True)
    dashboards_count = serializers.IntegerField(read_only=True)
    workspaces_count = serializers.IntegerField(read_only=True)
    users_limit_reached = serializers.SerializerMethodField()
    dashboards_limit_reached = serializers.SerializerMethodField()
    support_hours_remaining = serializers.SerializerMethodField()
    support_limit_reached = serializers.SerializerMethodField()
    users_usage_percent = serializers.SerializerMethodField()
    dashboards_usage_percent = serializers.SerializerMethodField()
    support_usage_percent = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            'id',
            'name',
            'slug',
            'domain',
            'status',
            'max_users',
            'max_dashboards',
            'support_hours_total',
            'support_hours_consumed',
            'powerbi_workspace_id',
            'powerbi_tenant_id',
            'powerbi_client_id',
            'created_at',
            'updated_at',
            'users_count',
            'dashboards_count',
            'workspaces_count',
            'users_limit_reached',
            'dashboards_limit_reached',
            'support_hours_remaining',
            'support_limit_reached',
            'users_usage_percent',
            'dashboards_usage_percent',
            'support_usage_percent',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def _safe_percent(self, current: int, limit: int) -> int:
        if limit <= 0:
            return 100
        return min(999, int((current / limit) * 100))

    def get_users_limit_reached(self, obj):
        users_count = getattr(obj, 'users_count', None)
        if users_count is None:
            users_count = obj.users.count()
        return users_count >= obj.max_users

    def get_dashboards_limit_reached(self, obj):
        dashboards_count = getattr(obj, 'dashboards_count', None)
        if dashboards_count is None:
            dashboards_count = obj.dashboards.count()
        return dashboards_count >= obj.max_dashboards

    def get_support_hours_remaining(self, obj):
        remaining = float(obj.support_hours_total) - float(obj.support_hours_consumed)
        return round(max(remaining, 0), 1)

    def get_support_limit_reached(self, obj):
        total = float(obj.support_hours_total)
        consumed = float(obj.support_hours_consumed)
        if total <= 0:
            return consumed > 0
        return consumed >= total

    def get_users_usage_percent(self, obj):
        users_count = getattr(obj, 'users_count', None)
        if users_count is None:
            users_count = obj.users.count()
        return self._safe_percent(users_count, obj.max_users)

    def get_dashboards_usage_percent(self, obj):
        dashboards_count = getattr(obj, 'dashboards_count', None)
        if dashboards_count is None:
            dashboards_count = obj.dashboards.count()
        return self._safe_percent(dashboards_count, obj.max_dashboards)

    def get_support_usage_percent(self, obj):
        total = float(obj.support_hours_total)
        consumed = float(obj.support_hours_consumed)
        if total <= 0:
            return 100 if consumed > 0 else 0
        return min(999, int((consumed / total) * 100))

    def validate_max_users(self, value):
        if value < 1:
            raise serializers.ValidationError('O limite de usuarios deve ser maior que zero.')
        return value

    def validate_max_dashboards(self, value):
        if value < 1:
            raise serializers.ValidationError('O limite de dashboards deve ser maior que zero.')
        return value

    def validate_support_hours_total(self, value):
        if value < 0:
            raise serializers.ValidationError('As horas totais de suporte nao podem ser negativas.')
        return value

    def validate_support_hours_consumed(self, value):
        if value < 0:
            raise serializers.ValidationError('As horas consumidas de suporte nao podem ser negativas.')
        return value

