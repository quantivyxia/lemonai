from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass

import requests
from django.db.models import QuerySet

from apps.common.services import apply_tenant_scope, is_super_admin
from apps.dashboards.models import Dashboard
from apps.permissions.services import build_user_report_filters, get_user_accessible_dashboard_ids, has_dashboard_access

logger = logging.getLogger('insighthub.integration.ai')


APP_HELP_GUIDE = """
LemonAI e uma plataforma analitica multi-tenant com modulos como Home, Dashboards, Workspaces, Power BI, Usuarios, Grupos, Regras de RLS, Tenants, Auditoria, Monitoramento, Suporte, White-label e Configuracoes.

Orientacoes de uso:
- Dashboards: lista dashboards permitidos ao usuario e abre a visualizacao embedded.
- Workspaces: organiza e sincroniza workspaces do Power BI.
- Power BI: cadastra conexoes, sincroniza reports, envia PBIX e gerencia gateways/datasources.
- Usuarios: cria, edita, ativa ou desativa usuarios; pode espelhar acessos de outro usuario.
- Grupos: define grupos com dashboards herdados para facilitar o controle de acesso.
- Regras de RLS: configura filtros por usuario para restringir dados dentro de dashboards.
- Auditoria: acompanha eventos, acessos e atividade por usuario.
- Suporte: registra e acompanha chamados.
- White-label: personaliza nome, dominio, cores e branding por tenant.

Regras da fase 1:
- Voce pode explicar como usar a plataforma e o contexto do dashboard atual.
- Voce NAO pode afirmar valores numericos, metricas, totais ou insights baseados em dados nao fornecidos explicitamente.
- Se o usuario pedir um numero, comparacao ou analise quantitativa, explique que a fase 1 ainda nao consulta os dados do relatorio diretamente.
""".strip()


ROLE_VISIBLE_MODULES = {
    'super_admin': [
        'Home',
        'Dashboards',
        'Workspaces',
        'Power BI',
        'Usuarios',
        'Grupos',
        'Permissoes',
        'Regras de RLS',
        'Tenants',
        'Auditoria',
        'Monitoramento',
        'Suporte',
        'White-label',
        'Configuracoes',
    ],
    'analyst': [
        'Home',
        'Dashboards',
        'Workspaces',
        'Power BI',
        'Usuarios',
        'Grupos',
        'Regras de RLS',
        'Tenants',
        'Auditoria',
        'Suporte',
        'White-label',
        'Configuracoes',
    ],
    'viewer': [
        'Home',
        'Dashboards',
        'Configuracoes',
    ],
}


class AssistantConfigurationError(Exception):
    pass


class AssistantIntegrationError(Exception):
    pass


@dataclass
class AssistantReply:
    reply: str
    model: str
    dashboard_id: str | None
    context_summary: str

    def to_dict(self):
        return {
            'reply': self.reply,
            'model': self.model,
            'dashboardId': self.dashboard_id,
            'contextSummary': self.context_summary,
        }


