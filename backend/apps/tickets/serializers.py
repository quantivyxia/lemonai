from __future__ import annotations

from django.urls import reverse
from rest_framework import serializers

from apps.common.services import get_actor_user, is_super_admin
from apps.tickets.models import Ticket, TicketAttachment, TicketComment, TicketNotification, TicketPriority, TicketStatus


class TicketAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = TicketAttachment
        fields = [
            'id',
            'file_name',
            'content_type',
            'size_bytes',
            'uploaded_by',
            'uploaded_by_name',
            'created_at',
            'download_url',
        ]
        read_only_fields = fields

    def get_download_url(self, obj):
        request = self.context.get('request')
        path = reverse('ticket-attachment-download', kwargs={'attachment_id': obj.id})
        return request.build_absolute_uri(path) if request else path


class TicketCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.full_name', read_only=True)

    class Meta:
        model = TicketComment
        fields = ['id', 'author', 'author_name', 'body', 'is_internal', 'created_at']
        read_only_fields = ['id', 'author', 'author_name', 'created_at']


class TicketNotificationSerializer(serializers.ModelSerializer):
    ticket_code = serializers.CharField(source='ticket.code', read_only=True)
    ticket_title = serializers.CharField(source='ticket.title', read_only=True)
    ticket_status = serializers.CharField(source='ticket.status', read_only=True)
    actor_name = serializers.CharField(source='actor.full_name', read_only=True)

    class Meta:
        model = TicketNotification
        fields = [
            'id',
            'ticket',
            'ticket_code',
            'ticket_title',
            'ticket_status',
            'notification_type',
            'title',
            'message',
            'actor_name',
            'is_read',
            'created_at',
            'read_at',
        ]
        read_only_fields = fields


class TicketSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source='requester.full_name', read_only=True)
    requester_email = serializers.CharField(source='requester.email', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    priority_label = serializers.CharField(source='get_priority_display', read_only=True)
    comments = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    attachments_count = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            'id',
            'code',
            'tenant',
            'tenant_name',
            'requester',
            'requester_name',
            'requester_email',
            'title',
            'description',
            'status',
            'status_label',
            'priority',
            'priority_label',
            'due_date',
            'opened_at',
            'last_activity_at',
            'created_at',
            'updated_at',
            'comments_count',
            'attachments_count',
            'comments',
            'attachments',
        ]
        read_only_fields = [
            'id',
            'code',
            'requester',
            'requester_name',
            'requester_email',
            'tenant_name',
            'opened_at',
            'last_activity_at',
            'created_at',
            'updated_at',
            'comments_count',
            'attachments_count',
            'comments',
            'attachments',
            'status_label',
            'priority_label',
        ]
        extra_kwargs = {
            'tenant': {'required': False},
            'due_date': {'required': False, 'allow_null': True},
        }

    def get_comments(self, obj):
        request = self.context.get('request')
        actor = get_actor_user(request)
        comments = getattr(obj, 'prefetched_comments', None)
        if comments is None:
            comments = obj.comments.select_related('author').all()
        if not is_super_admin(actor):
            comments = [item for item in comments if not item.is_internal]
        return TicketCommentSerializer(comments, many=True, context=self.context).data

    def get_attachments(self, obj):
        attachments = getattr(obj, 'prefetched_attachments', None)
        if attachments is None:
            attachments = obj.attachments.select_related('uploaded_by').all()
        return TicketAttachmentSerializer(attachments, many=True, context=self.context).data

    def get_comments_count(self, obj):
        request = self.context.get('request')
        actor = get_actor_user(request)
        comments = getattr(obj, 'prefetched_comments', None)
        if comments is None:
            comments = obj.comments.select_related('author').all()
        if not is_super_admin(actor):
            comments = [item for item in comments if not item.is_internal]
        return len(comments)

    def get_attachments_count(self, obj):
        attachments = getattr(obj, 'prefetched_attachments', None)
        if attachments is None:
            attachments = obj.attachments.all()
        return len(attachments)

    def validate(self, attrs):
        request = self.context.get('request')
        actor = get_actor_user(request)

        if not actor:
            raise serializers.ValidationError('Usuario invalido para operacao.')

        if not is_super_admin(actor):
            attrs['tenant'] = actor.tenant
            if self.instance and self.instance.requester_id != actor.id:
                raise serializers.ValidationError('Voce pode editar apenas seus proprios chamados.')
            if self.instance:
                blocked_fields = {'status', 'priority', 'due_date', 'tenant'}
                provided = {key for key in self.initial_data.keys() if key in blocked_fields}
                if provided:
                    raise serializers.ValidationError('Analista nao pode alterar status, prioridade ou previsao.')
            else:
                attrs['status'] = TicketStatus.OPEN
                attrs['priority'] = TicketPriority.MEDIUM
                attrs['due_date'] = None
        else:
            if not self.instance and not attrs.get('tenant'):
                raise serializers.ValidationError({'tenant': 'Tenant obrigatorio para abrir chamado como administrador.'})

        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        actor = get_actor_user(request)
        validated_data['requester'] = actor
        return super().create(validated_data)
