import { useEffect, useMemo, useState } from 'react'

import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { roleAssignmentsMock } from '@/mocks/platform'
import type { PermissionMatrixRow, UserRole } from '@/types/entities'

const roleLabelMap: Record<UserRole, string> = {
  super_admin: 'Super_admin',
  analyst: 'Analista',
  viewer: 'Usuario',
}

export const PermissionsPage = () => {
  const { isViewAsMode } = useAuth()
  const { permissionMatrix, setPermissionMatrix, users, groups } = usePlatformStore()
  const { isSuperAdmin, filterByTenant } = useTenantScope()
  const [matrix, setMatrix] = useState<PermissionMatrixRow[]>(permissionMatrix)
  const isReadOnly = isViewAsMode
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    isSuperAdmin ? 'super_admin' : 'analyst',
  )

  const visibleRoles: UserRole[] = isSuperAdmin
    ? ['super_admin', 'analyst', 'viewer']
    : ['analyst', 'viewer']
  const scopedUsers = useMemo(
    () => filterByTenant(users, (item) => ({ tenantId: item.tenantId })),
    [filterByTenant, users],
  )
  const scopedGroups = useMemo(
    () => filterByTenant(groups, (item) => ({ tenantId: item.tenantId })),
    [filterByTenant, groups],
  )

  const selectedAssignment = useMemo(
    () => {
      const assignment = roleAssignmentsMock.find((item) => item.role === selectedRole)
      if (!assignment) return undefined
      if (isSuperAdmin) return assignment

      const allowedUsers = new Set(
        scopedUsers.map((user) => `${user.firstName} ${user.lastName}`),
      )
      const allowedGroups = new Set(scopedGroups.map((group) => group.name))

      return {
        ...assignment,
        users: assignment.users.filter((user) => allowedUsers.has(user)),
        groups: assignment.groups.filter((group) => allowedGroups.has(group)),
      }
    },
    [isSuperAdmin, scopedGroups, scopedUsers, selectedRole],
  )

  useEffect(() => {
    if (!visibleRoles.includes(selectedRole)) {
      setSelectedRole(visibleRoles[0])
    }
  }, [selectedRole, visibleRoles])

  useEffect(() => {
    setMatrix(permissionMatrix)
  }, [permissionMatrix])

  const handleToggle = (permissionKey: string, role: UserRole) => {
    setMatrix((current) =>
      current.map((row) =>
        row.key === permissionKey
          ? { ...row, byRole: { ...row.byRole, [role]: !row.byRole[role] } }
          : row,
      ),
    )
  }

  return (
    <section className="animate-fade-in">
      <PageHeader
        title="Perfis e permissoes"
        description="Matriz de governanca para controlar autorizacoes por papel, grupo e usuario."
        actions={
          <Button variant="outline" onClick={() => setPermissionMatrix(matrix)} disabled={isReadOnly}>
            Salvar politica
          </Button>
        }
      />

      {isReadOnly ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Visualizacao simulada ativa. A matriz pode ser consultada, mas alteracoes estao bloqueadas.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_0.8fr]">
        <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-card">
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permissao</TableHead>
                  {visibleRoles.map((role) => (
                    <TableHead key={role} className="text-center">
                      {roleLabelMap[role]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {matrix.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <p className="font-medium text-slate-900">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    </TableCell>
                    {visibleRoles.map((role) => (
                      <TableCell key={role} className="text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={row.byRole[role]}
                            onCheckedChange={() => handleToggle(row.key, role)}
                            disabled={isReadOnly}
                          />
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-card">
            <p className="mb-3 text-sm font-medium text-slate-700">Selecionar papel</p>
            <div className="space-y-2">
              {visibleRoles.map((role) => (
                <button
                  key={role}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    selectedRole === role
                      ? 'border-primary/35 bg-primary/5 text-primary'
                      : 'border-border/70 text-slate-700 hover:border-primary/25'
                  }`}
                  onClick={() => setSelectedRole(role)}
                >
                  {roleLabelMap[role]}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-card">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Associacoes do papel: {roleLabelMap[selectedRole]}
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Usuarios
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedAssignment?.users.map((user) => (
                    <Badge key={user} variant="neutral">
                      {user}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Grupos
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedAssignment?.groups.map((group) => (
                    <Badge key={group}>{group}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
