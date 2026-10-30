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


class SystemEventLevel(models.TextChoices):
    INFO = 'info', 'Info'
    WARN = 'warn', 'Warn'
    ERROR = 'error', 'Error'


class SystemEventCategory(models.TextChoices):
    AUTH = 'auth', 'Auth'
    AUTHORIZATION = 'authorization', 'Authorization'
    ADMIN = 'admin', 'Admin'
    INTEGRATION = 'integration', 'Integration'
    SYSTEM = 'system', 'System'


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


class SystemEventLog(UUIDTimeStampedModel):
    user = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='system_events')
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.SET_NULL, null=True, blank=True, related_name='system_events')
    level = models.CharField(max_length=20, choices=SystemEventLevel.choices, default=SystemEventLevel.INFO)
    category = models.CharField(max_length=30, choices=SystemEventCategory.choices, default=SystemEventCategory.SYSTEM)
    action = models.CharField(max_length=120)
    message = models.TextField()
    resource_type = models.CharField(max_length=120, blank=True)
    resource_id = models.CharField(max_length=120, blank=True)
    endpoint = models.CharField(max_length=255, blank=True)
    method = models.CharField(max_length=12, blank=True)
    request_id = models.CharField(max_length=64, blank=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['category', 'level', 'created_at']),
            models.Index(fields=['tenant', 'created_at']),
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self) -> str:
        return f'{self.category}:{self.action}:{self.level}'

