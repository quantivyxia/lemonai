from django.db import models

from apps.common.models import UUIDTimeStampedModel


class WorkspaceStatus(models.TextChoices):
    ACTIVE = 'active', 'Ativo'
    SYNCING = 'syncing', 'Sincronizando'
    INACTIVE = 'inactive', 'Inativo'


class Workspace(UUIDTimeStampedModel):
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='workspaces')
    name = models.CharField(max_length=140)
    external_workspace_id = models.CharField(max_length=160)
    status = models.CharField(max_length=20, choices=WorkspaceStatus.choices, default=WorkspaceStatus.ACTIVE)
    last_sync_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'name'], name='unique_workspace_name_per_tenant')
        ]

    def __str__(self) -> str:
        return f'{self.tenant.name} - {self.name}'

