"""Tenant-scoped delivery of the Cultura Inglesa dashboard's original dataset."""

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.services import get_effective_user, is_super_admin, safe_related
from apps.dashboards.models import PythonDashboardDataset

FACULDADE_BAIANA_TENANT_ID = '6c91c82b-e137-4a77-bb81-76bc6a5c5e2f'


def can_view_baiana_dashboard(user):
    if not (getattr(user, 'is_authenticated', False)
            and getattr(user, 'is_active', False)
            and getattr(user, 'status', None) == 'active'):
        return False
    if is_super_admin(user):
        return True
    tenant = safe_related(user, 'tenant')
    return bool(tenant and tenant.status == 'active'
                and str(tenant.pk) == FACULDADE_BAIANA_TENANT_ID)


def can_view_cultura_dashboard(user):
    active_user = (
        getattr(user, 'is_authenticated', False)
        and getattr(user, 'is_active', False)
        and getattr(user, 'status', None) == 'active'
    )
    if not active_user:
        return False
    if is_super_admin(user):
        return True
    tenant = safe_related(user, 'tenant')
    return bool(
        tenant
        and tenant.status == 'active'
        and str(tenant.pk) == settings.CULTURA_INGLESA_TENANT_ID
    )


def load_cultura_dataset():
    return get_object_or_404(
        PythonDashboardDataset, tenant_id=settings.CULTURA_INGLESA_TENANT_ID,
    ).data


class PrivateDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response


class PythonDashboardAvailabilityView(PrivateDashboardView):
    def get(self, request):
        user = get_effective_user(request)
        return Response({'available': can_view_cultura_dashboard(user) or can_view_baiana_dashboard(user)})


class PythonDashboardCatalogView(PrivateDashboardView):
    def get(self, request):
        user = get_effective_user(request)
        dashboards = []
        if can_view_cultura_dashboard(user):
            dashboards.append({'id': 'cultura-inglesa', 'name': 'Cultura Inglesa'})
        if can_view_baiana_dashboard(user):
            dashboards.append({'id': 'faculdade-baiana', 'name': 'Faculdade Baiana de Direito'})
        return Response({'dashboards': dashboards})


class BaianaDashboardDataView(PrivateDashboardView):
    def get(self, request):
        if not can_view_baiana_dashboard(get_effective_user(request)):
            raise PermissionDenied('Dashboard indisponivel para este usuario.')
        dataset = get_object_or_404(PythonDashboardDataset, tenant_id=FACULDADE_BAIANA_TENANT_ID)
        html = dataset.data.get('__faculdade_baiana_html')
        if not isinstance(html, str) or not html.strip():
            from rest_framework.exceptions import NotFound
            raise NotFound('Dashboard ainda nao disponivel.')
        return Response({'html': html})


class CulturaDashboardDataView(PrivateDashboardView):
    def get(self, request):
        if not can_view_cultura_dashboard(get_effective_user(request)):
            raise PermissionDenied('Dashboard indisponivel para este usuario.')
        return Response(load_cultura_dataset())
