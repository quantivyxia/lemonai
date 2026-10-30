from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.audit.models import SystemEventLog
from apps.permissions.models import Role, RoleCode
from apps.tenants.models import Tenant, TenantStatus
from apps.users.models import User, UserStatus


class BaseAPITestCase(APITestCase):
    password = '123456'

    def setUp(self):
        super().setUp()
        self.super_admin_role = Role.objects.create(code=RoleCode.SUPER_ADMIN, name='Dono')
        self.analyst_role = Role.objects.create(code=RoleCode.ANALYST, name='Analista')
        self.viewer_role = Role.objects.create(code=RoleCode.VIEWER, name='Usuario')
        self.tenant = Tenant.objects.create(
            name='Tenant Teste',
            status=TenantStatus.ACTIVE,
            max_users=10,
            max_dashboards=10,
        )

    def create_user(self, *, email: str, role: Role, tenant: Tenant | None = None):
        return User.objects.create_user(
            email=email,
            password=self.password,
            first_name='Teste',
            last_name='Usuario',
            role=role,
            tenant=tenant,
            status=UserStatus.ACTIVE,
            is_staff=role.code == RoleCode.SUPER_ADMIN,
            is_superuser=role.code == RoleCode.SUPER_ADMIN,
        )

    def login(self, email: str):
        response = self.client.post(
            '/api/authentication/login/',
            {'email': email, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def auth_client(self, user: User):
        client = APIClient()
        client.force_authenticate(user=user)
        return client


class HealthEndpointTests(BaseAPITestCase):
    def test_health_endpoints_are_available(self):
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'ok')
        self.assertIn('request_id', response.data)

        live_response = self.client.get('/api/health/live/')
        self.assertEqual(live_response.status_code, status.HTTP_200_OK)
        self.assertEqual(live_response.data['status'], 'alive')

        ready_response = self.client.get('/api/health/ready/')
        self.assertEqual(ready_response.status_code, status.HTTP_200_OK)
        self.assertEqual(ready_response.data['status'], 'ready')


class AuthenticationFlowTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(email='dono@teste.com', role=self.super_admin_role)

    def test_login_me_and_logout_blacklist_refresh_token(self):
        login_payload = self.login(self.owner.email)
        access = login_payload['access']
        refresh = login_payload['refresh']

        me_client = APIClient()
        me_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        me_response = me_client.get('/api/authentication/me/')
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data['email'], self.owner.email)

        logout_response = me_client.post('/api/authentication/logout/', {'refresh': refresh}, format='json')
        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)

        refresh_response = self.client.post('/api/authentication/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

        self.assertTrue(SystemEventLog.objects.filter(action='auth.login').exists())
        self.assertTrue(SystemEventLog.objects.filter(action='auth.logout').exists())


class AuthorizationAndErrorHandlingTests(BaseAPITestCase):
    def setUp(self):
        super().setUp()
        self.owner = self.create_user(email='owner@teste.com', role=self.super_admin_role)
        self.analyst = self.create_user(email='analista@teste.com', role=self.analyst_role, tenant=self.tenant)

    def test_unauthorized_request_returns_safe_payload(self):
        response = self.client.get('/api/tenants/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('detail', response.data)
        self.assertIn('request_id', response.data)
        self.assertNotIn('traceback', str(response.data).lower())

    def test_system_summary_is_restricted_to_super_admin(self):
        owner_client = self.auth_client(self.owner)
        analyst_client = self.auth_client(self.analyst)

        owner_response = owner_client.get('/api/health/summary/')
        self.assertEqual(owner_response.status_code, status.HTTP_200_OK)
        self.assertEqual(owner_response.data['status'], 'ok')

        analyst_response = analyst_client.get('/api/health/summary/')
        self.assertEqual(analyst_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_system_events_are_restricted_to_super_admin(self):
        SystemEventLog.objects.create(
            level='info',
            category='system',
            action='system.test',
            message='Evento de teste',
        )

        owner_client = self.auth_client(self.owner)
        analyst_client = self.auth_client(self.analyst)

        owner_response = owner_client.get('/api/audit/system-events/')
        self.assertEqual(owner_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(owner_response.data['count'], 1)

        analyst_response = analyst_client.get('/api/audit/system-events/')
        self.assertEqual(analyst_response.status_code, status.HTTP_403_FORBIDDEN)
