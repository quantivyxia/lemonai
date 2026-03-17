from rest_framework import serializers

from apps.common.services import enforce_same_tenant
from apps.permissions.models import DashboardAccess, Permission, RLSRule, Role, RolePermission


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'code', 'name', 'module', 'description', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class RoleSerializer(serializers.ModelSerializer):
    permission_codes = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = ['id', 'code', 'name', 'description', 'permission_codes', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_permission_codes(self, obj):
        return list(
            obj.role_permissions.select_related('permission').values_list('permission__code', flat=True)
        )


class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = ['id', 'role', 'permission', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class DashboardAccessSerializer(serializers.ModelSerializer):
    dashboard_name = serializers.CharField(source='dashboard.name', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    role_code = serializers.CharField(source='role.code', read_only=True)

    class Meta:
        model = DashboardAccess
        fields = [
            'id',
            'tenant',
            'dashboard',
            'dashboard_name',
            'user',
            'user_name',
            'group',
            'group_name',
            'role',
            'role_code',
            'access_level',
            'is_active',
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
        dashboard = attrs.get('dashboard') or getattr(self.instance, 'dashboard', None)
        user = attrs.get('user') or getattr(self.instance, 'user', None)
        group = attrs.get('group') or getattr(self.instance, 'group', None)
        role = attrs.get('role') or getattr(self.instance, 'role', None)

        principals = [user, group, role]
        selected = [item for item in principals if item is not None]
        if len(selected) != 1:
            raise serializers.ValidationError('Informe exatamente um principal: user, group ou role.')

        if tenant is None and dashboard is not None:
            tenant = dashboard.tenant
            attrs['tenant'] = tenant

        if request and tenant and not enforce_same_tenant(request.user, tenant.id):
            raise serializers.ValidationError({'tenant': 'Sem permissao para este tenant.'})

        if dashboard and tenant and dashboard.tenant_id != tenant.id:
            raise serializers.ValidationError({'dashboard': 'Dashboard deve pertencer ao tenant selecionado.'})
        if user and tenant and user.tenant_id != tenant.id:
            raise serializers.ValidationError({'user': 'Usuario deve pertencer ao tenant selecionado.'})
        if group and tenant and group.tenant_id != tenant.id:
            raise serializers.ValidationError({'group': 'Grupo deve pertencer ao tenant selecionado.'})

        return attrs


class RLSRuleSerializer(serializers.ModelSerializer):
    dashboard_name = serializers.CharField(source='dashboard.name', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    summary = serializers.SerializerMethodField()
    technical_preview = serializers.SerializerMethodField()

    class Meta:
        model = RLSRule
        fields = [
            'id',
            'tenant',
            'dashboard',
            'dashboard_name',
            'user',
            'user_name',
            'table_name',
            'column_name',
            'operator',
            'rule_type',
            'values',
            'notes',
            'is_active',
            'summary',
            'technical_preview',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'tenant': {'required': False},
        }

    def get_summary(self, obj):
        action = 'podera visualizar apenas' if obj.rule_type == 'allow' else 'nao podera visualizar'
        values = ', '.join(str(v) for v in obj.values)
        source = f'{obj.table_name}.{obj.column_name}' if obj.table_name else obj.column_name
        return (
            f'O usuario {obj.user.full_name} {action} no dashboard {obj.dashboard.name} '
            f'os registros onde {source} contem: {values}.'
        )

    def get_technical_preview(self, obj):
        escaped = ', '.join([f'"{str(value)}"' for value in obj.values])
        operator = 'NOT IN' if obj.operator == 'not_in' else 'IN'
        source = f'{obj.table_name}.{obj.column_name}' if obj.table_name else obj.column_name
        return f'{source} {operator} ({escaped})'

    def validate(self, attrs):
        request = self.context.get('request')
        tenant = attrs.get('tenant') or getattr(self.instance, 'tenant', None)
        dashboard = attrs.get('dashboard') or getattr(self.instance, 'dashboard', None)
        user = attrs.get('user') or getattr(self.instance, 'user', None)
        values = attrs.get('values') or getattr(self.instance, 'values', None)
        table_name = attrs.get('table_name')
        operator = attrs.get('operator') or getattr(self.instance, 'operator', None)
        rule_type = attrs.get('rule_type') or getattr(self.instance, 'rule_type', None)

        if tenant is None and dashboard is not None:
            tenant = dashboard.tenant
            attrs['tenant'] = tenant

        if request and tenant and not enforce_same_tenant(request.user, tenant.id):
            raise serializers.ValidationError({'tenant': 'Sem permissao para este tenant.'})

        if dashboard and tenant and dashboard.tenant_id != tenant.id:
            raise serializers.ValidationError({'dashboard': 'Dashboard deve pertencer ao tenant selecionado.'})
        if user and tenant and user.tenant_id != tenant.id:
            raise serializers.ValidationError({'user': 'Usuario deve pertencer ao tenant selecionado.'})

        if dashboard and user and dashboard.tenant_id != user.tenant_id:
            raise serializers.ValidationError('Usuario e dashboard devem pertencer ao mesmo tenant.')

        if table_name is not None:
            attrs['table_name'] = table_name.strip()
        if not (attrs.get('table_name') or getattr(self.instance, 'table_name', '').strip()):
            raise serializers.ValidationError({'table_name': 'Informe a tabela (NO_TABLE) para aplicar filtro no report.'})

        if operator == 'not_in' and rule_type != 'deny':
            attrs['rule_type'] = 'deny'
        elif operator == 'in' and rule_type != 'allow':
            attrs['rule_type'] = 'allow'

        if not isinstance(values, list) or len(values) == 0:
            raise serializers.ValidationError({'values': 'Informe ao menos um valor para a regra.'})

        return attrs

