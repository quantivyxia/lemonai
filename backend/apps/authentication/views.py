from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.authentication.serializers import InsightHubTokenObtainPairSerializer, MeSerializer


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = InsightHubTokenObtainPairSerializer


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

