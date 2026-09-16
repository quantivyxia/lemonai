from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.services import apply_tenant_scope, is_super_admin
from apps.permissions.filters import (
    DashboardAccessFilter,
    PermissionFilter,
    RLSRuleFilter,
    RoleFilter,
)
from apps.permissions.models import DashboardAccess, Permission, RLSRule, Role, RolePermission
from apps.permissions.permissions import (
    DashboardAccessPermission,
    RLSRulePermission,
    RolePermissionManagePermission,
    RoleReadPermission,
)
from apps.permissions.serializers import (
    DashboardAccessSerializer,
    PermissionSerializer,
    RLSRuleSerializer,
    RolePermissionSerializer,
    RoleSerializer,
)


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RoleSerializer
    permission_classes = [RoleReadPermission]
    filterset_class = RoleFilter
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'code']
    queryset = Role.objects.prefetch_related('role_permissions__permission').all()


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PermissionSerializer
    permission_classes = [RoleReadPermission]
    filterset_class = PermissionFilter
    search_fields = ['name', 'code', 'module']
    ordering_fields = ['module', 'name', 'code']
    queryset = Permission.objects.all()


class RolePermissionViewSet(viewsets.ModelViewSet):
    serializer_class = RolePermissionSerializer
    permission_classes = [RolePermissionManagePermission]
    queryset = RolePermission.objects.select_related('role', 'permission').all()
    ordering = ['role__name', 'permission__module']


class DashboardAccessViewSet(viewsets.ModelViewSet):
    serializer_class = DashboardAccessSerializer
    permission_classes = [DashboardAccessPermission]
    filterset_class = DashboardAccessFilter
    search_fields = ['dashboard__name', 'user__email', 'group__name', 'role__name']
    ordering_fields = ['created_at', 'updated_at']
    ordering = ['-updated_at']

    def get_queryset(self):
        queryset = DashboardAccess.objects.select_related('tenant', 'dashboard', 'user', 'group', 'role')
        return apply_tenant_scope(queryset, self.request.user)

    def perform_create(self, serializer):
        if not is_super_admin(self.request.user):
            serializer.save(tenant=self.request.user.tenant)
            return
        serializer.save()


class RLSRuleViewSet(viewsets.ModelViewSet):
    serializer_class = RLSRuleSerializer
    permission_classes = [RLSRulePermission]
    filterset_class = RLSRuleFilter
    search_fields = ['dashboard__name', 'user__email', 'table_name', 'column_name', 'notes']
    ordering_fields = ['updated_at', 'created_at', 'table_name', 'column_name']
    ordering = ['-updated_at']

    def get_queryset(self):
        queryset = RLSRule.objects.select_related('tenant', 'dashboard', 'user')
        return apply_tenant_scope(queryset, self.request.user)

    def perform_create(self, serializer):
        if not is_super_admin(self.request.user):
            serializer.save(tenant=self.request.user.tenant)
            return
        serializer.save()

    @action(detail=True, methods=['post'], url_path='toggle')
    def toggle(self, request, pk=None):
        rule = self.get_object()
        rule.is_active = not rule.is_active
        rule.save(update_fields=['is_active', 'updated_at'])
        return Response({'detail': 'Status da regra atualizado.', 'is_active': rule.is_active})

    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        rule = self.get_object()
        duplicated = RLSRule.objects.create(
            tenant=rule.tenant,
            dashboard=rule.dashboard,
            user=rule.user,
            table_name=rule.table_name,
            column_name=rule.column_name,
            operator=rule.operator,
            rule_type=rule.rule_type,
            values=rule.values,
            notes=rule.notes,
            is_active=False,
        )
        return Response(RLSRuleSerializer(duplicated, context={'request': request}).data)

