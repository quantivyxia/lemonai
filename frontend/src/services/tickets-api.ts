import { apiDownload, apiList, apiRequest } from '@/services/api-client'
import type { Ticket, TicketAttachment, TicketComment, TicketNotification, TicketPriority, TicketStatus } from '@/types/entities'

export const TICKET_NOTIFICATIONS_UPDATED_EVENT = 'insighthub:tickets-notifications-updated'

export const emitTicketNotificationsUpdated = () => {
  window.dispatchEvent(new CustomEvent(TICKET_NOTIFICATIONS_UPDATED_EVENT))
}

type BackendTicketAttachment = {
  id: string
  file_name: string
  content_type: string
  size_bytes: number
  uploaded_by: string
  uploaded_by_name: string
  created_at: string
  download_url: string
}

type BackendTicketComment = {
  id: string
  author: string
  author_name: string
  body: string
  is_internal: boolean
  created_at: string
}

type BackendTicket = {
  id: string
  code: string
  tenant: string
  tenant_name: string
  requester: string
  requester_name: string
  requester_email: string
  title: string
  description: string
  status: TicketStatus
  status_label: string
  priority: TicketPriority
  priority_label: string
  due_date: string | null
  opened_at: string
  last_activity_at: string
  created_at: string
  updated_at: string
  comments_count: number
  attachments_count: number
  comments: BackendTicketComment[]
  attachments: BackendTicketAttachment[]
}

type BackendTicketNotification = {
  id: string
  ticket: string
  ticket_code: string
  ticket_title: string
  ticket_status: TicketStatus
  notification_type: 'comment' | 'status' | 'update' | 'due_date' | 'attachment'
  title: string
  message: string
  actor_name?: string
  is_read: boolean
  created_at: string
  read_at?: string | null
}

const mapAttachment = (attachment: BackendTicketAttachment): TicketAttachment => ({
  id: attachment.id,
  fileName: attachment.file_name,
  contentType: attachment.content_type,
  sizeBytes: attachment.size_bytes,
  uploadedBy: attachment.uploaded_by,
  uploadedByName: attachment.uploaded_by_name,
  createdAt: attachment.created_at,
  downloadUrl: attachment.download_url,
})

const mapComment = (comment: BackendTicketComment): TicketComment => ({
  id: comment.id,
  author: comment.author,
  authorName: comment.author_name,
  body: comment.body,
  isInternal: comment.is_internal,
  createdAt: comment.created_at,
})

const mapTicket = (ticket: BackendTicket): Ticket => ({
  id: ticket.id,
  code: ticket.code,
  tenantId: ticket.tenant,
  tenantName: ticket.tenant_name,
  requesterId: ticket.requester,
  requesterName: ticket.requester_name,
  requesterEmail: ticket.requester_email,
  title: ticket.title,
  description: ticket.description,
  status: ticket.status,
  statusLabel: ticket.status_label,
  priority: ticket.priority,
  priorityLabel: ticket.priority_label,
  dueDate: ticket.due_date,
  openedAt: ticket.opened_at,
  lastActivityAt: ticket.last_activity_at,
  createdAt: ticket.created_at,
  updatedAt: ticket.updated_at,
  commentsCount: ticket.comments_count,
  attachmentsCount: ticket.attachments_count,
  comments: ticket.comments.map(mapComment),
  attachments: ticket.attachments.map(mapAttachment),
})

const mapNotification = (notification: BackendTicketNotification): TicketNotification => ({
  id: notification.id,
  ticketId: notification.ticket,
  ticketCode: notification.ticket_code,
  ticketTitle: notification.ticket_title,
  ticketStatus: notification.ticket_status,
  notificationType: notification.notification_type,
  title: notification.title,
  message: notification.message,
  actorName: notification.actor_name,
  isRead: notification.is_read,
  createdAt: notification.created_at,
  readAt: notification.read_at,
})

export const ticketsApi = {
  async listTickets(filters?: {
    tenant?: string
    requester?: string
    status?: string
    priority?: string
    search?: string
  }) {
    const params = new URLSearchParams()
    if (filters?.tenant && filters.tenant !== 'all') params.set('tenant', filters.tenant)
    if (filters?.requester && filters.requester !== 'all') params.set('requester', filters.requester)
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters?.priority && filters.priority !== 'all') params.set('priority', filters.priority)
    if (filters?.search?.trim()) params.set('search', filters.search.trim())

    const query = params.toString()
    const payload = await apiList<BackendTicket>(`/tickets/${query ? `?${query}` : ''}`)
    return payload.map(mapTicket)
  },

  async upsertTicket(payload: {
    id?: string
    tenant?: string
    title: string
    description: string
    status?: TicketStatus
    priority?: TicketPriority
    due_date?: string | null
  }) {
    const body = JSON.stringify(payload)
    if (payload.id) {
      const response = await apiRequest<BackendTicket>(`/tickets/${payload.id}/`, { method: 'PATCH', body })
      emitTicketNotificationsUpdated()
      return mapTicket(response)
    }

    const response = await apiRequest<BackendTicket>('/tickets/', { method: 'POST', body })
    emitTicketNotificationsUpdated()
    return mapTicket(response)
  },

  async addComment(ticketId: string, payload: { body: string; is_internal?: boolean }) {
    const response = await apiRequest<BackendTicketComment>(`/tickets/${ticketId}/comments/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    emitTicketNotificationsUpdated()
    return mapComment(response)
  },

  async uploadAttachment(ticketId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiRequest<BackendTicketAttachment>(`/tickets/${ticketId}/attachments/`, {
      method: 'POST',
      body: formData,
    })
    emitTicketNotificationsUpdated()
    return mapAttachment(response)
  },

  async downloadAttachment(attachment: TicketAttachment) {
    const { blob, fileName } = await apiDownload(attachment.downloadUrl)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName || attachment.fileName
    link.click()
    URL.revokeObjectURL(url)
  },

  async getNotifications() {
    const payload = await apiRequest<{ unread_count: number; results: BackendTicketNotification[] }>('/tickets/notifications/')
    return {
      unreadCount: payload.unread_count,
      notifications: payload.results.map(mapNotification),
    }
  },

  async markNotificationRead(notificationId: string) {
    await apiRequest(`/tickets/notifications/${notificationId}/read/`, { method: 'POST' })
    emitTicketNotificationsUpdated()
  },

  async markAllNotificationsRead() {
    await apiRequest('/tickets/notifications/read-all/', { method: 'POST' })
    emitTicketNotificationsUpdated()
  },

  async markTicketNotificationsRead(ticketId: string) {
    await apiRequest(`/tickets/${ticketId}/notifications/read/`, { method: 'POST' })
    emitTicketNotificationsUpdated()
  },
}
