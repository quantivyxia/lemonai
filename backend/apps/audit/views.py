from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.filters import AccessLogFilter, SystemEventLogFilter
from apps.audit.models import AccessLog, SystemEventLog
from apps.audit.permissions import AuditReadPermission, SystemEventReadPermission
from apps.audit.serializers import AccessLogSerializer, SystemEventLogSerializer
from apps.common.request_context import get_request_id
from apps.common.services import apply_tenant_scope, is_super_admin, is_viewer


GENERIC_EVENT_MESSAGES = {
    'Operacao administrativa executada com sucesso.',
    'Operacao administrativa retornou erro.',
}

RESOURCE_LABELS = {
    'tenants': 'tenant',
    'users': 'usuario',
    'users/groups': 'grupo',
    'workspaces': 'workspace',
    'dashboards': 'dashboard',
    'branding': 'branding',
    'permissions/rls-rules': 'regra RLS',
    'powerbi/connections': 'conexao Power BI',
    'powerbi/gateways': 'gateway Power BI',
    'powerbi/datasources': 'fonte de dados Power BI',
}

ACCESS_TITLES = {
    'success': 'Dashboard acessado',
    'denied': 'Acesso negado ao dashboard',
    'error': 'Falha ao carregar dashboard',
}


def _parse_resource_key(endpoint: str) -> str:
    parts = [part for part in endpoint.strip('/').split('/') if part]
    if parts and parts[0] == 'api':
        parts = parts[1:]
    if not parts:
        return ''
    if len(parts) >= 2 and parts[0] == 'users' and parts[1] == 'groups':
        return 'users/groups'
    if len(parts) >= 2 and parts[0] == 'permissions' and parts[1] == 'rls-rules':
        return 'permissions/rls-rules'
    if len(parts) >= 2 and parts[0] == 'powerbi' and parts[1] == 'connections':
        return 'powerbi/connections'
    if len(parts) >= 2 and parts[0] == 'powerbi' and parts[1] == 'gateways':
        return 'powerbi/gateways'
    if len(parts) >= 2 and parts[0] == 'powerbi' and parts[1] == 'datasources':
        return 'powerbi/datasources'
    return parts[0]


def _build_system_event_description(event: SystemEventLog) -> tuple[str, str]:
    resource_key = _parse_resource_key(event.endpoint)
    resource_label = RESOURCE_LABELS.get(resource_key, resource_key or 'recurso')
    endpoint = event.endpoint or ''
    method = (event.method or '').upper()
    message = (event.message or '').strip()

    if event.action == 'auth.login':
        return 'Login na plataforma', 'Entrou na plataforma com sucesso.'
    if event.action == 'auth.logout':
        return 'Logout da plataforma', 'Saiu da plataforma.'
    if event.action == 'request.unhandled_exception':
        return 'Erro interno do servidor', message or 'Uma requisicao terminou em erro interno.'

    if endpoint.endswith('/toggle/'):
        title = f'Alterou status de {resource_label}'
    elif endpoint.endswith('/duplicate/'):
        title = f'Duplicou {resource_label}'
    elif endpoint.endswith('/publish/'):
        title = f'Publicou {resource_label}'
    elif endpoint.endswith('/test-connection/'):
        title = f'Testou {resource_label}'
    elif endpoint.endswith('/sync-workspaces/'):
        title = 'Sincronizou workspaces do Power BI'
    elif endpoint.endswith('/sync-reports/'):
        title = 'Sincronizou reports do Power BI'
    elif endpoint.endswith('/sync-gateways/'):
        title = 'Sincronizou gateways do Power BI'
    elif endpoint.endswith('/sync-datasources/'):
        title = 'Sincronizou fontes de dados do gateway'
    elif endpoint.endswith('/upload-pbix/'):
        title = 'Importou arquivo PBIX'
    elif endpoint.endswith('/bind-dataset-gateway/'):
        title = 'Vinculou dataset ao gateway'
    elif method == 'POST':
        title = f'Criou {resource_label}'
    elif method == 'PATCH':
        title = f'Atualizou {resource_label}'
    elif method == 'DELETE':
        title = f'Excluiu {resource_label}'
    else:
        title = event.action or 'Evento da plataforma'

    if message and message not in GENERIC_EVENT_MESSAGES:
        description = message
    else:
        status_suffix = f' HTTP {event.status_code}.' if event.status_code else '.'
        description = f'{title} via {method or "acao"} em {endpoint or "endpoint desconhecido"}{status_suffix}'

    return title, description


