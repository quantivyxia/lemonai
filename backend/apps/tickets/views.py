from __future__ import annotations

from io import BytesIO

from django.db.models import Prefetch, Q
from django.http import FileResponse
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.services import get_actor_user, is_analyst, is_super_admin
from apps.tickets.models import Ticket, TicketAttachment, TicketComment, TicketNotification, TicketPriority, TicketStatus
from apps.tickets.permissions import TicketNotificationPermission, TicketPermission, can_access_ticket
from apps.tickets.serializers import TicketAttachmentSerializer, TicketCommentSerializer, TicketNotificationSerializer, TicketSerializer
from apps.tickets.services import (
    notify_ticket_attachment,
    notify_ticket_comment,
    notify_ticket_due_date,
    notify_ticket_status,
    notify_ticket_updated,
    touch_ticket,
)


class TicketViewSet(viewsets.ModelViewSet):
    serializer_class = TicketSerializer
    permission_classes = [TicketPermission]
    ordering = ['-last_activity_at']

    def get_queryset(self):
        actor = get_actor_user(self.request)
        comment_qs = TicketComment.objects.select_related('author').order_by('created_at')
        attachment_qs = TicketAttachment.objects.select_related('uploaded_by').only(
            'id', 'ticket_id', 'uploaded_by_id', 'file_name', 'content_type', 'size_bytes', 'created_at'
        ).order_by('created_at')
        queryset = Ticket.objects.select_related('tenant', 'requester').prefetch_related(
            Prefetch('comments', queryset=comment_qs, to_attr='prefetched_comments'),
            Prefetch('attachments', queryset=attachment_qs, to_attr='prefetched_attachments'),
        )

        if not is_super_admin(actor):
            queryset = queryset.filter(requester=actor)

        tenant_id = self.request.query_params.get('tenant')
        status_filter = self.request.query_params.get('status')
        priority = self.request.query_params.get('priority')
        requester = self.request.query_params.get('requester')
        search = self.request.query_params.get('search', '').strip()

        if is_super_admin(actor) and tenant_id and tenant_id != 'all':
            queryset = queryset.filter(tenant_id=tenant_id)
        if status_filter and status_filter != 'all':
            queryset = queryset.filter(status=status_filter)
        if priority and priority != 'all':
            queryset = queryset.filter(priority=priority)
        if is_super_admin(actor) and requester and requester != 'all':
            queryset = queryset.filter(requester_id=requester)
        if search:
            queryset = queryset.filter(
                Q(code__icontains=search)
                | Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(requester__first_name__icontains=search)
                | Q(requester__last_name__icontains=search)
                | Q(tenant__name__icontains=search)
            )

        return queryset.order_by('-last_activity_at', '-opened_at')

    def perform_create(self, serializer):
        ticket = serializer.save(last_activity_at=timezone.now())
        touch_ticket(ticket)

    def perform_update(self, serializer):
        actor = get_actor_user(self.request)
        ticket = self.get_object()
        previous = {
            'title': ticket.title,
            'description': ticket.description,
            'status': ticket.status,
            'priority': ticket.priority,
            'due_date': ticket.due_date,
        }
        updated = serializer.save(last_activity_at=timezone.now())
        touch_ticket(updated)

        if is_super_admin(actor) and updated.requester_id != actor.id:
            changed = []
            if previous['title'] != updated.title:
                changed.append('titulo')
            if previous['description'] != updated.description:
                changed.append('descricao')
            if previous['priority'] != updated.priority:
                changed.append(f'prioridade para {updated.get_priority_display().lower()}')
            if previous['status'] != updated.status:
                notify_ticket_status(updated, actor)
            if previous['due_date'] != updated.due_date and updated.due_date:
                notify_ticket_due_date(updated, actor)
            notify_ticket_updated(updated, actor, changed)

    @action(detail=True, methods=['post'], url_path='comments')
    def add_comment(self, request, pk=None):
        ticket = self.get_object()
        actor = get_actor_user(request)
        body = (request.data.get('body') or '').strip()
        if not body:
            raise serializers.ValidationError({'body': 'Comentario obrigatorio.'})

        is_internal = bool(request.data.get('is_internal'))
        if is_internal and not is_super_admin(actor):
            raise serializers.ValidationError({'is_internal': 'Somente administradores podem adicionar comentarios internos.'})

        comment = TicketComment.objects.create(
            ticket=ticket,
            author=actor,
            body=body,
            is_internal=is_internal,
        )
        touch_ticket(ticket)

        if is_super_admin(actor):
            notify_ticket_comment(ticket, actor, internal=is_internal)

        serializer = TicketCommentSerializer(comment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='attachments')
    def add_attachment(self, request, pk=None):
        ticket = self.get_object()
        actor = get_actor_user(request)
        uploaded = request.FILES.get('file')
        if not uploaded:
            raise serializers.ValidationError({'file': 'Arquivo obrigatorio.'})

        attachment = TicketAttachment.objects.create(
            ticket=ticket,
            uploaded_by=actor,
            file_name=uploaded.name,
            content_type=getattr(uploaded, 'content_type', '') or '',
            size_bytes=getattr(uploaded, 'size', 0) or 0,
            file_data=uploaded.read(),
        )
        touch_ticket(ticket)

        if is_super_admin(actor):
            notify_ticket_attachment(ticket, actor)

        serializer = TicketAttachmentSerializer(attachment, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='notifications/read')
    def mark_ticket_notifications_read(self, request, pk=None):
        ticket = self.get_object()
        actor = get_actor_user(request)
        updated = TicketNotification.objects.filter(ticket=ticket, recipient=actor, is_read=False).update(
            is_read=True,
            read_at=timezone.now(),
            updated_at=timezone.now(),
        )
        return Response({'detail': 'Notificacoes do chamado marcadas como lidas.', 'updated': updated})


