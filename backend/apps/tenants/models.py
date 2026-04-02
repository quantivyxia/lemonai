from django.db import models
from django.utils.text import slugify

from apps.common.models import UUIDTimeStampedModel


class TenantStatus(models.TextChoices):
    ACTIVE = 'active', 'Ativo'
    INACTIVE = 'inactive', 'Inativo'
    SUSPENDED = 'suspended', 'Suspenso'


class Tenant(UUIDTimeStampedModel):
    name = models.CharField(max_length=180, unique=True)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    domain = models.CharField(max_length=255, blank=True, null=True, unique=True)
    status = models.CharField(max_length=20, choices=TenantStatus.choices, default=TenantStatus.ACTIVE)
    max_users = models.PositiveIntegerField(default=25)
    max_dashboards = models.PositiveIntegerField(default=20)
    support_hours_total = models.DecimalField(max_digits=8, decimal_places=1, default=0)
    support_hours_consumed = models.DecimalField(max_digits=8, decimal_places=1, default=0)

    # Preparacao para Power BI Embedded por tenant
    powerbi_workspace_id = models.CharField(max_length=150, blank=True)
    powerbi_tenant_id = models.CharField(max_length=150, blank=True)
    powerbi_client_id = models.CharField(max_length=150, blank=True)

    class Meta:
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name

