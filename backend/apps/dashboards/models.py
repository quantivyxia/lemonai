from django.db import models

from apps.common.models import UUIDTimeStampedModel


class DashboardStatus(models.TextChoices):
    ACTIVE = 'active', 'Ativo'
    DRAFT = 'draft', 'Rascunho'
    ARCHIVED = 'archived', 'Arquivado'


class Dashboard(UUIDTimeStampedModel):
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='dashboards')
    workspace = models.ForeignKey('workspaces.Workspace', on_delete=models.CASCADE, related_name='dashboards')

    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=120)
    status = models.CharField(max_length=20, choices=DashboardStatus.choices, default=DashboardStatus.DRAFT)

    embed_url = models.URLField(blank=True, max_length=2048)
    report_id = models.CharField(max_length=160, blank=True)
    dataset_id = models.CharField(max_length=160, blank=True)
    external_workspace_id = models.CharField(max_length=160, blank=True)
    thumbnail_url = models.URLField(blank=True, max_length=2048)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    refresh_schedule = models.CharField(max_length=80, blank=True)
    tags = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'name'], name='unique_dashboard_name_per_tenant')
        ]

    def save(self, *args, **kwargs):
        if not self.external_workspace_id and self.workspace_id:
            self.external_workspace_id = self.workspace.external_workspace_id
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f'{self.tenant.name} - {self.name}'


class DashboardColumn(UUIDTimeStampedModel):
    dashboard = models.ForeignKey('dashboards.Dashboard', on_delete=models.CASCADE, related_name='columns')
    name = models.CharField(max_length=120)
    label = models.CharField(max_length=120)
    values = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['label']
        constraints = [
            models.UniqueConstraint(fields=['dashboard', 'name'], name='unique_column_name_per_dashboard')
        ]

    def __str__(self) -> str:
        return f'{self.dashboard.name} - {self.label}'

