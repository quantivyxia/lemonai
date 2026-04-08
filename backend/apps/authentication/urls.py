from django.urls import path

from apps.authentication.views import (
    LoginView,
    LogoutView,
    MeView,
    MicrosoftCallbackView,
    MicrosoftJoinView,
    MicrosoftLoginView,
    RefreshView,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('refresh/', RefreshView.as_view(), name='auth-refresh'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('microsoft/', MicrosoftLoginView.as_view(), name='auth-microsoft-login'),
    path('microsoft/callback/', MicrosoftCallbackView.as_view(), name='auth-microsoft-callback'),
    path('microsoft/join/', MicrosoftJoinView.as_view(), name='auth-microsoft-join'),
]

