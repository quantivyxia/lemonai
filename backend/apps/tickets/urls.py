from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.tickets.views import (
    TicketAttachmentDownloadView,
    TicketNotificationListView,
    TicketNotificationReadAllView,
    TicketNotificationReadView,
    TicketViewSet,
)

router = DefaultRouter()
router.register('', TicketViewSet, basename='ticket')

urlpatterns = [
    path('notifications/', TicketNotificationListView.as_view(), name='ticket-notifications'),
    path('notifications/read-all/', TicketNotificationReadAllView.as_view(), name='ticket-notifications-read-all'),
    path('notifications/<uuid:notification_id>/read/', TicketNotificationReadView.as_view(), name='ticket-notification-read'),
    path('attachments/<uuid:attachment_id>/download/', TicketAttachmentDownloadView.as_view(), name='ticket-attachment-download'),
    path('', include(router.urls)),
]
