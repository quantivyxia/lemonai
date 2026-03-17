import django_filters

from apps.branding.models import ClientBranding


class ClientBrandingFilter(django_filters.FilterSet):
    tenant = django_filters.UUIDFilter(field_name='tenant_id')
    platform_name = django_filters.CharFilter(field_name='platform_name', lookup_expr='icontains')

    class Meta:
        model = ClientBranding
        fields = ['tenant', 'platform_name', 'domain']

