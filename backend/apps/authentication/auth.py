from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.common.services import SAFE_METHODS, can_actor_view_as_target


class ViewAsJWTAuthentication(JWTAuthentication):
    header_name = 'HTTP_X_INSIGHTHUB_VIEW_AS_USER'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user_model = get_user_model()

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        actor_user, validated_token = result
        request.actor_user = actor_user
        request.effective_user = actor_user
        request.view_as_mode = False

        raw_user_id = str(request.META.get(self.header_name, '')).strip()
        if not raw_user_id:
            return actor_user, validated_token

        if request.method not in SAFE_METHODS:
            raise PermissionDenied('Modo "Ver tela do usuario" permite apenas visualizacao. Alteracoes estao bloqueadas.')

        try:
            target_user = self.user_model.objects.select_related('tenant', 'role', 'primary_group').get(id=raw_user_id)
        except self.user_model.DoesNotExist as exc:
            raise NotFound('Usuario selecionado para simulacao nao foi encontrado.') from exc

        if not can_actor_view_as_target(actor_user, target_user):
            raise PermissionDenied('Voce nao possui permissao para visualizar o ambiente deste usuario.')

        request.effective_user = target_user
        request.view_as_mode = True
        return target_user, validated_token

