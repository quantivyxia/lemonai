from django.db import models
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.utils import timezone

from apps.common.models import UUIDTimeStampedModel


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError('Email obrigatorio.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password or '123456', **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('status', UserStatus.ACTIVE)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser deve ter is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser deve ter is_superuser=True.')

        return self._create_user(email, password, **extra_fields)


class UserStatus(models.TextChoices):
    ACTIVE = 'active', 'Ativo'
    INACTIVE = 'inactive', 'Inativo'


class User(AbstractBaseUser, PermissionsMixin, UUIDTimeStampedModel):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)

    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    role = models.ForeignKey('permissions.Role', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    primary_group = models.ForeignKey('users.UserGroup', on_delete=models.SET_NULL, null=True, blank=True, related_name='primary_members')

    status = models.CharField(max_length=20, choices=UserStatus.choices, default=UserStatus.ACTIVE)
    avatar_url = models.URLField(blank=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        ordering = ['first_name', 'last_name']

    def save(self, *args, **kwargs):
        self.is_active = self.status == UserStatus.ACTIVE
        super().save(*args, **kwargs)

    @property
    def full_name(self) -> str:
        return f'{self.first_name} {self.last_name}'.strip()

    def __str__(self) -> str:
        return self.email


class UserGroup(UUIDTimeStampedModel):
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='groups')
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    members = models.ManyToManyField('users.User', related_name='member_groups', blank=True)
    dashboards = models.ManyToManyField('dashboards.Dashboard', related_name='groups', blank=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(fields=['tenant', 'name'], name='unique_group_name_per_tenant')
        ]

    def __str__(self) -> str:
        return self.name

