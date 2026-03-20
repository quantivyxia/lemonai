from django.db import connection
from django.db.models import Count, Prefetch
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AccessLog, SystemEventLog
from apps.audit.serializers import AccessLogSerializer
from apps.common.request_context import get_request_id
from apps.common.services import apply_tenant_scope, is_analyst, is_super_admin, is_viewer
from apps.dashboards.models import Dashboard, DashboardColumn
from apps.dashboards.serializers import DashboardColumnSerializer, DashboardSerializer
from apps.permissions.services import get_user_accessible_dashboard_ids
from apps.permissions.models import DashboardAccess, RLSRule, Role
from apps.permissions.serializers import RLSRuleSerializer, RoleSerializer
from apps.powerbi.models import PowerBIConnection, PowerBIGateway
from apps.branding.models import ClientBranding
from apps.branding.serializers import ClientBrandingSerializer
from apps.tenants.models import Tenant
from apps.tenants.serializers import TenantSerializer
from apps.users.models import User, UserGroup
from apps.users.serializers import UserGroupSerializer, UserSerializer
from apps.workspaces.models import Workspace
from apps.workspaces.serializers import WorkspaceSerializer


class HealthCheckView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({'status': 'ok', 'service': 'InsightHub API', 'request_id': get_request_id()})


class LiveHealthCheckView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({'status': 'alive', 'timestamp': timezone.now().isoformat(), 'request_id': get_request_id()})


class ReadyHealthCheckView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
                cursor.fetchone()
        except Exception:
            return Response(
                {'status': 'not_ready', 'database': 'unreachable', 'request_id': get_request_id()},
                status=503,
            )

        return Response({'status': 'ready', 'database': 'ok', 'request_id': get_request_id()})


class SystemSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not is_super_admin(request.user):
            return Response({'detail': 'Voce nao tem permissao para acessar este recurso.', 'request_id': get_request_id()}, status=403)

        latest_event = SystemEventLog.objects.order_by('-created_at').values('created_at', 'level', 'category', 'action').first()
        latest_access = AccessLog.objects.order_by('-accessed_at').values('accessed_at', 'status', 'origin').first()
        payload = {
            'status': 'ok',
            'request_id': get_request_id(),
            'timestamp': timezone.now().isoformat(),
            'counts': {
                'tenants': Tenant.objects.count(),
                'users': User.objects.count(),
                'dashboards': Dashboard.objects.count(),
                'workspaces': Workspace.objects.count(),
                'powerbi_connections': PowerBIConnection.objects.count(),
                'powerbi_gateways': PowerBIGateway.objects.count(),
                'access_logs': AccessLog.objects.count(),
                'system_events': SystemEventLog.objects.count(),
            },
            'powerbi': {
                'active_connections': PowerBIConnection.objects.filter(is_active=True).count(),
                'connections_with_error': PowerBIConnection.objects.exclude(last_error='').count(),
                'gateways_with_error': PowerBIGateway.objects.filter(status='error').count(),
            },
            'recent': {
                'latest_system_event': latest_event,
                'latest_access_log': latest_access,
            },
        }
        return Response(payload)


