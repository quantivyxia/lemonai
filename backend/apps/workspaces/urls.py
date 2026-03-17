from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.workspaces.views import WorkspaceViewSet

router = DefaultRouter()
router.register('', WorkspaceViewSet, basename='workspace')

urlpatterns = [
    path('', include(router.urls)),
]

