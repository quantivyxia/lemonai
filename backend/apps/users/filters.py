import django_filters

from apps.users.models import User, UserGroup


class UserFilter(django_filters.FilterSet):
    tenant = django_filters.UUIDFilter(field_name='tenant_id')
    role = django_filters.CharFilter(field_name='role__code')
    status = django_filters.CharFilter(field_name='status')

    class Meta:
        model = User
        fields = ['tenant', 'role', 'status', 'email']


class UserGroupFilter(django_filters.FilterSet):
    tenant = django_filters.UUIDFilter(field_name='tenant_id')
    name = django_filters.CharFilter(field_name='name', lookup_expr='icontains')

    class Meta:
        model = UserGroup
        fields = ['tenant', 'name']

