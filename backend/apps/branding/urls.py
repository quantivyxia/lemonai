from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.branding.views import ClientBrandingViewSet

router = DefaultRouter()
router.register('', ClientBrandingViewSet, basename='branding')

urlpatterns = [
    path('', include(router.urls)),
]

