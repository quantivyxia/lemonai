"""Application services for audit app."""

from apps.audit.models import AccessLog


def log_dashboard_access(*, user, tenant, dashboard, ip_address, status, origin='portal', details=''):
    return AccessLog.objects.create(
        user=user,
        tenant=tenant,
        dashboard=dashboard,
        ip_address=ip_address,
        status=status,
        origin=origin,
        details=details,
    )