class OpenAIChatClient:
    MODEL_ALIASES = {
        'gpt-5.4-mini': 'gpt-5-mini',
        'gpt-5.4-nano': 'gpt-5-nano',
        'gpt-5.4': 'gpt-5',
    }

    def __init__(self):
        self.enabled = os.getenv('OPENAI_ASSISTANT_ENABLED', 'true').strip().lower() in {'1', 'true', 'yes', 'on'}
        self.api_key = os.getenv('OPENAI_API_KEY', '').strip()
        configured_model = os.getenv('OPENAI_MODEL', 'gpt-5-mini').strip() or 'gpt-5-mini'
        self.model = self.MODEL_ALIASES.get(configured_model, configured_model)
        self.api_base_url = os.getenv('OPENAI_API_BASE_URL', 'https://api.openai.com/v1').strip().rstrip('/')
        self.timeout_seconds = self._parse_timeout_seconds(os.getenv('OPENAI_TIMEOUT_SECONDS', '30'))

    def complete(self, messages: list[dict[str, str]]) -> str:
        if not self.enabled:
            raise AssistantConfigurationError('Assistente IA desabilitado no servidor.')
        if not self.api_key:
            raise AssistantConfigurationError('OpenAI nao configurada. Defina OPENAI_API_KEY no backend.')

        payload = {
            'model': self.model,
            'messages': messages,
        }
        if not self.model.startswith('gpt-5'):
            payload['temperature'] = 0.2

        try:
            response = requests.post(
                f'{self.api_base_url}/chat/completions',
                headers={
                    'Authorization': f'Bearer {self.api_key}',
                    'Content-Type': 'application/json',
                },
                json=payload,
                timeout=self.timeout_seconds,
            )
        except requests.exceptions.Timeout as exc:
            logger.warning(
                'OpenAI request timed out',
                extra={
                    'model': self.model,
                    'timeout_seconds': self.timeout_seconds,
                },
            )
            raise AssistantIntegrationError(
                'A chamada para a OpenAI excedeu o tempo limite configurado no servidor.'
            ) from exc
        except requests.exceptions.RequestException as exc:
            logger.exception(
                'OpenAI request failed',
                extra={
                    'model': self.model,
                    'api_base_url': self.api_base_url,
                },
            )
            raise AssistantIntegrationError(
                'Falha ao conectar com a OpenAI a partir do servidor.'
            ) from exc
        if response.status_code >= 400:
            raise AssistantIntegrationError(self._parse_error(response))

        try:
            payload = response.json()
        except ValueError as exc:
            logger.exception(
                'OpenAI response was not valid JSON',
                extra={
                    'model': self.model,
                    'status_code': response.status_code,
                },
            )
            raise AssistantIntegrationError('A OpenAI retornou uma resposta invalida para esta requisicao.') from exc

        content = (((payload.get('choices') or [{}])[0]).get('message') or {}).get('content')
        if isinstance(content, str) and content.strip():
            return content.strip()
        if isinstance(content, list):
            parts = [
                str(item.get('text') or '').strip()
                for item in content
                if isinstance(item, dict) and str(item.get('text') or '').strip()
            ]
            if parts:
                return '\n'.join(parts).strip()

        raise AssistantIntegrationError('A OpenAI nao retornou texto para esta resposta.')

    def _parse_timeout_seconds(self, raw_value: str) -> int:
        try:
            timeout_seconds = int(str(raw_value).strip())
        except (TypeError, ValueError):
            logger.warning(
                'Invalid OPENAI_TIMEOUT_SECONDS configured; falling back to default',
                extra={'configured_timeout': raw_value},
            )
            return 30
        return max(timeout_seconds, 1)

    def _parse_error(self, response: requests.Response) -> str:
        fallback = f'OpenAI retornou erro {response.status_code}.'
        try:
            payload = response.json()
        except ValueError:
            return fallback

        error = payload.get('error')
        if isinstance(error, dict):
            message = str(error.get('message') or '').strip()
            code = str(error.get('code') or '').strip()
            return message or code or fallback
        if isinstance(error, str):
            return error.strip() or fallback
        return fallback


