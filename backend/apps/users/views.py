from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

from apps.common.services import apply_tenant_scope, is_super_admin, is_viewer
from apps.users.filters import UserFilter, UserGroupFilter
from apps.users.models import User, UserGroup
from apps.users.permissions import GroupPermission, UserManagementPermission
from apps.users.serializers import UserGroupSerializer, UserSerializer


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [UserManagementPermission]
    filterset_class = UserFilter
    search_fields = ['first_name', 'last_name', 'email']
    ordering_fields = ['first_name', 'email', 'created_at', 'last_login']
    ordering = ['first_name']

    def get_queryset(self):
        queryset = User.objects.select_related('tenant', 'role', 'primary_group').prefetch_related(
            'member_groups',
            'dashboard_access_rules',
        )
        queryset = apply_tenant_scope(queryset, self.request.user)

        if is_viewer(self.request.user):
            return queryset.filter(id=self.request.user.id)

        return queryset

    def perform_create(self, serializer):
        if not is_super_admin(self.request.user):
            serializer.save(tenant=self.request.user.tenant)
            return
        serializer.save()

    @action(detail=True, methods=['post'], url_path='set-password')
    def set_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get('password')
        if not password:
            return Response({'detail': 'password obrigatoria.'}, status=status.HTTP_400_BAD_REQUEST)
        if not str(password).isdigit() or len(str(password)) != 6:
            return Response(
                {'detail': 'A senha deve conter exatamente 6 digitos numericos.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(password)
        user.save(update_fields=['password', 'updated_at'])
        return Response({'detail': 'Senha atualizada com sucesso.'})


class UserGroupViewSet(viewsets.ModelViewSet):
    serializer_class = UserGroupSerializer
    permission_classes = [GroupPermission]
    filterset_class = UserGroupFilter
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        queryset = UserGroup.objects.select_related('tenant').prefetch_related('members', 'dashboards')
        queryset = apply_tenant_scope(queryset, self.request.user)

        if is_viewer(self.request.user):
            return queryset.filter(members=self.request.user)

        return queryset

    def perform_create(self, serializer):
        if not is_super_admin(self.request.user):
            serializer.save(tenant=self.request.user.tenant)
            return
        serializer.save()

