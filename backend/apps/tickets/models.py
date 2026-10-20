from __future__ import annotations

import uuid

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.common.models import UUIDTimeStampedModel


class TicketStatus(models.TextChoices):
    OPEN = 'open', 'Aberto'
    ANALYSIS = 'analysis', 'Em analise'
    IN_PROGRESS = 'in_progress', 'Em andamento'
    RESOLVED = 'resolved', 'Resolvido'
    CLOSED = 'closed', 'Fechado'


class TicketPriority(models.TextChoices):
    LOW = 'low', 'Baixa'
    MEDIUM = 'medium', 'Media'
    HIGH = 'high', 'Alta'
    URGENT = 'urgent', 'Urgente'


class TicketNotificationType(models.TextChoices):
    COMMENT = 'comment', 'Comentario'
    STATUS = 'status', 'Status'
    UPDATE = 'update', 'Atualizacao'
    DUE_DATE = 'due_date', 'Previsao'
    ATTACHMENT = 'attachment', 'Evidencia'


class Ticket(UUIDTimeStampedModel):
    code = models.CharField(max_length=24, unique=True, editable=False, db_index=True)
    tenant = models.ForeignKey('tenants.Tenant', on_delete=models.CASCADE, related_name='tickets')
    requester = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='requested_tickets')
    title = models.CharField(max_length=160)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=TicketStatus.choices, default=TicketStatus.OPEN)
    priority = models.CharField(max_length=20, choices=TicketPriority.choices, default=TicketPriority.MEDIUM)
    due_date = models.DateField(null=True, blank=True)
    opened_at = models.DateTimeField(default=timezone.now, editable=False)
    last_activity_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-last_activity_at', '-opened_at']

    def clean(self):
        if self.requester_id and self.tenant_id and self.requester.tenant_id != self.tenant_id:
            raise ValidationError('Usuario solicitante e chamado devem pertencer ao mesmo tenant.')
        if self.due_date and self.opened_at and self.due_date < timezone.localdate(self.opened_at):
            raise ValidationError('A previsao de resolucao nao pode ser anterior a abertura do chamado.')

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = f"CH-{timezone.now():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"
        if not self.opened_at:
            self.opened_at = timezone.now()
        if not self.last_activity_at:
            self.last_activity_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.code


class TicketComment(UUIDTimeStampedModel):
    ticket = models.ForeignKey('tickets.Ticket', on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='ticket_comments')
    body = models.TextField()
    is_internal = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.ticket.code} - comentario'


class TicketAttachment(UUIDTimeStampedModel):
    ticket = models.ForeignKey('tickets.Ticket', on_delete=models.CASCADE, related_name='attachments')
    uploaded_by = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='ticket_attachments')
    file_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=120, blank=True)
    size_bytes = models.PositiveIntegerField(default=0)
    file_data = models.BinaryField()

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.file_name


class TicketNotification(UUIDTimeStampedModel):
    ticket = models.ForeignKey('tickets.Ticket', on_delete=models.CASCADE, related_name='notifications')
    recipient = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='ticket_notifications')
    actor = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='triggered_ticket_notifications')
    notification_type = models.CharField(max_length=20, choices=TicketNotificationType.choices)
    title = models.CharField(max_length=160)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def mark_as_read(self):
        self.is_read = True
        self.read_at = timezone.now()
        self.save(update_fields=['is_read', 'read_at', 'updated_at'])

    def __str__(self):
        return f'{self.ticket.code} -> {self.recipient.email}'