class AssistantContextBuilder:
    def build(self, *, user, dashboard_id=None, page_context=None):
        dashboard = None
        if dashboard_id:
            dashboard = Dashboard.objects.select_related('tenant', 'workspace').prefetch_related('columns').filter(id=dashboard_id).first()
            if dashboard is None:
                raise AssistantIntegrationError('Dashboard informado nao foi encontrado.')
            if not has_dashboard_access(user, dashboard):
                raise AssistantIntegrationError('Voce nao tem permissao para consultar este dashboard.')

        accessible_dashboards = self._get_accessible_dashboards(user)
        visible_dashboard_names = list(accessible_dashboards.values_list('name', flat=True)[:12])
        dashboard_filters = build_user_report_filters(user, dashboard) if dashboard else []

        dashboard_context = {
            'dashboard_name': dashboard.name if dashboard else '',
            'dashboard_description': dashboard.description if dashboard else '',
            'dashboard_category': dashboard.category if dashboard else '',
            'dashboard_tags': dashboard.tags if dashboard else [],
            'workspace_name': dashboard.workspace.name if dashboard else '',
            'visible_dimensions': [
                {
                    'label': column.label,
                    'name': column.name,
                }
                for column in getattr(dashboard, 'columns', []).all()
            ]
            if dashboard
            else [],
            'access_filters': [
                {
                    'table': item['table'],
                    'column': item['column'],
                    'operator': item['operator'],
                    'values_count': len(item.get('values') or []),
                }
                for item in dashboard_filters
            ],
        }

        context = {
            'tenant_name': getattr(user.tenant, 'name', 'LemonAI') if getattr(user, 'tenant', None) else 'LemonAI',
            'user_role': getattr(getattr(user, 'role', None), 'code', 'viewer'),
            'visible_modules': ROLE_VISIBLE_MODULES.get(getattr(getattr(user, 'role', None), 'code', 'viewer'), ROLE_VISIBLE_MODULES['viewer']),
            'accessible_dashboards_count': accessible_dashboards.count(),
            'accessible_dashboard_examples': visible_dashboard_names,
            'current_page': {
                'key': str((page_context or {}).get('key') or '').strip()[:64],
                'title': str((page_context or {}).get('title') or '').strip()[:160],
                'path': str((page_context or {}).get('path') or '').strip()[:200],
                'description': str((page_context or {}).get('description') or '').strip()[:280],
                'is_dashboard': bool((page_context or {}).get('is_dashboard')),
            },
            'current_dashboard': dashboard_context,
            'phase': 'phase_1_support_and_dashboard_context',
        }
        return context, dashboard

    def _get_accessible_dashboards(self, user) -> QuerySet:
        queryset = Dashboard.objects.select_related('tenant', 'workspace').order_by('name')
        queryset = apply_tenant_scope(queryset, user)
        if is_super_admin(user):
            return queryset

        accessible_ids = get_user_accessible_dashboard_ids(user)
        if accessible_ids is None:
            return queryset
        if not accessible_ids:
            return queryset.none()
        return queryset.filter(id__in=accessible_ids)


class DashboardAssistantService:
    def __init__(self):
        self.openai_client = OpenAIChatClient()
        self.context_builder = AssistantContextBuilder()

    def answer(self, *, user, messages: list[dict[str, str]], dashboard_id=None, page_context=None) -> AssistantReply:
        context, dashboard = self.context_builder.build(user=user, dashboard_id=dashboard_id, page_context=page_context)
        system_prompt = self._build_system_prompt(context)
        response_messages = [
            {'role': 'system', 'content': system_prompt},
            *messages,
        ]
        reply = self.openai_client.complete(response_messages)
        context_summary = self._build_context_summary(context, dashboard_name=dashboard.name if dashboard else '')
        return AssistantReply(
            reply=reply,
            model=self.openai_client.model,
            dashboard_id=str(dashboard.id) if dashboard else None,
            context_summary=context_summary,
        )

    def _build_system_prompt(self, context: dict) -> str:
        return (
            "Voce e o assistente LemonAI, embutido dentro de uma plataforma analitica multi-tenant.\n"
            "Responda sempre em portugues do Brasil, com objetividade, clareza e tom profissional.\n"
            "Nunca exponha dados de outros tenants, dashboards ocultos, IDs internos, tokens, credenciais ou detalhes tecnicos sensiveis.\n"
            "Nao invente numeros, indicadores ou conclusoes sobre os dados. Se o usuario pedir valores do dashboard, diga que a fase 1 ainda nao le os dados numericos diretamente e ofereca orientacao sobre filtros, leitura do dashboard e proximos passos.\n"
            "Quando a pergunta for sobre uso do produto, explique passo a passo com base apenas no guia da plataforma abaixo.\n"
            "Quando a pergunta for sobre o dashboard atual, use somente o contexto seguro fornecido abaixo.\n"
            "Se algo nao estiver no contexto, deixe isso claro.\n\n"
            f"GUIA DA PLATAFORMA:\n{APP_HELP_GUIDE}\n\n"
            f"CONTEXTO SEGURO DO USUARIO E DASHBOARD:\n{json.dumps(context, ensure_ascii=False, indent=2)}"
        )

    def _build_context_summary(self, context: dict, dashboard_name: str) -> str:
        modules = ', '.join(context.get('visible_modules') or [])
        tenant_name = context.get('tenant_name') or 'LemonAI'
        page_title = ((context.get('current_page') or {}).get('title') or '').strip()
        if dashboard_name:
            return f'Tenant {tenant_name}. Dashboard atual: {dashboard_name}. Modulos visiveis: {modules}.'
        if page_title:
            return f'Tenant {tenant_name}. Tela atual: {page_title}. Modulos visiveis: {modules}.'
        return f'Tenant {tenant_name}. Modulos visiveis: {modules}.'
