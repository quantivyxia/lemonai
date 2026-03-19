from django.db import connection
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AccessLog, SystemEventLog
from apps.common.request_context import get_request_id
from apps.common.services import is_super_admin
from apps.dashboards.models import Dashboard
from apps.powerbi.models import PowerBIConnection, PowerBIGateway
from apps.tenants.models import Tenant
from apps.users.models import User
from apps.workspaces.models import Workspace


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