class TicketNotificationListView(APIView):
    permission_classes = [TicketNotificationPermission]

    def get(self, request):
        actor = get_actor_user(request)
        notifications = TicketNotification.objects.select_related('ticket', 'actor').filter(recipient=actor)[:10]
        unread_count = TicketNotification.objects.filter(recipient=actor, is_read=False).count()
        return Response({
            'unread_count': unread_count,
            'results': TicketNotificationSerializer(notifications, many=True, context={'request': request}).data,
        })


class TicketNotificationReadView(APIView):
    permission_classes = [TicketNotificationPermission]

    def post(self, request, notification_id):
        actor = get_actor_user(request)
        notification = TicketNotification.objects.filter(id=notification_id, recipient=actor).first()
        if not notification:
            return Response({'detail': 'Notificacao nao encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        notification.mark_as_read()
        return Response({'detail': 'Notificacao marcada como lida.'})


class TicketNotificationReadAllView(APIView):
    permission_classes = [TicketNotificationPermission]

    def post(self, request):
        actor = get_actor_user(request)
        updated = TicketNotification.objects.filter(recipient=actor, is_read=False).update(
            is_read=True,
            read_at=timezone.now(),
            updated_at=timezone.now(),
        )
        return Response({'detail': 'Todas as notificacoes foram marcadas como lidas.', 'updated': updated})


class TicketAttachmentDownloadView(APIView):
    permission_classes = [TicketPermission]

    def get(self, request, attachment_id):
        attachment = TicketAttachment.objects.select_related('ticket', 'ticket__requester').filter(id=attachment_id).first()
        if not attachment:
            return Response({'detail': 'Evidencia nao encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        actor = get_actor_user(request)
        if not can_access_ticket(actor, attachment.ticket):
            return Response({'detail': 'Voce nao tem acesso a esta evidencia.'}, status=status.HTTP_403_FORBIDDEN)

        buffer = BytesIO(attachment.file_data)
        response = FileResponse(buffer, as_attachment=True, filename=attachment.file_name)
        if attachment.content_type:
            response['Content-Type'] = attachment.content_type
        response['Content-Length'] = attachment.size_bytes
        return response
