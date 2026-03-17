from django.core.management.base import BaseCommand

from apps.branding.models import ClientBranding
from apps.dashboards.models import Dashboard, DashboardColumn
from apps.permissions.models import DashboardAccess, Permission, RLSRule, Role, RoleCode, RolePermission
from apps.tenants.models import Tenant, TenantStatus
from apps.users.models import User, UserGroup, UserStatus
from apps.workspaces.models import Workspace, WorkspaceStatus


class Command(BaseCommand):
    help = 'Seed de dados demo para apresentar o InsightHub.'

    def handle(self, *args, **options):
        roles = self._create_roles()
        self._create_permissions(roles)
        tenants = self._create_tenants()
        self._create_branding(tenants)
        users = self._create_users(roles, tenants)
        groups = self._create_groups(tenants, users)
        workspaces = self._create_workspaces(tenants)
        dashboards = self._create_dashboards(tenants, workspaces)
        self._create_dashboard_columns(dashboards)
        self._create_access_rules(tenants, dashboards, users, groups, roles)
        self._create_rls_rules(tenants, dashboards, users)

        self.stdout.write(self.style.SUCCESS('Seed finalizado com sucesso.'))
        self.stdout.write('Login Dono: dono@insighthub.com / 123456')
        self.stdout.write('Login Analista Nexa: analista@nexa.com / 123456')
        self.stdout.write('Login Usuario Nexa: usuario@nexa.com / 123456')
        self.stdout.write('Login Analista Solaris: analista@solaris.com / 123456')
        self.stdout.write('Login Usuario Solaris: usuario@solaris.com / 123456')

    def _create_roles(self):
        roles = {}
        role_data = [
            (RoleCode.SUPER_ADMIN, 'Dono', 'Dono da plataforma. Cria tenants e governa o ambiente.'),
            (RoleCode.ANALYST, 'Analista', 'Gerencia usuarios, dashboards, RLS e operacao do tenant.'),
            (RoleCode.VIEWER, 'Usuario', 'Somente visualiza dashboards autorizados.'),
        ]

        for code, name, description in role_data:
            role, _ = Role.objects.update_or_create(
                code=code,
                defaults={'name': name, 'description': description},
            )
            roles[code] = role
        return roles

    def _create_permissions(self, roles):
        permission_specs = [
            ('tenants.manage', 'Gerenciar tenants', 'tenants'),
            ('users.manage', 'Gerenciar usuarios', 'users'),
            ('groups.manage', 'Gerenciar grupos', 'users'),
            ('workspaces.manage', 'Gerenciar workspaces', 'workspaces'),
            ('dashboards.manage', 'Gerenciar dashboards', 'dashboards'),
            ('dashboards.view', 'Visualizar dashboards', 'dashboards'),
            ('rls.manage', 'Gerenciar regras de RLS', 'permissions'),
            ('audit.read', 'Consultar auditoria', 'audit'),
            ('branding.manage', 'Gerenciar white-label', 'branding'),
        ]

        created_permissions = {}
        for code, name, module in permission_specs:
            permission, _ = Permission.objects.update_or_create(
                code=code,
                defaults={
                    'name': name,
                    'module': module,
                    'description': f'Permite {name.lower()}.',
                },
            )
            created_permissions[code] = permission

        role_permission_map = {
            RoleCode.SUPER_ADMIN: list(created_permissions.keys()),
            RoleCode.ANALYST: [
                'users.manage',
                'groups.manage',
                'workspaces.manage',
                'dashboards.manage',
                'dashboards.view',
                'rls.manage',
                'audit.read',
                'branding.manage',
            ],
            RoleCode.VIEWER: ['dashboards.view'],
        }

        for role_code, permission_codes in role_permission_map.items():
            role = roles[role_code]
            for permission_code in permission_codes:
                RolePermission.objects.get_or_create(
                    role=role,
                    permission=created_permissions[permission_code],
                )

    def _create_tenants(self):
        nexa, _ = Tenant.objects.update_or_create(
            slug='nexa-consultoria',
            defaults={
                'name': 'Nexa Consultoria',
                'domain': 'nexa.local',
                'status': TenantStatus.ACTIVE,
                'max_users': 35,
                'max_dashboards': 25,
            },
        )

        solaris, _ = Tenant.objects.update_or_create(
            slug='solaris-foods',
            defaults={
                'name': 'Solaris Foods',
                'domain': 'solaris.local',
                'status': TenantStatus.ACTIVE,
                'max_users': 30,
                'max_dashboards': 20,
            },
        )

        return {'nexa': nexa, 'solaris': solaris}

    def _create_branding(self, tenants):
        ClientBranding.objects.update_or_create(
            tenant=tenants['nexa'],
            defaults={
                'platform_name': 'Nexa Portal',
                'primary_color': '#0f6fe8',
                'secondary_color': '#14b8a6',
                'domain': 'portal.nexa.local',
                'custom_domain_enabled': True,
            },
        )
        ClientBranding.objects.update_or_create(
            tenant=tenants['solaris'],
            defaults={
                'platform_name': 'Solaris BI',
                'primary_color': '#14532d',
                'secondary_color': '#16a34a',
                'domain': 'portal.solaris.local',
                'custom_domain_enabled': True,
            },
        )

    def _create_users(self, roles, tenants):
        users = {}

        users['owner'], _ = User.objects.update_or_create(
            email='dono@insighthub.com',
            defaults={
                'first_name': 'Dono',
                'last_name': 'Plataforma',
                'tenant': None,
                'role': roles[RoleCode.SUPER_ADMIN],
                'status': UserStatus.ACTIVE,
                'is_staff': True,
                'is_superuser': True,
            },
        )
        users['owner'].set_password('123456')
        users['owner'].save()

        users['nexa_analyst'], _ = User.objects.update_or_create(
            email='analista@nexa.com',
            defaults={
                'first_name': 'Camila',
                'last_name': 'Araujo',
                'tenant': tenants['nexa'],
                'role': roles[RoleCode.ANALYST],
                'status': UserStatus.ACTIVE,
            },
        )
        users['nexa_analyst'].set_password('123456')
        users['nexa_analyst'].save()

        users['nexa_viewer'], _ = User.objects.update_or_create(
            email='usuario@nexa.com',
            defaults={
                'first_name': 'Carlos',
                'last_name': 'Silva',
                'tenant': tenants['nexa'],
                'role': roles[RoleCode.VIEWER],
                'status': UserStatus.ACTIVE,
            },
        )
        users['nexa_viewer'].set_password('123456')
        users['nexa_viewer'].save()

        users['solaris_analyst'], _ = User.objects.update_or_create(
            email='analista@solaris.com',
            defaults={
                'first_name': 'Rafael',
                'last_name': 'Nunes',
                'tenant': tenants['solaris'],
                'role': roles[RoleCode.ANALYST],
                'status': UserStatus.ACTIVE,
            },
        )
        users['solaris_analyst'].set_password('123456')
        users['solaris_analyst'].save()

        users['solaris_viewer'], _ = User.objects.update_or_create(
            email='usuario@solaris.com',
            defaults={
                'first_name': 'Ana',
                'last_name': 'Ribeiro',
                'tenant': tenants['solaris'],
                'role': roles[RoleCode.VIEWER],
                'status': UserStatus.ACTIVE,
            },
        )
        users['solaris_viewer'].set_password('123456')
        users['solaris_viewer'].save()

        return users

    def _create_groups(self, tenants, users):
        groups = {}

        groups['nexa_exec'], _ = UserGroup.objects.update_or_create(
            tenant=tenants['nexa'],
            name='Diretoria Executiva',
            defaults={
                'description': 'Acompanha indicadores consolidados de negocio e risco.',
            },
        )
        groups['nexa_exec'].members.set([users['nexa_analyst'], users['nexa_viewer']])

        groups['solaris_ops'], _ = UserGroup.objects.update_or_create(
            tenant=tenants['solaris'],
            name='BI Squad Operacional',
            defaults={
                'description': 'Monitora eficiencia operacional e SLA.',
            },
        )
        groups['solaris_ops'].members.set([users['solaris_analyst'], users['solaris_viewer']])

        users['nexa_analyst'].primary_group = groups['nexa_exec']
        users['nexa_viewer'].primary_group = groups['nexa_exec']
        users['solaris_analyst'].primary_group = groups['solaris_ops']
        users['solaris_viewer'].primary_group = groups['solaris_ops']
        users['nexa_analyst'].save(update_fields=['primary_group', 'updated_at'])
        users['nexa_viewer'].save(update_fields=['primary_group', 'updated_at'])
        users['solaris_analyst'].save(update_fields=['primary_group', 'updated_at'])
        users['solaris_viewer'].save(update_fields=['primary_group', 'updated_at'])

        return groups

    def _create_workspaces(self, tenants):
        workspaces = {}

        workspaces['nexa_comercial'], _ = Workspace.objects.update_or_create(
            tenant=tenants['nexa'],
            name='Comercial',
            defaults={
                'external_workspace_id': 'ws-nexa-comercial',
                'status': WorkspaceStatus.ACTIVE,
            },
        )

        workspaces['solaris_financeiro'], _ = Workspace.objects.update_or_create(
            tenant=tenants['solaris'],
            name='Financeiro',
            defaults={
                'external_workspace_id': 'ws-solaris-financeiro',
                'status': WorkspaceStatus.ACTIVE,
            },
        )

        return workspaces

    def _create_dashboards(self, tenants, workspaces):
        dashboards = {}

        dashboards['nexa_obras'], _ = Dashboard.objects.update_or_create(
            tenant=tenants['nexa'],
            workspace=workspaces['nexa_comercial'],
            name='Acompanhamento de Obras',
            defaults={
                'description': 'Indicadores de progresso fisico e financeiro por obra.',
                'category': 'Operacional',
                'status': 'active',
                'embed_url': 'https://app.powerbi.com/reportEmbed',
                'report_id': 'rep-nexa-obras',
                'dataset_id': 'ds-nexa-obras',
                'tags': ['obras', 'operacional'],
                'refresh_schedule': '0 */2 * * *',
            },
        )

        dashboards['solaris_fin'], _ = Dashboard.objects.update_or_create(
            tenant=tenants['solaris'],
            workspace=workspaces['solaris_financeiro'],
            name='Financeiro Consolidado',
            defaults={
                'description': 'Visao consolidada de custos, margem e fluxo de caixa.',
                'category': 'Financeiro',
                'status': 'active',
                'embed_url': 'https://app.powerbi.com/reportEmbed',
                'report_id': 'rep-solaris-fin',
                'dataset_id': 'ds-solaris-fin',
                'tags': ['financeiro'],
                'refresh_schedule': '0 */4 * * *',
            },
        )

        return dashboards

    def _create_dashboard_columns(self, dashboards):
        DashboardColumn.objects.update_or_create(
            dashboard=dashboards['nexa_obras'],
            name='obra',
            defaults={
                'label': 'Obra',
                'values': ['Obra Centro', 'Obra Norte', 'Obra Sul'],
            },
        )
        DashboardColumn.objects.update_or_create(
            dashboard=dashboards['nexa_obras'],
            name='regional',
            defaults={
                'label': 'Regional',
                'values': ['Norte', 'Sul', 'Sudeste'],
            },
        )
        DashboardColumn.objects.update_or_create(
            dashboard=dashboards['solaris_fin'],
            name='planta',
            defaults={
                'label': 'Planta',
                'values': ['Campinas', 'Curitiba', 'Recife'],
            },
        )

    def _create_access_rules(self, tenants, dashboards, users, groups, roles):
        # Analistas e usuarios com acesso por grupo
        DashboardAccess.objects.update_or_create(
            tenant=tenants['nexa'],
            dashboard=dashboards['nexa_obras'],
            group=groups['nexa_exec'],
            defaults={
                'user': None,
                'role': None,
                'access_level': 'view',
                'is_active': True,
            },
        )

        DashboardAccess.objects.update_or_create(
            tenant=tenants['solaris'],
            dashboard=dashboards['solaris_fin'],
            group=groups['solaris_ops'],
            defaults={
                'user': None,
                'role': None,
                'access_level': 'view',
                'is_active': True,
            },
        )

        # Dono sempre com acesso por role
        DashboardAccess.objects.update_or_create(
            tenant=tenants['nexa'],
            dashboard=dashboards['nexa_obras'],
            role=roles[RoleCode.SUPER_ADMIN],
            defaults={
                'user': None,
                'group': None,
                'access_level': 'admin',
                'is_active': True,
            },
        )

        DashboardAccess.objects.update_or_create(
            tenant=tenants['solaris'],
            dashboard=dashboards['solaris_fin'],
            role=roles[RoleCode.SUPER_ADMIN],
            defaults={
                'user': None,
                'group': None,
                'access_level': 'admin',
                'is_active': True,
            },
        )

    def _create_rls_rules(self, tenants, dashboards, users):
        RLSRule.objects.update_or_create(
            tenant=tenants['nexa'],
            dashboard=dashboards['nexa_obras'],
            user=users['nexa_viewer'],
            table_name='Obras',
            column_name='obra',
            operator='in',
            rule_type='allow',
            defaults={
                'values': ['Obra Centro'],
                'notes': 'Usuario Nexa visualiza apenas dados da Obra Centro.',
                'is_active': True,
            },
        )

        RLSRule.objects.update_or_create(
            tenant=tenants['solaris'],
            dashboard=dashboards['solaris_fin'],
            user=users['solaris_viewer'],
            table_name='Financeiro',
            column_name='planta',
            operator='in',
            rule_type='allow',
            defaults={
                'values': ['Campinas'],
                'notes': 'Usuario Solaris visualiza somente planta de Campinas.',
                'is_active': True,
            },
        )
