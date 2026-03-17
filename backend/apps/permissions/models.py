from django.db import models
from django.core.exceptions import ValidationError

from apps.common.models import UUIDTimeStampedModel


class RoleCode(models.TextChoices):
    SUPER_ADMIN = 'super_admin', 'Dono'
    ANALYST = 'analyst', 'Analista'
    VIEWER = 'viewer', 'Usuario'


class Role(UUIDTimeStampedModel):
    code = models.CharField(max_length=30, choices=RoleCode.choices, unique=True)
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


class Permission(UUIDTimeStampedModel):
    code = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=100)
    module = models.CharField(max_length=80)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['module', 'name']

    def __str__(self) -> str:
        return self.name


class RolePermission(UUIDTimeStampedModel):
    role = models.ForeignKey('permissions.Role', on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey('permissions.Permission', on_delete=models.CASCADE, related_name='permission_roles')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['role', 'permission'], name='unique_role_permission')
        ]

    def __str__(self) -> str:
        return f'{self.role.name} -> {self.permission.code}'


class AccessLevel(models.TextChoices):
    VIEW = 'view', 'Visualizar'
    EDIT = 'edit', 'Editar'
    ADMIN = 'admin', 'Administrador'


class DashboardAccess(UUIDTimeStampedModel):
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='dashboard_access_rules')
    dashboard = models.ForeignKey('dashboards.Dashboard', on_delete=models.CASCADE, related_name='access_rules')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, null=True, blank=True, related_name='dashboard_access_rules')
    group = models.ForeignKey('users.UserGroup', on_delete=models.CASCADE, null=True, blank=True, related_name='dashboard_access_rules')
    role = models.ForeignKey('permissions.Role', on_delete=models.CASCADE, null=True, blank=True, related_name='dashboard_access_rules')
    access_level = models.CharField(max_length=20, choices=AccessLevel.choices, default=AccessLevel.VIEW)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['dashboard__name']

    def clean(self):
        principals = [self.user_id, self.group_id, self.role_id]
        selected = [value for value in principals if value]
        if len(selected) != 1:
            raise ValidationError('Informe exatamente um principal: user, group ou role.')

        if self.dashboard_id and self.tenant_id and self.dashboard.tenant_id != self.tenant_id:
            raise ValidationError('Tenant da regra deve ser igual ao tenant do dashboard.')

    def __str__(self) -> str:
        principal = self.user or self.group or self.role
        return f'{self.dashboard.name} -> {principal}'


class RuleType(models.TextChoices):
    ALLOW = 'allow', 'Permitir'
    DENY = 'deny', 'Negar'


class RuleOperator(models.TextChoices):
    IN = 'in', 'IN'
    NOT_IN = 'not_in', 'NOT IN'


class RLSRule(UUIDTimeStampedModel):
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='rls_rules')
    dashboard = models.ForeignKey('dashboards.Dashboard', on_delete=models.CASCADE, related_name='rls_rules')
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='rls_rules')
    table_name = models.CharField(max_length=160, blank=True)
    column_name = models.CharField(max_length=120)
    operator = models.CharField(max_length=20, choices=RuleOperator.choices, default=RuleOperator.IN)
    rule_type = models.CharField(max_length=12, choices=RuleType.choices, default=RuleType.ALLOW)
    values = models.JSONField(default=list)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['dashboard__name', 'user__first_name']

    def clean(self):
        if self.dashboard_id and self.user_id and self.dashboard.tenant_id != self.user.tenant_id:
            raise ValidationError('Usuario e dashboard devem pertencer ao mesmo tenant.')
        if self.dashboard_id and self.tenant_id and self.dashboard.tenant_id != self.tenant_id:
            raise ValidationError('Tenant da regra deve ser igual ao tenant do dashboard.')
        if self.table_name and not self.table_name.strip():
            raise ValidationError('table_name nao pode conter apenas espacos.')
        if not isinstance(self.values, list) or len(self.values) == 0:
            raise ValidationError('values deve ser uma lista com ao menos um valor.')

    def __str__(self) -> str:
        return f'{self.dashboard.name} - {self.user.email} - {self.column_name}'

