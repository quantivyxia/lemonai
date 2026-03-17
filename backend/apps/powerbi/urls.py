from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.powerbi.views import PowerBIConnectionViewSet, PowerBIGatewayDataSourceViewSet, PowerBIGatewayViewSet

router = DefaultRouter()
router.register('connections', PowerBIConnectionViewSet, basename='powerbi-connection')
router.register('gateways', PowerBIGatewayViewSet, basename='powerbi-gateway')
router.register('datasources', PowerBIGatewayDataSourceViewSet, basename='powerbi-datasource')

urlpatterns = [
    path('', include(router.urls)),
]