def _serialize_access_log(log: AccessLog) -> dict:
    return {
        'id': str(log.id),
        'userId': str(log.user_id or ''),
        'userName': getattr(log.user, 'full_name', '') or 'Usuario desconhecido',
        'tenantId': str(log.tenant_id),
        'tenantName': getattr(log.tenant, 'name', '') or 'Tenant',
        'dashboardId': str(log.dashboard_id or ''),
        'dashboardName': getattr(log.dashboard, 'name', '') or 'Dashboard removido',
        'ipAddress': log.ip_address,
        'accessedAt': log.accessed_at.isoformat(),
        'status': log.status,
        'origin': log.origin,
        'details': log.details,
    }


def _serialize_access_activity(log: AccessLog) -> dict:
    title = ACCESS_TITLES.get(log.status, 'Acesso ao dashboard')
    if log.status == 'success':
        description = log.details or f'Acessou o dashboard "{getattr(log.dashboard, "name", "dashboard")}".'
    elif log.status == 'denied':
        description = log.details or f'Tentou acessar o dashboard "{getattr(log.dashboard, "name", "dashboard")}", mas o acesso foi negado.'
    else:
        description = log.details or f'Falha ao abrir o dashboard "{getattr(log.dashboard, "name", "dashboard")}".'

    return {
        'id': f'access-{log.id}',
        'kind': 'access',
        'timestamp': log.accessed_at.isoformat(),
        'title': title,
        'description': description,
        'userId': str(log.user_id or ''),
        'userName': getattr(log.user, 'full_name', '') or 'Usuario desconhecido',
        'tenantId': str(log.tenant_id),
        'tenantName': getattr(log.tenant, 'name', '') or 'Tenant',
        'dashboardId': str(log.dashboard_id or ''),
        'dashboardName': getattr(log.dashboard, 'name', '') or 'Dashboard removido',
        'status': log.status,
        'origin': log.origin,
        'category': 'access',
        'level': 'info' if log.status == 'success' else 'warn' if log.status == 'denied' else 'error',
        'resourceType': 'dashboard',
        'resourceId': str(log.dashboard_id or ''),
        'endpoint': '/api/dashboards/{id}/embed-config/',
        'method': 'GET',
        'statusCode': 200 if log.status == 'success' else 403 if log.status == 'denied' else 400,
    }


def _serialize_system_activity(event: SystemEventLog) -> dict:
    title, description = _build_system_event_description(event)
    return {
        'id': f'event-{event.id}',
        'kind': 'event',
        'timestamp': event.created_at.isoformat(),
        'title': title,
        'description': description,
        'userId': str(event.user_id or ''),
        'userName': getattr(event.user, 'full_name', '') or 'Sistema',
        'tenantId': str(event.tenant_id or ''),
        'tenantName': getattr(event.tenant, 'name', '') or 'Global',
        'dashboardId': '',
        'dashboardName': '',
        'status': '',
        'origin': '',
        'category': event.category,
        'level': event.level,
        'resourceType': event.resource_type,
        'resourceId': event.resource_id,
        'endpoint': event.endpoint,
        'method': event.method,
        'statusCode': event.status_code,
    }


