from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/health/', include('apps.common.urls')),
    path('api/authentication/', include('apps.authentication.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/tenants/', include('apps.tenants.urls')),
    path('api/dashboards/', include('apps.dashboards.urls')),
    path('api/workspaces/', include('apps.workspaces.urls')),
    path('api/permissions/', include('apps.permissions.urls')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/branding/', include('apps.branding.urls')),
    path('api/powerbi/', include('apps.powerbi.urls')),
]
