from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from apps.audit.services import create_system_event
from apps.common.request_context import get_request_id
from apps.common.services import get_actor_user, get_effective_user

logger = logging.getLogger('insighthub.api')


def _response(detail: str, *, status_code: int, errors=None):
    payload = {
        'detail': detail,
        'request_id': get_request_id(),
    }
    if errors is not None:
        payload['errors'] = errors
    return Response(payload, status=status_code)


def api_exception_handler(exc, context):
    request = context.get('request')
    response = drf_exception_handler(exc, context)

    actor = get_actor_user(request) if request else None
    effective = get_effective_user(request) if request else None
    log_extra = {
        'method': getattr(request, 'method', ''),
        'path': getattr(request, 'path', ''),
        'user_id': str(getattr(actor, 'id', '') or getattr(effective, 'id', '')),
        'tenant_id': str(getattr(effective, 'tenant_id', '') or getattr(actor, 'tenant_id', '')),
    }

    if response is None:
        logger.exception('Unhandled API exception', extra=log_extra)
        create_system_event(
            level='error',
            category='system',
            action='api.unhandled_exception',
            message='Erro interno nao tratado na API.',
            request=request,
            user=actor,
            tenant=getattr(effective, 'tenant', None) or getattr(actor, 'tenant', None),
            status_code=500,
            metadata={'exception_type': exc.__class__.__name__},
        )
        return _response('Erro interno do servidor.', status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if isinstance(exc, ValidationError):
        logger.warning('Validation error', extra={**log_extra, 'status_code': response.status_code})
        return _response('Dados invalidos.', status_code=response.status_code, errors=response.data)

    if isinstance(exc, (AuthenticationFailed, NotAuthenticated)):
        logger.warning('Authentication error', extra={**log_extra, 'status_code': response.status_code})
        create_system_event(
            level='warn',
            category='auth',
            action='auth.failed',
            message='Falha de autenticacao.',
            request=request,
            user=actor,
            tenant=getattr(actor, 'tenant', None),
            status_code=response.status_code,
            metadata={'exception_type': exc.__class__.__name__},
        )
        return _response('Autenticacao invalida ou expirada.', status_code=response.status_code)

    if isinstance(exc, PermissionDenied):
        logger.warning('Permission denied', extra={**log_extra, 'status_code': response.status_code})
        create_system_event(
            level='warn',
            category='authorization',
            action='authz.denied',
            message='Acesso negado.',
            request=request,
            user=actor,
            tenant=getattr(effective, 'tenant', None) or getattr(actor, 'tenant', None),
            status_code=response.status_code,
            metadata={'exception_type': exc.__class__.__name__},
        )
        return _response(str(exc) or 'Voce nao tem permissao para executar essa acao.', status_code=response.status_code)

    if response.status_code >= 500:
        logger.error('API server error', extra={**log_extra, 'status_code': response.status_code})
        return _response('Erro interno do servidor.', status_code=response.status_code)

    detail = response.data.get('detail') if isinstance(response.data, dict) else None
    return _response(detail or 'Requisicao invalida.', status_code=response.status_code, errors=response.data)
