import logging
import urllib.parse

from django.conf import settings
from django.core import signing
from django.http import HttpResponseRedirect
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.audit.services import create_system_event
from apps.authentication import microsoft as ms_oauth
from apps.authentication.serializers import InsightHubTokenObtainPairSerializer, MeSerializer
from apps.tenants.models import Tenant
from apps.users.models import AuthProvider, User

logger = logging.getLogger('insighthub.api')


def safe_create_system_event(**kwargs):
    try:
        create_system_event(**kwargs)
    except Exception:  # noqa: BLE001
        logger.exception('Failed to persist authentication system event')


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = InsightHubTokenObtainPairSerializer
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        safe_create_system_event(
            level='info',
            category='auth',
            action='auth.login',
            message='Login realizado com sucesso.',
            request=request,
            user=user,
            tenant=getattr(user, 'tenant', None),
            status_code=status.HTTP_200_OK,
        )
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        refresh_token = serializer.validated_data['refresh']
        try:
            RefreshToken(refresh_token).blacklist()
        except TokenError as exc:
            raise serializers.ValidationError({'refresh': 'Refresh token invalido ou expirado.'}) from exc

        safe_create_system_event(
            level='info',
            category='auth',
            action='auth.logout',
            message='Logout realizado com sucesso.',
            request=request,
            user=request.user,
            tenant=getattr(request.user, 'tenant', None),
            status_code=status.HTTP_204_NO_CONTENT,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)


def _make_jwt_pair(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def _redirect_frontend(path: str, params: dict | None = None) -> HttpResponseRedirect:
    frontend_url = settings.FRONTEND_URL.rstrip('/')
    url = f'{frontend_url}{path}'
    if params:
        url += '?' + urllib.parse.urlencode(params)
    return HttpResponseRedirect(url)


def _callback_redirect_uri(request) -> str:
    return request.build_absolute_uri('/api/authentication/microsoft/callback/')


class MicrosoftLoginView(APIView):
    """Initiates Microsoft OAuth flow — redirects user to Azure AD."""
    permission_classes = [AllowAny]

    def get(self, request):
        if not getattr(settings, 'MICROSOFT_CLIENT_ID', None):
            return Response({'detail': 'Login com Microsoft nao configurado.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        auth_url, _ = ms_oauth.build_auth_url(_callback_redirect_uri(request))
        return HttpResponseRedirect(auth_url)


class MicrosoftCallbackView(APIView):
    """Handles Azure AD callback after user authenticates."""
    permission_classes = [AllowAny]

    def get(self, request):
        error = request.query_params.get('error')
        if error:
            logger.warning('Microsoft OAuth error: %s', error)
            return _redirect_frontend('/auth/login', {'ms_error': 'access_denied'})

        code = request.query_params.get('code')
        state = request.query_params.get('state')

        if not code or not ms_oauth.validate_state(state or ''):
            return _redirect_frontend('/auth/login', {'ms_error': 'invalid_state'})

        try:
            profile = ms_oauth.exchange_code_for_profile(code, _callback_redirect_uri(request))
        except Exception:
            logger.exception('Failed to exchange Microsoft OAuth code')
            return _redirect_frontend('/auth/login', {'ms_error': 'token_failed'})

        email = (profile.get('mail') or profile.get('userPrincipalName', '')).lower().strip()
        if not email:
            return _redirect_frontend('/auth/login', {'ms_error': 'no_email'})

        try:
            user = User.objects.select_related('tenant', 'role').get(email=email)
        except User.DoesNotExist:
            # New user — redirect to join flow carrying signed profile
            profile_token = ms_oauth.sign_profile(profile)
            return _redirect_frontend('/auth/join', {'state': profile_token})

        # Existing user: block if they registered via email/password
        if user.auth_provider != AuthProvider.MICROSOFT:
            return _redirect_frontend('/auth/login', {'ms_error': 'email_account'})

        if user.status != 'active':
            return _redirect_frontend('/auth/login', {'ms_error': 'inactive'})

        tokens = _make_jwt_pair(user)
        safe_create_system_event(
            level='info',
            category='auth',
            action='auth.login.microsoft',
            message='Login Microsoft realizado com sucesso.',
            request=request,
            user=user,
            tenant=getattr(user, 'tenant', None),
            status_code=200,
        )
        return _redirect_frontend('/auth/microsoft/callback', tokens)


class MicrosoftJoinView(APIView):
    """Creates a new user who authenticated via Microsoft and provides a tenant join code."""
    permission_classes = [AllowAny]

    def post(self, request):
        state = request.data.get('state', '')
        join_code = (request.data.get('join_code') or '').strip().upper()

        if not state or not join_code:
            raise serializers.ValidationError({'detail': 'Estado e codigo da empresa sao obrigatorios.'})

        try:
            profile = ms_oauth.load_profile(state)
        except signing.SignatureExpired:
            raise serializers.ValidationError({'detail': 'Sessao expirada. Faca login novamente.'})
        except signing.BadSignature:
            raise serializers.ValidationError({'detail': 'Estado invalido. Tente novamente.'})

        try:
            tenant = Tenant.objects.get(join_code=join_code, status='active')
        except Tenant.DoesNotExist:
            raise serializers.ValidationError({'join_code': 'Codigo da empresa invalido ou inativo.'})

        email = profile['email'].lower().strip()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError({'detail': 'Este e-mail ja possui cadastro na plataforma.'})

        from apps.permissions.models import Role
        try:
            viewer_role = Role.objects.get(code='viewer')
        except Role.DoesNotExist:
            viewer_role = None

        user = User.objects.create_user(
            email=email,
            password=None,
            first_name=profile.get('first_name', ''),
            last_name=profile.get('last_name', ''),
            tenant=tenant,
            role=viewer_role,
            auth_provider=AuthProvider.MICROSOFT,
            status='active',
        )
        # Microsoft users have no usable password
        user.set_unusable_password()
        user.save(update_fields=['password'])

        tokens = _make_jwt_pair(user)
        safe_create_system_event(
            level='info',
            category='auth',
            action='auth.register.microsoft',
            message='Novo usuario registrado via Microsoft.',
            request=request,
            user=user,
            tenant=tenant,
            status_code=201,
        )
        tokens['user'] = MeSerializer(user).data
        return Response(tokens, status=status.HTTP_201_CREATED)

