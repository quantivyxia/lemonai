import type { Workspace } from '@/types/entities'

export const workspacesMock: Workspace[] = [
  {
    id: 'ws-001',
    tenantId: 't-001',
    tenantName: 'Nexa Consultoria',
    name: 'Comercial',
    externalWorkspaceId: '2f2f4ac9-e8de-4d48-9ab7',
    status: 'active',
    lastSyncAt: '2026-03-08T15:30:00Z',
    dashboardsCount: 1,
  },
  {
    id: 'ws-002',
    tenantId: 't-001',
    tenantName: 'Nexa Consultoria',
    name: 'Financeiro',
    externalWorkspaceId: 'ec846003-e8f6-4adf-9f61-d4f74a7f9bc3',
    status: 'syncing',
    lastSyncAt: '2026-03-08T14:10:00Z',
    dashboardsCount: 1,
  },
  {
    id: 'ws-003',
    tenantId: 't-002',
    tenantName: 'Solaris Foods',
    name: 'Operacoes',
    externalWorkspaceId: '51f8163a-c4d7-45f7-b780-f9988e81a3de',
    status: 'active',
    lastSyncAt: '2026-03-08T12:20:00Z',
    dashboardsCount: 1,
  },
  {
    id: 'ws-004',
    tenantId: 't-003',
    tenantName: 'Vanguard Retail',
    name: 'PMO',
    externalWorkspaceId: '6c0aeb62-f8f4-4192-84ce-8ce098e2864f',
    status: 'inactive',
    lastSyncAt: '2026-03-05T11:55:00Z',
    dashboardsCount: 1,
  },
]
