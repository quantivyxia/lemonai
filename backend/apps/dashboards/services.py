"""Application services for dashboards app."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from django.shortcuts import get_object_or_404

from apps.dashboards.models import Dashboard
from apps.permissions.services import (
    build_user_report_filters,
    get_user_rls_context,
    has_dashboard_access,
)
from apps.powerbi.models import PowerBIConnection
from apps.powerbi.services import PowerBIClient, PowerBIServiceError


class EmbedAccessDenied(Exception):
    pass


class EmbedIntegrationError(Exception):
    pass


@dataclass
class EmbedConfig:
    dashboard_id: str
    report_id: str
    dataset_id: str
    embed_url: str
    access_token: str
    expires_at: datetime
    report_filters: list[dict]

    def to_dict(self):
        return {
            'dashboardId': self.dashboard_id,
            'reportId': self.report_id,
            'datasetId': self.dataset_id,
            'embedUrl': self.embed_url,
            'accessToken': self.access_token,
            'expiresAt': self.expires_at.isoformat(),
            'reportFilters': self.report_filters,
        }


class PowerBIEmbedService:
    """
    Gera configuracao de embed aplicando filtros de relatorio em todas as paginas.

    Fluxo:
    - valida acesso ao dashboard;
    - coleta regras RLS ativas do usuario;
    - converte regras em filtros de relatorio;
    - gera embed token sem effective identity.
    """

    def get_embed_config(self, dashboard_id, user_context) -> EmbedConfig:
        dashboard = get_object_or_404(Dashboard.objects.select_related('tenant', 'workspace'), id=dashboard_id)

        if not has_dashboard_access(user_context, dashboard):
            raise EmbedAccessDenied('Usuario sem permissao para este dashboard.')

        rls_context = get_user_rls_context(user_context, dashboard)
        report_filters = build_user_report_filters(user_context, dashboard, rls_context=rls_context)
        token, expires_at, embed_url = self._build_access_token(
            dashboard=dashboard,
            user=user_context,
            rls_context=rls_context,
        )

        return EmbedConfig(
            dashboard_id=str(dashboard.id),
            report_id=dashboard.report_id,
            dataset_id=dashboard.dataset_id,
            embed_url=embed_url,
            access_token=token,
            expires_at=expires_at,
            report_filters=report_filters,
        )

    def _build_access_token(self, dashboard, user, rls_context: list[dict]):
        connection = PowerBIConnection.objects.filter(
            tenant=dashboard.tenant,
            is_active=True,
        ).first()

        if connection:
            workspace_external_id = dashboard.external_workspace_id or dashboard.workspace.external_workspace_id
            if not workspace_external_id or not dashboard.report_id:
                raise EmbedIntegrationError(
                    'Dashboard sem workspace/report configurado para embed real no Power BI.',
                )
            if not dashboard.dataset_id:
                raise EmbedIntegrationError('Dashboard sem dataset_id configurado para embed real no Power BI.')

            client = PowerBIClient(connection)
            try:
                token_payload = client.generate_embed_token(
                    workspace_id=workspace_external_id,
                    report_id=dashboard.report_id,
                )
            except PowerBIServiceError as exc:
                if self._is_entity_not_found(exc):
                    rebound = self._refresh_dashboard_binding_from_workspace(
                        client=client,
                        dashboard=dashboard,
                        workspace_external_id=workspace_external_id,
                    )
                    if not rebound:
                        raise EmbedIntegrationError(
                            'Report/dataset nao encontrado no workspace. Execute "Sync reports" na tela Power BI '
                            'para atualizar os IDs do dashboard.',
                        ) from exc

                    token_payload = client.generate_embed_token(
                        workspace_id=workspace_external_id,
                        report_id=dashboard.report_id,
                    )
                else:
                    raise EmbedIntegrationError(str(exc)) from exc

            try:
                embed_url = dashboard.embed_url
                if not embed_url:
                    report = client.get_report(workspace_external_id, dashboard.report_id)
                    embed_url = report.get('embedUrl') or ''
                if not embed_url:
                    raise EmbedIntegrationError('Power BI nao retornou embedUrl para o report selecionado.')
                return token_payload['token'], token_payload['expiration'], embed_url
            except PowerBIServiceError as exc:
                raise EmbedIntegrationError(str(exc)) from exc

        allow_demo_fallback = os.getenv('INSIGHTHUB_ALLOW_DEMO_EMBED_FALLBACK', 'false').strip().lower() in {
            '1',
            'true',
            'yes',
            'on',
        }
        if not allow_demo_fallback:
            raise EmbedIntegrationError(
                'Nenhuma conexao Power BI ativa encontrada para gerar o embed em modo de producao.'
            )

        seed = f'{dashboard.id}:{user.id}:{len(rls_context)}'
        prefix = os.getenv('INSIGHTHUB_EMBED_TOKEN_PREFIX', 'demo-embed-token')
        token = f'{prefix}:{seed}'
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        embed_url = dashboard.embed_url or 'https://app.powerbi.com/reportEmbed'
        return token, expires_at, embed_url

    def _is_entity_not_found(self, error: Exception) -> bool:
        message = str(error).strip().lower()
        return (
            'powerbientitynotfound' in message
            or 'entity not found' in message
            or 'nao encontrado no workspace' in message
            or 'report/dataset nao encontrado' in message
        )

    def _refresh_dashboard_binding_from_workspace(self, client: PowerBIClient, dashboard, workspace_external_id: str) -> bool:
        try:
            reports = client.list_reports(workspace_external_id)
        except PowerBIServiceError:
            return False

        dashboard_name = str(dashboard.name or '').strip().lower()
        matched_report = next(
            (
                report
                for report in reports
                if str(report.get('name') or '').strip().lower() == dashboard_name
            ),
            None,
        )

        if not matched_report and len(reports) == 1:
            # Fallback seguro quando o workspace tem somente um report.
            matched_report = reports[0]

        if not matched_report:
            return False

        new_report_id = str(matched_report.get('id') or '').strip()
        if not new_report_id:
            return False

        update_fields: list[str] = []
        if new_report_id != (dashboard.report_id or ''):
            dashboard.report_id = new_report_id
            update_fields.append('report_id')

        new_dataset_id = str(matched_report.get('datasetId') or '').strip()
        if new_dataset_id and new_dataset_id != (dashboard.dataset_id or ''):
            dashboard.dataset_id = new_dataset_id
            update_fields.append('dataset_id')

        new_embed_url = str(matched_report.get('embedUrl') or '').strip()
        if new_embed_url and new_embed_url != (dashboard.embed_url or ''):
            dashboard.embed_url = new_embed_url
            update_fields.append('embed_url')

        if update_fields:
            dashboard.last_sync_at = datetime.now(timezone.utc)
            update_fields.extend(['last_sync_at', 'updated_at'])
            dashboard.save(update_fields=update_fields)

        return True
