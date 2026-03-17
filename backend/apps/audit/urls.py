from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.audit.views import AccessLogViewSet

router = DefaultRouter()
router.register('logs', AccessLogViewSet, basename='access-log')

urlpatterns = [
    path('', include(router.urls)),
]

