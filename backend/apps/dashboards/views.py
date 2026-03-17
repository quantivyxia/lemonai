from rest_framework import viewsets
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.models import AccessStatus
from apps.audit.services import log_dashboard_access
from apps.common.services import apply_tenant_scope, get_actor_user, is_super_admin, is_view_as_mode, is_viewer
from apps.dashboards.filters import DashboardColumnFilter, DashboardFilter
from apps.dashboards.models import Dashboard, DashboardColumn, DashboardStatus
from apps.dashboards.permissions import DashboardColumnPermission, DashboardPermission
from apps.dashboards.serializers import DashboardColumnSerializer, DashboardSerializer
from apps.dashboards.services import EmbedAccessDenied, EmbedIntegrationError, PowerBIEmbedService
from apps.permissions.services import get_user_accessible_dashboard_ids


class DashboardViewSet(viewsets.ModelViewSet):
    serializer_class = DashboardSerializer
    permission_classes = [DashboardPermission]
    filterset_class = DashboardFilter
    search_fields = ['name', 'description', 'category']
    ordering_fields = ['name', 'status', 'updated_at', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        queryset = Dashboard.objects.select_related('tenant', 'workspace').prefetch_related('columns')
        queryset = apply_tenant_scope(queryset, self.request.user)

        if is_super_admin(self.request.user):
            return queryset
        if not is_viewer(self.request.user):
            return queryset

        accessible_ids = get_user_accessible_dashboard_ids(self.request.user)
        if accessible_ids is None:
            return queryset
        if not accessible_ids:
            return queryset.none()

        return queryset.filter(id__in=accessible_ids)

    def perform_create(self, serializer):
        if not is_super_admin(self.request.user):
            serializer.save(tenant=self.request.user.tenant)
            return
        serializer.save()

    @action(detail=True, methods=['get'], url_path='embed-config')
    def embed_config(self, request, pk=None):
        dashboard = self.get_object()
        service = PowerBIEmbedService()
        ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
        actor_user = get_actor_user(request)
        access_details = 'Embed config gerada com sucesso.'
        if is_view_as_mode(request) and actor_user and actor_user != request.user:
            access_details = f'Embed config gerada em modo view-as por {actor_user.email}.'

        try:
            config = service.get_embed_config(dashboard.id, request.user)
            log_dashboard_access(
                user=request.user,
                tenant=dashboard.tenant,
                dashboard=dashboard,
                ip_address=ip,
                status=AccessStatus.SUCCESS,
                origin='portal',
                details=access_details,
            )
            return Response(config.to_dict())
        except EmbedAccessDenied as exc:
            log_dashboard_access(
                user=request.user,
                tenant=dashboard.tenant,
                dashboard=dashboard,
                ip_address=ip,
                status=AccessStatus.DENIED,
                origin='portal',
                details=str(exc),
            )
            return Response({'detail': str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except EmbedIntegrationError as exc:
            log_dashboard_access(
                user=request.user,
                tenant=dashboard.tenant,
                dashboard=dashboard,
                ip_address=ip,
                status=AccessStatus.ERROR,
                origin='portal',
                details=str(exc),
            )
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:  # noqa: BLE001
            log_dashboard_access(
                user=request.user,
                tenant=dashboard.tenant,
                dashboard=dashboard,
                ip_address=ip,
                status=AccessStatus.ERROR,
                origin='portal',
                details=str(exc),
            )
            return Response({'detail': 'Erro ao gerar embed config.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        dashboard = self.get_object()
        dashboard.status = DashboardStatus.ACTIVE
        dashboard.save(update_fields=['status', 'updated_at'])
        return Response({'detail': 'Dashboard publicado com sucesso.', 'status': dashboard.status})


class DashboardColumnViewSet(viewsets.ModelViewSet):
    serializer_class = DashboardColumnSerializer
    permission_classes = [DashboardColumnPermission]
    filterset_class = DashboardColumnFilter
    search_fields = ['name', 'label']
    ordering_fields = ['label', 'created_at']
    ordering = ['label']

    def get_queryset(self):
        queryset = DashboardColumn.objects.select_related('dashboard', 'dashboard__tenant')
        user = self.request.user
        if is_super_admin(user):
            return queryset
        return queryset.filter(dashboard__tenant_id=user.tenant_id)

