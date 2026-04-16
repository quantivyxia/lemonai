from datetime import timedelta

from django.db import connection
from django.db.models import Count, Prefetch, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AccessLog, SystemEventLog
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
        last_7_days = timezone.now() - timedelta(days=7)
        queryset = Dashboard.objects.select_related('tenant', 'workspace').annotate(
            views_7d=Count(
                'access_logs',
                filter=Q(access_logs__status='success', access_logs__accessed_at__gte=last_7_days),
                distinct=True,
            ),
        ).order_by('name')
        queryset = apply_tenant_scope(queryset, user)
        if is_super_admin(user):
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
        queryset = queryset.filter(dashboard__tenant_id=user.tenant_id)
        accessible_ids = get_user_accessible_dashboard_ids(user)
        if accessible_ids is None:
            return queryset
        if not accessible_ids:
            return queryset.none()
        return queryset.filter(dashboard_id__in=accessible_ids)

    def _get_groups(self, user):
        queryset = UserGroup.objects.select_related('tenant').annotate(
            members_count=Count('members', distinct=True),
            dashboards_count=Count('dashboards', distinct=True),
        ).prefetch_related(
            Prefetch('members', queryset=User.objects.only('id', 'first_name', 'last_name').order_by('first_name', 'last_name')),
            Prefetch('dashboards', queryset=Dashboard.objects.only('id', 'name').order_by('name')),
        ).order_by('name')
        queryset = apply_tenant_scope(queryset, user)
        if is_viewer(user):
            return queryset.filter(members=user)
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
            'groups': UserGroupSerializer(self._get_groups(user), many=True, context={'request': request}).data,
            'brandings': ClientBrandingSerializer(self._get_brandings(user), many=True, context={'request': request}).data,
            'rls_rules': RLSRuleSerializer(self._get_rls_rules(user), many=True, context={'request': request}).data,
            'roles': RoleSerializer(self._get_roles(user), many=True, context={'request': request}).data,
        }
        return Response(payload)


class DashboardHomeInsightsView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_access_logs_queryset(self, user):
        queryset = AccessLog.objects.select_related('user', 'tenant', 'dashboard').filter(status='success')
        queryset = apply_tenant_scope(queryset, user)
        if is_viewer(user):
            queryset = queryset.filter(user=user)
        return queryset

    def _get_system_events_queryset(self, user):
        if is_viewer(user):
            return SystemEventLog.objects.none()
        queryset = SystemEventLog.objects.select_related('user', 'tenant').order_by('-created_at')
        return apply_tenant_scope(queryset, user)

    def _build_access_series(self, user):
        now = timezone.now()
        start_date = timezone.localdate(now - timedelta(days=6))
        series_dates = [
            start_date + timedelta(days=index)
            for index in range(7)
        ]
        queryset = self._get_access_logs_queryset(user).filter(accessed_at__date__gte=start_date)
        rows = queryset.annotate(day=TruncDate('accessed_at')).values('day').annotate(accesses=Count('id')).order_by('day')
        counts_by_date = {row['day']: row['accesses'] for row in rows}
        return [
            {
                'date': day.isoformat(),
                'accesses': counts_by_date.get(day, 0),
            }
            for day in series_dates
        ]

    def _serialize_access_activity(self, log):
        return {
            'id': f'access-{log.id}',
            'tenantId': str(log.tenant_id),
            'title': 'Dashboard visualizado',
            'description': f'{getattr(log.user, "full_name", "") or "Usuario"} abriu {getattr(log.dashboard, "name", "dashboard")}.',
            'timestamp': log.accessed_at.isoformat(),
        }

    def _serialize_system_activity(self, event):
        endpoint = event.endpoint or 'acao interna'
        action = event.action or 'Evento administrativo'
        return {
            'id': f'event-{event.id}',
            'tenantId': str(event.tenant_id or ''),
            'title': action,
            'description': event.message or f'Operacao administrativa executada em {endpoint}.',
            'timestamp': event.created_at.isoformat(),
        }

    def _build_recent_activities(self, user):
        access_logs = list(self._get_access_logs_queryset(user).order_by('-accessed_at')[:8])
        activities = [self._serialize_access_activity(log) for log in access_logs]

        if not is_viewer(user):
            system_events = list(self._get_system_events_queryset(user)[:6])
            activities.extend(self._serialize_system_activity(event) for event in system_events)

        activities.sort(key=lambda item: item['timestamp'], reverse=True)
        return activities[:10]

    def get(self, request):
        payload = {
            'request_id': get_request_id(),
            'access_series': self._build_access_series(request.user),
            'activities': self._build_recent_activities(request.user),
        }
        return Response(payload)