def _estimate_active_minutes(activities: list[dict], idle_minutes: int = 15) -> int:
    by_user: dict[str, list] = defaultdict(list)
    for activity in activities:
        user_key = activity.get('userId') or activity.get('userName') or 'system'
        if user_key == 'system':
            continue
        timestamp = activity.get('timestamp')
        if timestamp:
            by_user[user_key].append(datetime.fromisoformat(timestamp.replace('Z', '+00:00')))

    total_seconds = 0
    idle_delta = timedelta(minutes=idle_minutes)
    minimum_session_seconds = 60

    for timestamps in by_user.values():
        if not timestamps:
            continue
        timestamps.sort()
        session_start = timestamps[0]
        last_seen = timestamps[0]

        for current in timestamps[1:]:
            if current - last_seen <= idle_delta:
                last_seen = current
                continue

            total_seconds += max(int((last_seen - session_start).total_seconds()), minimum_session_seconds)
            session_start = current
            last_seen = current

        total_seconds += max(int((last_seen - session_start).total_seconds()), minimum_session_seconds)

    return round(total_seconds / 60)


class AuditInsightsView(APIView):
    permission_classes = [AuditReadPermission]

    def get(self, request):
        access_logs = self._get_access_logs(request)
        system_events = self._get_system_events(request)

        access_log_rows = [_serialize_access_log(log) for log in access_logs]
        access_activities = [_serialize_access_activity(log) for log in access_logs]
        system_activities = [_serialize_system_activity(event) for event in system_events]
        activities = sorted(
            [*access_activities, *system_activities],
            key=lambda item: item['timestamp'],
            reverse=True,
        )

        current_month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        accesses_this_month = sum(
            1
            for log in access_logs
            if log.status == 'success' and log.accessed_at >= current_month_start
        )
        unique_users = {
            (activity['userId'] or activity['userName'])
            for activity in activities
            if (activity['userId'] or activity['userName']) not in {'', 'Sistema'}
        }
        unique_dashboards = {
            activity['dashboardId'] or activity['dashboardName']
            for activity in access_activities
            if activity['dashboardId'] or activity['dashboardName']
        }
        estimated_minutes = _estimate_active_minutes(activities)
        error_events = sum(
            1
            for activity in activities
            if activity['level'] == 'error' or activity['status'] == 'error'
        )
        denied_events = sum(1 for activity in access_activities if activity['status'] == 'denied')
        admin_changes = sum(
            1
            for activity in system_activities
            if activity['category'] in {'admin', 'integration', 'authorization'}
        )

        user_aggregate: dict[str, dict] = {}
        for activity in activities:
            key = activity['userId'] or activity['userName']
            if not key or key == 'Sistema':
                continue
            current = user_aggregate.setdefault(
                key,
                {
                    'userId': activity['userId'],
                    'userName': activity['userName'],
                    'activityCount': 0,
                    'accessCount': 0,
                    'lastActivityAt': activity['timestamp'],
                    'estimatedMinutes': 0,
                },
            )
            current['activityCount'] += 1
            if activity['kind'] == 'access' and activity['status'] == 'success':
                current['accessCount'] += 1
            if activity['timestamp'] > current['lastActivityAt']:
                current['lastActivityAt'] = activity['timestamp']

        activities_by_user: dict[str, list[dict]] = defaultdict(list)
        for activity in activities:
            user_key = activity['userId'] or activity['userName']
            if user_key and user_key != 'Sistema':
                activities_by_user[user_key].append(activity)

        for user_key, aggregate in user_aggregate.items():
            aggregate['estimatedMinutes'] = _estimate_active_minutes(activities_by_user[user_key])

        top_users = sorted(
            user_aggregate.values(),
            key=lambda item: (item['activityCount'], item['estimatedMinutes']),
            reverse=True,
        )[:5]

        return Response(
            {
                'request_id': get_request_id(),
                'summary': {
                    'total_activities': len(activities),
                    'accesses_this_month': accesses_this_month,
                    'active_users': len(unique_users),
                    'unique_dashboards': len(unique_dashboards),
                    'estimated_active_minutes': estimated_minutes,
                    'error_events': error_events,
                    'denied_events': denied_events,
                    'admin_changes': admin_changes,
                },
                'top_users': top_users,
                'activities': activities[:120],
                'access_logs': access_log_rows,
            }
        )

    def _apply_period_filter(self, queryset, field_name: str, request):
        period = request.query_params.get('period', '7d')
        if period == 'all':
            return queryset

        now = timezone.now()
        if period == '30d':
            threshold = now - timedelta(days=30)
        else:
            threshold = now - timedelta(days=7)
        return queryset.filter(**{f'{field_name}__gte': threshold})

    def _get_access_logs(self, request):
        queryset = AccessLog.objects.select_related('user', 'tenant', 'dashboard').order_by('-accessed_at')
        queryset = apply_tenant_scope(queryset, request.user)

        tenant_id = request.query_params.get('tenant')
        user_id = request.query_params.get('user')
        dashboard_id = request.query_params.get('dashboard')
        status = request.query_params.get('status')
        origin = request.query_params.get('origin')
        search = request.query_params.get('search', '').strip()

        if is_super_admin(request.user) and tenant_id and tenant_id != 'all':
            queryset = queryset.filter(tenant_id=tenant_id)
        if user_id and user_id != 'all':
            queryset = queryset.filter(user_id=user_id)
        if dashboard_id and dashboard_id != 'all':
            queryset = queryset.filter(dashboard_id=dashboard_id)
        if status and status != 'all':
            queryset = queryset.filter(status=status)
        if origin and origin != 'all':
            queryset = queryset.filter(origin=origin)
        if search:
            queryset = queryset.filter(
                Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(tenant__name__icontains=search)
                | Q(dashboard__name__icontains=search)
                | Q(ip_address__icontains=search)
                | Q(details__icontains=search)
            )

        return list(self._apply_period_filter(queryset, 'accessed_at', request))

    def _get_system_events(self, request):
        queryset = SystemEventLog.objects.select_related('user', 'tenant').order_by('-created_at')
        queryset = apply_tenant_scope(queryset, request.user)

        tenant_id = request.query_params.get('tenant')
        user_id = request.query_params.get('user')
        dashboard_id = request.query_params.get('dashboard')
        search = request.query_params.get('search', '').strip()

        if is_super_admin(request.user) and tenant_id and tenant_id != 'all':
            queryset = queryset.filter(tenant_id=tenant_id)
        if user_id and user_id != 'all':
            queryset = queryset.filter(user_id=user_id)
        if dashboard_id and dashboard_id != 'all':
            queryset = queryset.filter(Q(resource_id=dashboard_id) | Q(endpoint__icontains='/dashboards/'))
        if search:
            queryset = queryset.filter(
                Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(tenant__name__icontains=search)
                | Q(action__icontains=search)
                | Q(message__icontains=search)
                | Q(endpoint__icontains=search)
                | Q(request_id__icontains=search)
                | Q(resource_type__icontains=search)
                | Q(resource_id__icontains=search)
            )

        return list(self._apply_period_filter(queryset, 'created_at', request))


class AccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AccessLogSerializer
    permission_classes = [AuditReadPermission]
    filterset_class = AccessLogFilter
    search_fields = ['user__first_name', 'user__last_name', 'dashboard__name', 'ip_address', 'details']
    ordering_fields = ['accessed_at', 'status', 'origin']
    ordering = ['-accessed_at']

    def get_queryset(self):
        queryset = AccessLog.objects.select_related('user', 'tenant', 'dashboard')
        queryset = apply_tenant_scope(queryset, self.request.user)
        if is_viewer(self.request.user):
            return queryset.none()
        return queryset


class SystemEventLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SystemEventLogSerializer
    permission_classes = [SystemEventReadPermission]
    filterset_class = SystemEventLogFilter
    search_fields = ['action', 'message', 'endpoint', 'request_id', 'resource_type', 'resource_id']
    ordering_fields = ['created_at', 'level', 'category', 'status_code']
    ordering = ['-created_at']

    def get_queryset(self):
        return SystemEventLog.objects.select_related('user', 'tenant')

