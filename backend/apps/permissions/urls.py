from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.permissions.views import (
    DashboardAccessViewSet,
    PermissionViewSet,
    RLSRuleViewSet,
    RolePermissionViewSet,
    RoleViewSet,
)

router = DefaultRouter()
router.register('roles', RoleViewSet, basename='role')
router.register('permission-items', PermissionViewSet, basename='permission-item')
router.register('role-permissions', RolePermissionViewSet, basename='role-permission')
router.register('dashboard-access', DashboardAccessViewSet, basename='dashboard-access')
router.register('rls-rules', RLSRuleViewSet, basename='rls-rule')

urlpatterns = [
    path('', include(router.urls)),
]

