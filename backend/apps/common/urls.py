from django.urls import path

from .views import HealthCheckView, LiveHealthCheckView, ReadyHealthCheckView, SystemSummaryView

urlpatterns = [
    path('', HealthCheckView.as_view(), name='health-check'),
    path('live/', LiveHealthCheckView.as_view(), name='health-live'),
    path('ready/', ReadyHealthCheckView.as_view(), name='health-ready'),
    path('summary/', SystemSummaryView.as_view(), name='health-summary'),
]
