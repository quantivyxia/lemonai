from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.audit.views import AccessLogViewSet, AuditInsightsView, SystemEventLogViewSet

router = DefaultRouter()
router.register('logs', AccessLogViewSet, basename='access-log')
router.register('system-events', SystemEventLogViewSet, basename='system-event-log')

urlpatterns = [
    path('insights/', AuditInsightsView.as_view(), name='audit-insights'),
    path('', include(router.urls)),
]

