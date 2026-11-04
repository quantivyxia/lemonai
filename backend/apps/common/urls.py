from django.urls import path

from .views import (
    DashboardHomeInsightsView,
    HealthCheckView,
    LiveHealthCheckView,
    ReadyHealthCheckView,
    SystemSummaryView,
)

urlpatterns = [
    path('', HealthCheckView.as_view(), name='health-check'),
    path('live/', LiveHealthCheckView.as_view(), name='health-live'),
    path('ready/', ReadyHealthCheckView.as_view(), name='health-ready'),
    path('summary/', SystemSummaryView.as_view(), name='health-summary'),
    path('dashboard-home/', DashboardHomeInsightsView.as_view(), name='dashboard-home-insights'),
]
