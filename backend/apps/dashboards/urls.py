from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.dashboards.views import DashboardColumnViewSet, DashboardViewSet
from apps.dashboards.python_dashboard import CulturaDashboardDataView, PythonDashboardAvailabilityView
from apps.dashboards.python_dashboard import BaianaDashboardDataView, PythonDashboardCatalogView

router = DefaultRouter()
router.register('columns', DashboardColumnViewSet, basename='dashboard-column')
router.register('', DashboardViewSet, basename='dashboard')

urlpatterns = [
    path('python/catalog/', PythonDashboardCatalogView.as_view(), name='python-dashboard-catalog'),
    path('python/faculdade-baiana/', BaianaDashboardDataView.as_view(), name='baiana-dashboard-data'),
    path('python/', PythonDashboardAvailabilityView.as_view(), name='python-dashboard-availability'),
    path('python/cultura-inglesa/', CulturaDashboardDataView.as_view(), name='cultura-dashboard-data'),
    path('', include(router.urls)),
]

