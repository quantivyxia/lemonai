import os
from pathlib import Path

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.services import apply_tenant_scope, is_super_admin
from apps.dashboards.models import Dashboard, DashboardStatus
from apps.powerbi.filters import PowerBIConnectionFilter, PowerBIGatewayDataSourceFilter, PowerBIGatewayFilter
from apps.powerbi.models import PowerBIConnection, PowerBIGateway, PowerBIGatewayDataSource
from apps.powerbi.permissions import PowerBIManagementPermission
from apps.powerbi.serializers import (
    PowerBIConnectionSerializer,
    PowerBIGatewayDataSourceSerializer,
    PowerBIGatewaySerializer,
)
from apps.powerbi.services import PowerBIClient, PowerBIServiceError, sync_gateways_for_tenant
from apps.workspaces.models import Workspace, WorkspaceStatus


class PowerBIConnectionViewSet(viewsets.ModelViewSet):
    serializer_class = PowerBIConnectionSerializer
    permission_classes = [PowerBIManagementPermission]
    filterset_class = PowerBIConnectionFilter
    search_fields = ['tenant__name', 'client_id', 'aad_tenant_id']
    ordering_fields = ['tenant__name', 'last_tested_at', 'last_sync_at', 'created_at']
    ordering = ['tenant__name']
    supported_name_conflicts = {'Abort', 'Ignore', 'Overwrite', 'CreateOrOverwrite'}

    def get_queryset(self):
        queryset = PowerBIConnection.objects.select_related('tenant')
        return apply_tenant_scope(queryset, self.request.user)

    def perform_create(self, serializer):
        if not is_super_admin(self.request.user):
            serializer.save(tenant=self.request.user.tenant)
            return
        serializer.save()

    @action(detail=True, methods=['post'], url_path='test-connection')
    def test_connection(self, request, pk=None):
        connection = self.get_object()
        client = PowerBIClient(connection)

        try:
            workspaces = client.list_workspaces()
            connection.last_tested_at = timezone.now()
            connection.last_error = ''
            connection.save(update_fields=['last_tested_at', 'last_error', 'updated_at'])
            return Response(
                {
                    'detail': 'Conexao com Power BI validada com sucesso.',
                    'workspacesCount': len(workspaces),
                }
            )
        except PowerBIServiceError as exc:
            connection.last_tested_at = timezone.now()
            connection.last_error = str(exc)
            connection.save(update_fields=['last_tested_at', 'last_error', 'updated_at'])
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='workspaces')
    def list_workspaces(self, request, pk=None):
        connection = self.get_object()
        client = PowerBIClient(connection)
        try:
            workspaces = client.list_workspaces()
            result = [
                {
                    'id': workspace.get('id'),
                    'name': workspace.get('name'),
                    'isReadOnly': workspace.get('isReadOnly', False),
                    'isOnDedicatedCapacity': workspace.get('isOnDedicatedCapacity', False),
                }
                for workspace in workspaces
            ]
            return Response(result)
        except PowerBIServiceError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='reports')
    def list_reports(self, request, pk=None):
        connection = self.get_object()
        workspace_id = request.query_params.get('workspace_id')
        if not workspace_id:
            return Response({'detail': 'workspace_id e obrigatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        client = PowerBIClient(connection)
        try:
            reports = client.list_reports(workspace_id)
            result = [
                {
                    'id': report.get('id'),
                    'name': report.get('name'),
                    'embedUrl': report.get('embedUrl'),
                    'datasetId': report.get('datasetId'),
                    'webUrl': report.get('webUrl'),
                }
                for report in reports
            ]
            return Response(result)
        except PowerBIServiceError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='datasets')
    def list_datasets(self, request, pk=None):
        connection = self.get_object()
        workspace_id = request.query_params.get('workspace_id')
        if not workspace_id:
            return Response({'detail': 'workspace_id e obrigatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        client = PowerBIClient(connection)
        try:
            datasets = client.list_datasets(workspace_id)
            result = [
                {
                    'id': dataset.get('id'),
                    'name': dataset.get('name'),
                    'configuredBy': dataset.get('configuredBy'),
                    'isRefreshable': dataset.get('isRefreshable', False),
                }
                for dataset in datasets
            ]
            return Response(result)
        except PowerBIServiceError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='sync-workspaces')
    def sync_workspaces(self, request, pk=None):
        connection = self.get_object()
        client = PowerBIClient(connection)

        try:
            workspaces = client.list_workspaces()
            synced = 0
            for workspace in workspaces:
                external_id = str(workspace.get('id', ''))
                if not external_id:
                    continue
                Workspace.objects.update_or_create(
                    tenant=connection.tenant,
                    external_workspace_id=external_id,
                    defaults={
                        'name': workspace.get('name') or 'Workspace sem nome',
                        'status': WorkspaceStatus.ACTIVE,
                    },
                )
                synced += 1

            connection.last_sync_at = timezone.now()
            connection.last_error = ''
            connection.save(update_fields=['last_sync_at', 'last_error', 'updated_at'])
            return Response({'detail': 'Workspaces sincronizados.', 'synced': synced})
        except PowerBIServiceError as exc:
            connection.last_error = str(exc)
            connection.save(update_fields=['last_error', 'updated_at'])
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='sync-reports')
    def sync_reports(self, request, pk=None):
        connection = self.get_object()
        workspace_id = request.data.get('workspace_id')
        if not workspace_id:
            return Response({'detail': 'workspace_id e obrigatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        category = request.data.get('category', 'Operacional')
        status_value = request.data.get('status', DashboardStatus.DRAFT)
        client = PowerBIClient(connection)

        try:
            workspace_response = client.list_workspaces()
            workspace_name = next(
                (workspace.get('name') for workspace in workspace_response if str(workspace.get('id')) == workspace_id),
                'Workspace importado',
            )
            workspace, _ = Workspace.objects.update_or_create(
                tenant=connection.tenant,
                external_workspace_id=workspace_id,
                defaults={
                    'name': workspace_name,
                    'status': WorkspaceStatus.ACTIVE,
                },
            )

            reports = client.list_reports(workspace_id)
            created = 0
            updated = 0
            skipped_by_limit = 0
            max_dashboards = connection.tenant.max_dashboards
            tenant_dashboards_count = Dashboard.objects.filter(tenant=connection.tenant).count()
            for report in reports:
                report_id = str(report.get('id', ''))
                if not report_id:
                    continue
                name = report.get('name') or f'Report {report_id[:6]}'
                defaults = {
                    'workspace': workspace,
                    'name': name,
                    'description': '',
                    'category': category,
                    'status': status_value,
                    'embed_url': report.get('embedUrl') or '',
                    'dataset_id': report.get('datasetId') or '',
                    'external_workspace_id': workspace.external_workspace_id,
                }
                dashboard = Dashboard.objects.filter(tenant=connection.tenant, report_id=report_id).first()
                if dashboard:
                    for attr, value in defaults.items():
                        setattr(dashboard, attr, value)
                    dashboard.save()
                    updated += 1
                    continue

                dashboard = Dashboard.objects.filter(tenant=connection.tenant, name=name).first()
                if dashboard:
                    for attr, value in defaults.items():
                        setattr(dashboard, attr, value)
                    dashboard.report_id = report_id
                    dashboard.save()
                    updated += 1
                    continue

                if tenant_dashboards_count >= max_dashboards:
                    skipped_by_limit += 1
                    continue

                Dashboard.objects.create(
                    tenant=connection.tenant,
                    report_id=report_id,
                    **defaults,
                )
                created += 1
                tenant_dashboards_count += 1

            connection.last_sync_at = timezone.now()
            connection.last_error = ''
            connection.save(update_fields=['last_sync_at', 'last_error', 'updated_at'])
            return Response(
                {
                    'detail': 'Reports sincronizados com sucesso.',
                    'created': created,
                    'updated': updated,
                    'skipped_by_limit': skipped_by_limit,
                    'limit': max_dashboards,
                }
            )
        except PowerBIServiceError as exc:
            connection.last_error = str(exc)
            connection.save(update_fields=['last_error', 'updated_at'])
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:  # noqa: BLE001
            connection.last_error = str(exc)
            connection.save(update_fields=['last_error', 'updated_at'])
            return Response({'detail': 'Erro interno ao sincronizar reports.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='upload-pbix')
    def upload_pbix(self, request, pk=None):
        connection = self.get_object()
        workspace_id = str(request.data.get('workspace_id') or connection.default_workspace_id or '').strip()
        if not workspace_id:
            return Response({'detail': 'workspace_id e obrigatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        pbix_file = request.FILES.get('pbix_file') or request.FILES.get('file')
        if not pbix_file:
            return Response({'detail': 'Arquivo .pbix e obrigatorio no campo pbix_file.'}, status=status.HTTP_400_BAD_REQUEST)
        if not str(pbix_file.name).lower().endswith('.pbix'):
            return Response({'detail': 'Apenas arquivos .pbix sao aceitos.'}, status=status.HTTP_400_BAD_REQUEST)

        max_mb = int(os.getenv('POWERBI_PBIX_MAX_MB', '1024'))
        max_bytes = max_mb * 1024 * 1024
        if getattr(pbix_file, 'size', 0) > max_bytes:
            return Response(
                {'detail': f'Arquivo excede o limite de {max_mb} MB configurado para upload.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dataset_display_name = str(
            request.data.get('dataset_display_name') or Path(pbix_file.name).stem or 'Dataset',
        ).strip()
        if not dataset_display_name:
            return Response({'detail': 'dataset_display_name invalido.'}, status=status.HTTP_400_BAD_REQUEST)

        name_conflict = str(request.data.get('name_conflict') or 'CreateOrOverwrite').strip()
        if name_conflict not in self.supported_name_conflicts:
            return Response(
                {
                    'detail': (
                        f'name_conflict invalido. Use um de: '
                        f'{", ".join(sorted(self.supported_name_conflicts))}.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        category = str(request.data.get('category') or 'Operacional').strip() or 'Operacional'
        status_value = str(request.data.get('status') or DashboardStatus.DRAFT).strip()
        if status_value not in {DashboardStatus.ACTIVE, DashboardStatus.DRAFT, DashboardStatus.ARCHIVED}:
            status_value = DashboardStatus.DRAFT

        client = PowerBIClient(connection)
        try:
            workspace_response = client.list_workspaces()
            workspace_name = next(
                (workspace.get('name') for workspace in workspace_response if str(workspace.get('id')) == workspace_id),
                'Workspace importado',
            )
            workspace, _ = Workspace.objects.update_or_create(
                tenant=connection.tenant,
                external_workspace_id=workspace_id,
                defaults={
                    'name': workspace_name,
                    'status': WorkspaceStatus.ACTIVE,
                },
            )

            import_payload = client.import_pbix(
                workspace_id=workspace_id,
                pbix_file=pbix_file,
                dataset_display_name=dataset_display_name,
                name_conflict=name_conflict,
            )
            import_id = str(import_payload.get('id') or '').strip()
            if not import_id:
                raise PowerBIServiceError('Power BI nao retornou id da importacao.')

            completed_import = client.wait_for_import(workspace_id=workspace_id, import_id=import_id)
            reports = completed_import.get('reports') or []
            datasets = completed_import.get('datasets') or []
            fallback_dataset_id = str(datasets[0].get('id') or '') if datasets else ''

            if not reports:
                listed_reports = client.list_reports(workspace_id)
                reports = [
                    report
                    for report in listed_reports
                    if str(report.get('name') or '').strip().lower() == dataset_display_name.lower()
                ]

            created = 0
            updated = 0
            skipped_by_limit = 0
            max_dashboards = connection.tenant.max_dashboards
            tenant_dashboards_count = Dashboard.objects.filter(tenant=connection.tenant).count()
            dashboards_synced: list[dict] = []
            for report in reports:
                report_id = str(report.get('id', '')).strip()
                if not report_id:
                    continue

                name = str(report.get('name') or dataset_display_name).strip()
                if not name:
                    continue

                defaults = {
                    'workspace': workspace,
                    'name': name,
                    'description': '',
                    'category': category,
                    'status': status_value,
                    'embed_url': report.get('embedUrl') or '',
                    'dataset_id': report.get('datasetId') or fallback_dataset_id,
                    'external_workspace_id': workspace.external_workspace_id,
                    'last_sync_at': timezone.now(),
                }
                dashboard = Dashboard.objects.filter(tenant=connection.tenant, report_id=report_id).first()
                sync_action = 'updated'
                if dashboard:
                    for attr, value in defaults.items():
                        setattr(dashboard, attr, value)
                    dashboard.save()
                    updated += 1
                else:
                    dashboard = Dashboard.objects.filter(tenant=connection.tenant, name=name).first()
                    if dashboard:
                        for attr, value in defaults.items():
                            setattr(dashboard, attr, value)
                        dashboard.report_id = report_id
                        dashboard.save()
                        updated += 1
                    else:
                        if tenant_dashboards_count >= max_dashboards:
                            skipped_by_limit += 1
                            continue
                        dashboard = Dashboard.objects.create(
                            tenant=connection.tenant,
                            report_id=report_id,
                            **defaults,
                        )
                        created += 1
                        tenant_dashboards_count += 1
                        sync_action = 'created'

                dashboards_synced.append(
                    {
                        'id': str(dashboard.id),
                        'name': dashboard.name,
                        'report_id': dashboard.report_id,
                        'dataset_id': dashboard.dataset_id,
                        'action': sync_action,
                    },
                )

            connection.last_sync_at = timezone.now()
            connection.last_error = ''
            connection.save(update_fields=['last_sync_at', 'last_error', 'updated_at'])
            return Response(
                {
                    'detail': 'Upload PBIX concluido e dashboards sincronizados.',
                    'importId': import_id,
                    'workspaceId': workspace_id,
                    'workspaceName': workspace.name,
                    'created': created,
                    'updated': updated,
                    'skipped_by_limit': skipped_by_limit,
                    'limit': max_dashboards,
                    'dashboards': dashboards_synced,
                },
            )
        except PowerBIServiceError as exc:
            connection.last_error = str(exc)
            connection.save(update_fields=['last_error', 'updated_at'])
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:  # noqa: BLE001
            connection.last_error = str(exc)
            connection.save(update_fields=['last_error', 'updated_at'])
            return Response({'detail': 'Erro interno ao processar upload do PBIX.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='sync-gateways')
    def sync_gateways(self, request, pk=None):
        connection = self.get_object()
        try:
            result = sync_gateways_for_tenant(connection)
            return Response({'detail': 'Gateways sincronizados com sucesso.', **result})
        except PowerBIServiceError as exc:
            connection.last_error = str(exc)
            connection.save(update_fields=['last_error', 'updated_at'])
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='bind-dataset-gateway')
    def bind_dataset_gateway(self, request, pk=None):
        connection = self.get_object()
        dataset_id = request.data.get('dataset_id')
        gateway_id = request.data.get('gateway_id')
        datasource_ids = request.data.get('datasource_ids') or []
        datasource_id = request.data.get('datasource_id')

        if datasource_id and datasource_id not in datasource_ids:
            datasource_ids.append(datasource_id)

        if not dataset_id or not gateway_id:
            return Response(
                {'detail': 'dataset_id e gateway_id sao obrigatorios.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client = PowerBIClient(connection)
        try:
            client.bind_dataset_to_gateway(str(dataset_id), str(gateway_id), [str(item) for item in datasource_ids])
            return Response({'detail': 'Dataset vinculado ao gateway com sucesso.'})
        except PowerBIServiceError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class PowerBIGatewayViewSet(viewsets.ModelViewSet):
    serializer_class = PowerBIGatewaySerializer
    permission_classes = [PowerBIManagementPermission]
    filterset_class = PowerBIGatewayFilter
    search_fields = ['name', 'external_gateway_id', 'tenant__name']
    ordering_fields = ['name', 'status', 'last_sync_at', 'updated_at']
    ordering = ['name']

    def get_queryset(self):
        queryset = PowerBIGateway.objects.select_related('tenant', 'connection').prefetch_related('datasources')
        return apply_tenant_scope(queryset, self.request.user)

    def perform_create(self, serializer):
        if not is_super_admin(self.request.user):
            serializer.save(tenant=self.request.user.tenant)
            return
        serializer.save()

    @action(detail=True, methods=['post'], url_path='sync-datasources')
    def sync_datasources(self, request, pk=None):
        gateway = self.get_object()
        connection = gateway.connection or PowerBIConnection.objects.filter(
            tenant=gateway.tenant,
            is_active=True,
        ).first()
        if not connection:
            return Response(
                {'detail': 'Nenhuma conexao ativa de Power BI encontrada para este tenant.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client = PowerBIClient(connection)
        try:
            datasources = client.list_gateway_datasources(gateway.external_gateway_id)
            synced = 0
            for datasource in datasources:
                PowerBIGatewayDataSource.objects.update_or_create(
                    gateway=gateway,
                    external_datasource_id=str(datasource.get('datasourceId', '')),
                    defaults={
                        'name': datasource.get('datasourceName') or 'Datasource sem nome',
                        'datasource_type': datasource.get('datasourceType', ''),
                        'connection_details': datasource.get('connectionDetails') or {},
                    },
                )
                synced += 1

            gateway.last_sync_at = timezone.now()
            gateway.status = 'active'
            gateway.save(update_fields=['last_sync_at', 'status', 'updated_at'])
            return Response({'detail': 'Datasources sincronizados.', 'synced': synced})
        except PowerBIServiceError as exc:
            gateway.status = 'error'
            gateway.notes = str(exc)
            gateway.save(update_fields=['status', 'notes', 'updated_at'])
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class PowerBIGatewayDataSourceViewSet(viewsets.ModelViewSet):
    serializer_class = PowerBIGatewayDataSourceSerializer
    permission_classes = [PowerBIManagementPermission]
    filterset_class = PowerBIGatewayDataSourceFilter
    search_fields = ['name', 'external_datasource_id', 'datasource_type']
    ordering_fields = ['name', 'datasource_type', 'updated_at']
    ordering = ['name']

    def get_queryset(self):
        queryset = PowerBIGatewayDataSource.objects.select_related('gateway', 'gateway__tenant')
        return apply_tenant_scope(queryset, self.request.user, tenant_field='gateway__tenant')
