import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.assistant.serializers import AssistantChatRequestSerializer
from apps.assistant.services import (
    AssistantConfigurationError,
    AssistantIntegrationError,
    DashboardAssistantService,
)
from apps.audit.services import create_system_event
from apps.common.request_context import get_request_id
from apps.common.services import get_effective_user

logger = logging.getLogger('insighthub.api')


def safe_create_system_event(**kwargs):
    try:
        create_system_event(**kwargs)
    except Exception:  # noqa: BLE001
        logger.exception('Failed to persist assistant system event')


class AssistantChatView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'assistant'

    def post(self, request):
        serializer = AssistantChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        effective_user = get_effective_user(request)
        dashboard_id = serializer.validated_data.get('dashboard_id')
        page_context = serializer.validated_data.get('page_context') or {}
        messages = serializer.validated_data['messages']
        service = DashboardAssistantService()

        try:
            reply = service.answer(
                user=effective_user,
                dashboard_id=dashboard_id,
                page_context=page_context,
                messages=messages,
            )
        except AssistantConfigurationError as exc:
            safe_create_system_event(
                level='warn',
                category='integration',
                action='assistant.chat.config_error',
                message='Assistente IA nao configurado no backend.',
                request=request,
                user=effective_user,
                tenant=getattr(effective_user, 'tenant', None),
                resource_type='assistant_chat',
                resource_id=str(dashboard_id or ''),
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                metadata={
                    'dashboard_id': str(dashboard_id or ''),
                    'page_key': page_context.get('key', ''),
                    'page_path': page_context.get('path', ''),
                    'message_count': len(messages),
                },
            )
            return Response(
                {'detail': str(exc), 'request_id': get_request_id()},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AssistantIntegrationError as exc:
            safe_create_system_event(
                level='error',
                category='integration',
                action='assistant.chat.failed',
                message='Falha ao responder pelo assistente IA.',
                request=request,
                user=effective_user,
                tenant=getattr(effective_user, 'tenant', None),
                resource_type='assistant_chat',
                resource_id=str(dashboard_id or ''),
                status_code=status.HTTP_400_BAD_REQUEST,
                metadata={
                    'dashboard_id': str(dashboard_id or ''),
                    'page_key': page_context.get('key', ''),
                    'page_path': page_context.get('path', ''),
                    'message_count': len(messages),
                    'error': str(exc),
                },
            )
            return Response({'detail': str(exc), 'request_id': get_request_id()}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:  # noqa: BLE001
            logger.exception('Unexpected assistant error')
            safe_create_system_event(
                level='error',
                category='system',
                action='assistant.chat.unhandled_error',
                message='Erro interno nao tratado no assistente IA.',
                request=request,
                user=effective_user,
                tenant=getattr(effective_user, 'tenant', None),
                resource_type='assistant_chat',
                resource_id=str(dashboard_id or ''),
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                metadata={
                    'dashboard_id': str(dashboard_id or ''),
                    'page_key': page_context.get('key', ''),
                    'page_path': page_context.get('path', ''),
                    'message_count': len(messages),
                    'exception_type': exc.__class__.__name__,
                },
            )
            return Response(
                {
                    'detail': 'Falha interna ao processar o assistente no servidor.',
                    'request_id': get_request_id(),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        safe_create_system_event(
            level='info',
            category='integration',
            action='assistant.chat.success',
            message='Assistente IA respondeu com sucesso.',
            request=request,
            user=effective_user,
            tenant=getattr(effective_user, 'tenant', None),
            resource_type='assistant_chat',
            resource_id=str(reply.dashboard_id or ''),
            status_code=status.HTTP_200_OK,
            metadata={
                'dashboard_id': str(reply.dashboard_id or ''),
                'page_key': page_context.get('key', ''),
                'page_path': page_context.get('path', ''),
                'message_count': len(messages),
                'model': reply.model,
            },
        )
        return Response(
            {
                **reply.to_dict(),
                'requestId': get_request_id(),
            },
            status=status.HTTP_200_OK,
        )
