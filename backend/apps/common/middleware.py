from __future__ import annotations

from django.contrib.auth import get_user_model
from django.http import JsonResponse

from apps.common.services import SAFE_METHODS, can_actor_view_as_target


class ViewAsUserMiddleware:
    header_name = 'HTTP_X_INSIGHTHUB_VIEW_AS_USER'

    def __init__(self, get_response):
        self.get_response = get_response
        self.user_model = get_user_model()

    def __call__(self, request):
        actor_user = getattr(request, 'user', None)
        request.actor_user = actor_user
        request.effective_user = actor_user
        request.view_as_mode = False

        if not actor_user or not getattr(actor_user, 'is_authenticated', False):
            return self.get_response(request)

        raw_user_id = str(request.META.get(self.header_name, '')).strip()
        if not raw_user_id:
            return self.get_response(request)

        if request.method not in SAFE_METHODS:
            return JsonResponse(
                {'detail': 'Modo "Ver tela do usuario" permite apenas visualizacao. Alteracoes estao bloqueadas.'},
                status=403,
            )

        try:
            target_user = self.user_model.objects.select_related('tenant', 'role', 'primary_group').get(id=raw_user_id)
        except self.user_model.DoesNotExist:
            return JsonResponse({'detail': 'Usuario selecionado para simulacao nao foi encontrado.'}, status=404)

        if not can_actor_view_as_target(actor_user, target_user):
            return JsonResponse(
                {'detail': 'Voce nao possui permissao para visualizar o ambiente deste usuario.'},
                status=403,
            )

        request.user = target_user
        request.effective_user = target_user
        request.view_as_mode = True
        return self.get_response(request)

