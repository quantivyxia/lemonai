from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.dashboards.views import DashboardColumnViewSet, DashboardViewSet

router = DefaultRouter()
router.register('columns', DashboardColumnViewSet, basename='dashboard-column')
router.register('', DashboardViewSet, basename='dashboard')

urlpatterns = [
    path('', include(router.urls)),
]

