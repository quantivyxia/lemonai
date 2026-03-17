from django.db import models

from apps.common.models import UUIDTimeStampedModel


class AccessStatus(models.TextChoices):
    SUCCESS = 'success', 'Sucesso'
    DENIED = 'denied', 'Negado'
    ERROR = 'error', 'Erro'


class AccessOrigin(models.TextChoices):
    PORTAL = 'portal', 'Portal'
    API = 'api', 'API'
    MOBILE = 'mobile', 'Mobile'


class AccessLog(UUIDTimeStampedModel):
    user = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='access_logs')
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='access_logs')
    dashboard = models.ForeignKey('dashboards.Dashboard', on_delete=models.SET_NULL, null=True, blank=True, related_name='access_logs')

    ip_address = models.GenericIPAddressField()
    accessed_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=AccessStatus.choices, default=AccessStatus.SUCCESS)
    origin = models.CharField(max_length=20, choices=AccessOrigin.choices, default=AccessOrigin.PORTAL)
    details = models.TextField(blank=True)

    class Meta:
        ordering = ['-accessed_at']

    def __str__(self) -> str:
        return f'{self.tenant.name} - {self.status} - {self.accessed_at:%Y-%m-%d %H:%M}'

