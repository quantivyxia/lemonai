from django.db import models

from apps.common.models import UUIDTimeStampedModel


class ClientBranding(UUIDTimeStampedModel):
    tenant = models.OneToOneField('tenants.Tenant', on_delete=models.CASCADE, related_name='branding')
    platform_name = models.CharField(max_length=180)
    logo_url = models.URLField(blank=True)
    favicon_url = models.URLField(blank=True)
    primary_color = models.CharField(max_length=12, default='#0f6fe8')
    secondary_color = models.CharField(max_length=12, default='#14b8a6')
    domain = models.CharField(max_length=255, blank=True)
    custom_domain_enabled = models.BooleanField(default=False)

    class Meta:
        ordering = ['tenant__name']

    def __str__(self) -> str:
        return f'Branding - {self.tenant.name}'

