from django.db import models

from apps.common.models import UUIDTimeStampedModel


class GatewayStatus(models.TextChoices):
    ACTIVE = 'active', 'Ativo'
    INACTIVE = 'inactive', 'Inativo'
    ERROR = 'error', 'Erro'


class DataSourceStatus(models.TextChoices):
    ACTIVE = 'active', 'Ativo'
    INACTIVE = 'inactive', 'Inativo'


class PowerBIConnection(UUIDTimeStampedModel):
    tenant = models.OneToOneField('tenants.Tenant', on_delete=models.CASCADE, related_name='powerbi_connection')
    aad_tenant_id = models.CharField(max_length=120)
    client_id = models.CharField(max_length=120)
    client_secret = models.CharField(max_length=255)
    scope = models.CharField(max_length=255, default='https://analysis.windows.net/powerbi/api/.default')
    api_base_url = models.URLField(default='https://api.powerbi.com/v1.0/myorg')
    default_workspace_id = models.CharField(max_length=160, blank=True)
    is_active = models.BooleanField(default=True)
    last_tested_at = models.DateTimeField(null=True, blank=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)

    class Meta:
        ordering = ['tenant__name']

    def __str__(self) -> str:
        return f'Power BI - {self.tenant.name}'


class PowerBIGateway(UUIDTimeStampedModel):
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='powerbi_gateways')
    connection = models.ForeignKey(
        'powerbi.PowerBIConnection',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='gateways',
    )
    name = models.CharField(max_length=180)
    external_gateway_id = models.CharField(max_length=180)
    gateway_type = models.CharField(max_length=80, blank=True)
    status = models.CharField(max_length=20, choices=GatewayStatus.choices, default=GatewayStatus.ACTIVE)
    notes = models.TextField(blank=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'external_gateway_id'], name='unique_gateway_per_tenant'),
        ]

    def __str__(self) -> str:
        return f'{self.tenant.name} - {self.name}'


class PowerBIGatewayDataSource(UUIDTimeStampedModel):
    gateway = models.ForeignKey('powerbi.PowerBIGateway', on_delete=models.CASCADE, related_name='datasources')
    name = models.CharField(max_length=180)
    external_datasource_id = models.CharField(max_length=180)
    datasource_type = models.CharField(max_length=80, blank=True)
    connection_details = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=DataSourceStatus.choices, default=DataSourceStatus.ACTIVE)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['gateway', 'external_datasource_id'],
                name='unique_datasource_per_gateway',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.gateway.name} - {self.name}'

