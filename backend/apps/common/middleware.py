from __future__ import annotations

import logging
import time
import uuid

from django.http import JsonResponse

from apps.audit.services import create_system_event
from apps.common.request_context import reset_request_id, set_request_id
from apps.common.services import get_actor_user, get_effective_user

logger = logging.getLogger('insighthub.request')


class RequestContextMiddleware:
    request_id_header = 'HTTP_X_REQUEST_ID'
    response_header = 'X-Request-ID'

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = str(request.META.get(self.request_id_header) or uuid.uuid4())
        request.request_id = request_id
        token = set_request_id(request_id)
        started_at = time.perf_counter()

        try:
            response = self.get_response(request)
        except Exception as exc:  # noqa: BLE001
            actor = get_actor_user(request)
            effective = get_effective_user(request)
            logger.exception(
                'Unhandled request exception',
                extra={
                    'method': request.method,
                    'path': request.path,
                    'status_code': 500,
                    'user_id': str(getattr(actor, 'id', '') or getattr(effective, 'id', '')),
                    'tenant_id': str(getattr(effective, 'tenant_id', '') or getattr(actor, 'tenant_id', '')),
                },
            )
            self._safe_create_system_event(
                level='error',
                category='system',
                action='request.unhandled_exception',
                message='Erro interno nao tratado durante o processamento da requisicao.',
                request=request,
                user=actor,
                tenant=getattr(effective, 'tenant', None) or getattr(actor, 'tenant', None),
                status_code=500,
                metadata={'exception_type': exc.__class__.__name__},
            )
            response = JsonResponse({'detail': 'Erro interno do servidor.', 'request_id': request_id}, status=500)

        try:
            duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
            response[self.response_header] = request_id
            actor_user = get_actor_user(request)
            effective_user = get_effective_user(request)
            status_code = getattr(response, 'status_code', 0)
            logger.info(
                'Request completed',
                extra={
                    'method': request.method,
                    'path': request.path,
                    'status_code': status_code,
                    'duration_ms': duration_ms,
                    'user_id': str(getattr(actor_user, 'id', '') or getattr(effective_user, 'id', '')),
                    'tenant_id': str(getattr(effective_user, 'tenant_id', '') or getattr(actor_user, 'tenant_id', '')),
                },
            )

            self._log_mutation_event(request, response, actor_user, effective_user)
            return response
        finally:
            reset_request_id(token)

    def _safe_create_system_event(self, **kwargs):
        try:
            create_system_event(**kwargs)
        except Exception:  # noqa: BLE001
            logger.exception('Failed to persist system event')

    def _resolve_category(self, path: str) -> str:
        if path.startswith('/api/authentication/'):
            return 'auth'
        if path.startswith('/api/powerbi/'):
            return 'integration'
        if path.startswith('/api/health/'):
            return 'system'
        return 'admin'

    def _log_mutation_event(self, request, response, actor_user, effective_user):
        if request.method in {'GET', 'HEAD', 'OPTIONS'}:
            return
        if request.path.startswith('/api/health/') or request.path.startswith('/api/docs/') or request.path.startswith('/api/schema/'):
            return

        status_code = getattr(response, 'status_code', 0)
        category = self._resolve_category(request.path)
        action = f'{request.method.lower()} {request.path}'
        message = (
            'Operacao administrativa executada com sucesso.'
            if 200 <= status_code < 400
            else 'Operacao administrativa retornou erro.'
        )
        level = 'info' if 200 <= status_code < 400 else 'warn'
        path_parts = [part for part in request.path.strip('/').split('/') if part]
        resource_type = path_parts[1] if len(path_parts) > 1 else ''

        self._safe_create_system_event(
            level=level,
            category=category,
            action=action,
            message=message,
            request=request,
            user=actor_user,
            tenant=getattr(effective_user, 'tenant', None) or getattr(actor_user, 'tenant', None),
            resource_type=resource_type,
            resource_id=path_parts[-1] if len(path_parts) > 2 else '',
            status_code=status_code,
        )
