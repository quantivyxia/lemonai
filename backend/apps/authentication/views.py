from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.audit.services import create_system_event
from apps.authentication.serializers import InsightHubTokenObtainPairSerializer, MeSerializer


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = InsightHubTokenObtainPairSerializer
    throttle_scope = 'login'

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        create_system_event(
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

        create_system_event(
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

