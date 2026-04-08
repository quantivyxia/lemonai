from rest_framework import serializers

from apps.common.services import enforce_same_tenant, is_super_admin
from apps.dashboards.models import Dashboard
from apps.permissions.models import RoleCode
from apps.users.models import User, UserGroup, UserStatus
from apps.users.services import sync_group_dashboard_access, sync_user_dashboard_blocks


class UserGroupSerializer(serializers.ModelSerializer):
    members_count = serializers.SerializerMethodField()
    dashboards_count = serializers.SerializerMethodField()
    member_names = serializers.SerializerMethodField()
    dashboard_names = serializers.SerializerMethodField()

    class Meta:
        model = UserGroup
        fields = [
            'id',
            'tenant',
            'name',
            'description',
            'members',
            'dashboards',
            'members_count',
            'dashboards_count',
            'member_names',
            'dashboard_names',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
        extra_kwargs = {
            'tenant': {'required': False},
        }

    def get_members_count(self, obj):
        return len(obj.members.all())

    def get_dashboards_count(self, obj):
        return len(obj.dashboards.all())

    def get_member_names(self, obj):
        return [member.full_name for member in obj.members.all()]

    def get_dashboard_names(self, obj):
        return [dashboard.name for dashboard in obj.dashboards.all()]

    def validate_tenant(self, tenant):
        request = self.context.get('request')
        if request and not enforce_same_tenant(request.user, tenant.id):
            raise serializers.ValidationError('Voce nao pode editar grupos de outro tenant.')
        return tenant

    def create(self, validated_data):
        group = super().create(validated_data)
        sync_group_dashboard_access(group)
        return group

    def update(self, instance, validated_data):
        group = super().update(instance, validated_data)
        sync_group_dashboard_access(group)
        return group


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    role_code = serializers.CharField(source='role.code', read_only=True)
    role_label = serializers.CharField(source='role.name', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    group_name = serializers.CharField(source='primary_group.name', read_only=True)
    group_ids = serializers.SerializerMethodField()
    group_names = serializers.SerializerMethodField()
    dashboard_ids = serializers.SerializerMethodField()
    blocked_dashboard_ids = serializers.SerializerMethodField()
    selected_group_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
    )
    selected_blocked_dashboard_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = User
        fields = [
            'id',
            'first_name',
            'last_name',
            'email',
            'password',
            'tenant',
            'tenant_name',
            'role',
            'role_code',
            'role_label',
            'primary_group',
            'group_name',
            'group_ids',
            'group_names',
            'dashboard_ids',
            'blocked_dashboard_ids',
            'selected_group_ids',
            'selected_blocked_dashboard_ids',
            'status',
            'avatar_url',
            'last_login',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'last_login', 'created_at', 'updated_at']

    def _get_member_groups(self, obj):
        return list(obj.member_groups.all())

    def _get_user_blocked_dashboard_ids(self, obj):
        return [str(rule.dashboard_id) for rule in obj.dashboard_access_rules.all() if not rule.is_active]

    def _get_group_dashboard_ids(self, obj):
        dashboard_ids = []
        for group in self._get_member_groups(obj):
            dashboard_ids.extend(str(dashboard.id) for dashboard in group.dashboards.all())
        return dashboard_ids

    def _get_effective_dashboard_ids(self, obj):
        blocked_ids = set(self._get_user_blocked_dashboard_ids(obj))
        effective_ids = [
            dashboard_id
            for dashboard_id in self._get_group_dashboard_ids(obj)
            if dashboard_id not in blocked_ids
        ]
        return list(dict.fromkeys(effective_ids))

    def get_group_ids(self, obj):
        return [group.id for group in self._get_member_groups(obj)]

    def get_group_names(self, obj):
        return [group.name for group in self._get_member_groups(obj)]

    def get_dashboard_ids(self, obj):
        return self._get_effective_dashboard_ids(obj)

    def get_blocked_dashboard_ids(self, obj):
        return list(dict.fromkeys(self._get_user_blocked_dashboard_ids(obj)))

    def validate(self, attrs):
        request = self.context.get('request')
        if not request:
            return attrs

        actor = request.user
        target_tenant = attrs.get('tenant') or getattr(self.instance, 'tenant', None)
        target_role = attrs.get('role') or getattr(self.instance, 'role', None)
        selected_group_ids = attrs.get('selected_group_ids', None)
        selected_blocked_dashboard_ids = attrs.get('selected_blocked_dashboard_ids', None)

        if target_tenant and not enforce_same_tenant(actor, target_tenant.id):
            raise serializers.ValidationError({'tenant': 'Operacao permitida apenas no tenant do usuario logado.'})

        if target_role:
            if target_role.code == RoleCode.SUPER_ADMIN and not is_super_admin(actor):
                raise serializers.ValidationError({'role': 'Apenas Dono pode atribuir perfil Dono.'})

            if not is_super_admin(actor) and target_role.code == RoleCode.SUPER_ADMIN:
                raise serializers.ValidationError({'role': 'Perfil Dono nao pode ser criado por este usuario.'})

        if target_role and target_role.code != RoleCode.SUPER_ADMIN and not target_tenant:
            raise serializers.ValidationError({'tenant': 'Usuarios Analista/Usuario precisam ter tenant definido.'})

        if self.instance is None and target_tenant:
            tenant_users_count = User.objects.filter(tenant_id=target_tenant.id).count()
            if tenant_users_count >= target_tenant.max_users:
                raise serializers.ValidationError(
                    {
                        'tenant': (
                            f'Limite de usuarios deste tenant atingido '
                            f'({tenant_users_count}/{target_tenant.max_users}). '
                            'Aumente o limite para criar novos usuarios.'
                        )
                    }
                )

        status = attrs.get('status')
        if status and status not in [UserStatus.ACTIVE, UserStatus.INACTIVE]:
            raise serializers.ValidationError({'status': 'Status invalido.'})

        password = attrs.get('password')
        if self.instance is None and not password:
            raise serializers.ValidationError({'password': 'Senha obrigatoria para criar usuario.'})
        if password and (not password.isdigit() or len(password) != 6):
            raise serializers.ValidationError({'password': 'A senha deve conter exatamente 6 digitos numericos.'})

        primary_group = attrs.get('primary_group') or getattr(self.instance, 'primary_group', None)
        if primary_group and target_tenant and primary_group.tenant_id != target_tenant.id:
            raise serializers.ValidationError({'primary_group': 'Grupo principal deve ser do mesmo tenant.'})

        if selected_group_ids is not None:
            if not target_tenant:
                raise serializers.ValidationError({'selected_group_ids': 'Defina um tenant para vincular grupos.'})
            groups_qs = UserGroup.objects.filter(id__in=selected_group_ids)
            if groups_qs.count() != len(set(selected_group_ids)):
                raise serializers.ValidationError({'selected_group_ids': 'Um ou mais grupos nao foram encontrados.'})
            if groups_qs.exclude(tenant_id=target_tenant.id).exists():
                raise serializers.ValidationError({'selected_group_ids': 'Todos os grupos devem ser do mesmo tenant do usuario.'})
            attrs['_selected_groups'] = list(groups_qs)

        def resolve_selected_dashboards(field_name, dashboard_ids):
            if dashboard_ids is None:
                return None
            if not target_tenant:
                raise serializers.ValidationError({field_name: 'Defina um tenant para vincular dashboards.'})

            normalized_ids = {str(dashboard_id) for dashboard_id in dashboard_ids}
            dashboards_qs = Dashboard.objects.filter(id__in=normalized_ids)
            if dashboards_qs.count() != len(normalized_ids):
                raise serializers.ValidationError({field_name: 'Um ou mais dashboards nao foram encontrados.'})
            if dashboards_qs.exclude(tenant_id=target_tenant.id).exists():
                raise serializers.ValidationError({field_name: 'Todos os dashboards devem ser do mesmo tenant do usuario.'})
            return list(dashboards_qs)

        selected_blocked_dashboards = resolve_selected_dashboards(
            'selected_blocked_dashboard_ids',
            selected_blocked_dashboard_ids,
        )

        if selected_blocked_dashboards is not None:
            attrs['_selected_blocked_dashboards'] = selected_blocked_dashboards

        selected_groups = attrs.get('_selected_groups')
        if selected_groups is None and self.instance is not None:
            selected_groups = self._get_member_groups(self.instance)

        inherited_dashboard_ids = set()
        for group in selected_groups or []:
            inherited_dashboard_ids.update(str(dashboard.id) for dashboard in group.dashboards.all())

        blocked_dashboard_ids = {str(dashboard.id) for dashboard in selected_blocked_dashboards or []}
        invalid_blocked_ids = blocked_dashboard_ids - inherited_dashboard_ids
        if invalid_blocked_ids:
            raise serializers.ValidationError(
                {
                    'selected_blocked_dashboard_ids': (
                        'Voce so pode remover dashboards herdados pelos grupos selecionados.'
                    )
                }
            )

        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        selected_groups = validated_data.pop('_selected_groups', [])
        selected_blocked_dashboards = validated_data.pop('_selected_blocked_dashboards', [])
        validated_data.pop('selected_group_ids', None)
        validated_data.pop('selected_blocked_dashboard_ids', None)

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        if selected_groups:
            user.member_groups.set(selected_groups)
            user.primary_group = selected_groups[0]
            user.save(update_fields=['primary_group', 'updated_at'])

        sync_user_dashboard_blocks(user, [str(dashboard.id) for dashboard in selected_blocked_dashboards])
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        selected_groups = validated_data.pop('_selected_groups', None)
        selected_blocked_dashboards = validated_data.pop('_selected_blocked_dashboards', None)
        validated_data.pop('selected_group_ids', None)
        validated_data.pop('selected_blocked_dashboard_ids', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()

        if selected_groups is not None:
            instance.member_groups.set(selected_groups)
            instance.primary_group = selected_groups[0] if selected_groups else None
            instance.save(update_fields=['primary_group', 'updated_at'])
        elif instance.primary_group and not instance.member_groups.filter(id=instance.primary_group_id).exists():
            instance.member_groups.add(instance.primary_group)

        if selected_blocked_dashboards is not None:
            sync_user_dashboard_blocks(instance, [str(dashboard.id) for dashboard in selected_blocked_dashboards])
        elif selected_groups is not None:
            remaining_blocked_ids = [
                dashboard_id
                for dashboard_id in self._get_user_blocked_dashboard_ids(instance)
                if dashboard_id in self._get_group_dashboard_ids(instance)
            ]
            sync_user_dashboard_blocks(instance, remaining_blocked_ids)

        return instance
