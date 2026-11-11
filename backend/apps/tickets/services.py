from __future__ import annotations

from django.utils import timezone

from apps.common.services import is_analyst
from apps.tickets.models import TicketNotification, TicketNotificationType


def touch_ticket(ticket):
    ticket.last_activity_at = timezone.now()
    ticket.save(update_fields=['last_activity_at', 'updated_at'])


def create_ticket_notification(*, ticket, recipient, actor, notification_type: str, title: str, message: str):
    if not recipient or not getattr(recipient, 'is_active', False):
        return None
    if actor and getattr(actor, 'id', None) == getattr(recipient, 'id', None):
        return None
    if not is_analyst(recipient):
        return None

    return TicketNotification.objects.create(
        ticket=ticket,
        recipient=recipient,
        actor=actor,
        notification_type=notification_type,
        title=title,
        message=message,
    )


def notify_ticket_updated(ticket, actor, changes: list[str]):
    if not changes:
        return None

    readable = ', '.join(changes)
    return create_ticket_notification(
        ticket=ticket,
        recipient=ticket.requester,
        actor=actor,
        notification_type=TicketNotificationType.UPDATE,
        title=f'Chamado {ticket.code} atualizado',
        message=f'{getattr(actor, "full_name", "Administrador")} atualizou: {readable}.',
    )


def notify_ticket_status(ticket, actor):
    return create_ticket_notification(
        ticket=ticket,
        recipient=ticket.requester,
        actor=actor,
        notification_type=TicketNotificationType.STATUS,
        title=f'Status do chamado {ticket.code} alterado',
        message=f'O chamado agora esta como {ticket.get_status_display().lower()}.',
    )


def notify_ticket_due_date(ticket, actor):
    if not ticket.due_date:
        return None

    return create_ticket_notification(
        ticket=ticket,
        recipient=ticket.requester,
        actor=actor,
        notification_type=TicketNotificationType.DUE_DATE,
        title=f'Previsao atualizada em {ticket.code}',
        message=f'Nova previsao de resolucao: {ticket.due_date.strftime("%d/%m/%Y")}.',
    )


def notify_ticket_comment(ticket, actor, *, internal: bool = False):
    if internal:
        return None

    return create_ticket_notification(
        ticket=ticket,
        recipient=ticket.requester,
        actor=actor,
        notification_type=TicketNotificationType.COMMENT,
        title=f'Novo comentario em {ticket.code}',
        message=f'{getattr(actor, "full_name", "Administrador")} adicionou um comentario ao chamado.',
    )


def notify_ticket_attachment(ticket, actor):
    return create_ticket_notification(
        ticket=ticket,
        recipient=ticket.requester,
        actor=actor,
        notification_type=TicketNotificationType.ATTACHMENT,
        title=f'Nova evidencia em {ticket.code}',
        message=f'{getattr(actor, "full_name", "Administrador")} anexou uma evidencia ao chamado.',
    )
