from rest_framework import viewsets

from apps.branding.filters import ClientBrandingFilter
from apps.branding.models import ClientBranding
from apps.branding.permissions import BrandingPermission
from apps.branding.serializers import ClientBrandingSerializer
from apps.common.services import apply_tenant_scope, is_super_admin


class ClientBrandingViewSet(viewsets.ModelViewSet):
    serializer_class = ClientBrandingSerializer
    permission_classes = [BrandingPermission]
    filterset_class = ClientBrandingFilter
    search_fields = ['platform_name', 'domain', 'tenant__name']
    ordering_fields = ['platform_name', 'updated_at', 'created_at']
    ordering = ['platform_name']

    def get_queryset(self):
        queryset = ClientBranding.objects.select_related('tenant')
        return apply_tenant_scope(queryset, self.request.user)

    def perform_create(self, serializer):
        if not is_super_admin(self.request.user):
            serializer.save(tenant=self.request.user.tenant)
            return
        serializer.save()