class BootstrapView(APIView):
    permission_classes = [IsAuthenticated]

    def _can_read_admin_data(self, user) -> bool:
        return is_super_admin(user) or is_analyst(user)

    def _get_tenants(self, user):
        queryset = Tenant.objects.annotate(
            users_count=Count('users', distinct=True),
            dashboards_count=Count('dashboards', distinct=True),
            workspaces_count=Count('workspaces', distinct=True),
        ).order_by('name')
        return apply_tenant_scope(queryset, user, tenant_field='id')

    def _get_users(self, user):
        if not self._can_read_admin_data(user):
            return User.objects.none()
        queryset = User.objects.select_related('tenant', 'role', 'primary_group').prefetch_related(
            Prefetch(
                'member_groups',
                queryset=UserGroup.objects.prefetch_related(
                    Prefetch('dashboards', queryset=Dashboard.objects.only('id').order_by('name'))
                ).order_by('name'),
            ),
            Prefetch(
                'dashboard_access_rules',
                queryset=DashboardAccess.objects.only('id', 'user_id', 'dashboard_id', 'is_active').order_by(),
            ),
        ).order_by('first_name', 'last_name')
        queryset = apply_tenant_scope(queryset, user)
        if is_viewer(user):
            return queryset.filter(id=user.id)
        return queryset

    def _get_workspaces(self, user):
        queryset = Workspace.objects.select_related('tenant').annotate(
            dashboards_count=Count('dashboards', distinct=True)
        ).order_by('name')
        return apply_tenant_scope(queryset, user)

    def _get_dashboards(self, user):
        queryset = Dashboard.objects.select_related('tenant', 'workspace').prefetch_related('columns').order_by('name')
        queryset = apply_tenant_scope(queryset, user)
        if is_super_admin(user) or not is_viewer(user):
            return queryset

        accessible_ids = get_user_accessible_dashboard_ids(user)
        if accessible_ids is None:
            return queryset
        if not accessible_ids:
            return queryset.none()
        return queryset.filter(id__in=accessible_ids)

    def _get_dashboard_columns(self, user):
        queryset = DashboardColumn.objects.select_related('dashboard', 'dashboard__tenant').order_by('label')
        if is_super_admin(user):
            return queryset
        return queryset.filter(dashboard__tenant_id=user.tenant_id)

    def _get_groups(self, user):
        queryset = UserGroup.objects.select_related('tenant').prefetch_related('members', 'dashboards').order_by('name')
        queryset = apply_tenant_scope(queryset, user)
        if is_viewer(user):
            return queryset.filter(members=user)
        return queryset

    def _get_access_logs(self, user):
        if not self._can_read_admin_data(user):
            return AccessLog.objects.none()
        queryset = AccessLog.objects.select_related('user', 'tenant', 'dashboard').order_by('-accessed_at')
        queryset = apply_tenant_scope(queryset, user)
        if is_viewer(user):
            return queryset.none()
        return queryset

    def _get_brandings(self, user):
        queryset = ClientBranding.objects.select_related('tenant').order_by('platform_name')
        return apply_tenant_scope(queryset, user)

    def _get_rls_rules(self, user):
        if not self._can_read_admin_data(user):
            return RLSRule.objects.none()
        queryset = RLSRule.objects.select_related('tenant', 'dashboard', 'user').order_by('-updated_at')
        return apply_tenant_scope(queryset, user)

    def _get_roles(self, user):
        if not self._can_read_admin_data(user):
            return Role.objects.none()
        return Role.objects.prefetch_related('role_permissions__permission').order_by('name')

    def get(self, request):
        user = request.user
        payload = {
            'request_id': get_request_id(),
            'tenants': TenantSerializer(self._get_tenants(user), many=True, context={'request': request}).data,
            'users': UserSerializer(self._get_users(user), many=True, context={'request': request}).data,
            'workspaces': WorkspaceSerializer(self._get_workspaces(user), many=True, context={'request': request}).data,
            'dashboards': DashboardSerializer(self._get_dashboards(user), many=True, context={'request': request}).data,
            'dashboard_columns': DashboardColumnSerializer(
                self._get_dashboard_columns(user), many=True, context={'request': request}
            ).data,
            'groups': UserGroupSerializer(self._get_groups(user), many=True, context={'request': request}).data,
            'access_logs': AccessLogSerializer(self._get_access_logs(user), many=True, context={'request': request}).data,
            'brandings': ClientBrandingSerializer(self._get_brandings(user), many=True, context={'request': request}).data,
            'rls_rules': RLSRuleSerializer(self._get_rls_rules(user), many=True, context={'request': request}).data,
            'roles': RoleSerializer(self._get_roles(user), many=True, context={'request': request}).data,
        }
        return Response(payload)
