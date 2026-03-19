import { DatabaseZap, FileUp, PlugZap, RefreshCcw, ShieldCheck, TestTube2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/hooks/use-auth'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { useTenantScope } from '@/hooks/use-tenant-scope'
import { formatDate } from '@/lib/utils'
import { platformApi } from '@/services/platform-api'
import type {
  PowerBIConnection,
  PowerBIDatasetOption,
  PowerBIGateway,
  PowerBIGatewayDataSource,
  PowerBIWorkspaceOption,
} from '@/types/entities'

type ConnectionForm = {
  id?: string
  tenantId: string
  aadTenantId: string
  clientId: string
  clientSecret: string
  scope: string
  apiBaseUrl: string
  defaultWorkspaceId: string
  isActive: boolean
}

type GatewayForm = {
  id?: string
  tenantId: string
  connectionId: string
  name: string
  externalGatewayId: string
  gatewayType: string
  status: PowerBIGateway['status']
  notes: string
}

const defaultScope = 'https://analysis.windows.net/powerbi/api/.default'
const defaultApiBaseUrl = 'https://api.powerbi.com/v1.0/myorg'

const gatewayStatusVariantMap: Record<PowerBIGateway['status'], 'success' | 'neutral' | 'danger'> = {
  active: 'success',
  inactive: 'neutral',
  error: 'danger',
}

const shortClientId = (value: string) => (value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value)

export const PowerBIPage = () => {
  const { isViewAsMode } = useAuth()
  const { tenants, reloadData } = usePlatformStore()
  const { isSuperAdmin, userTenantId } = useTenantScope()
  const isReadOnly = isViewAsMode

  const [isLoading, setIsLoading] = useState(false)
  const [connections, setConnections] = useState<PowerBIConnection[]>([])
  const [gateways, setGateways] = useState<PowerBIGateway[]>([])
  const [datasources, setDatasources] = useState<PowerBIGatewayDataSource[]>([])
  const [workspaceOptions, setWorkspaceOptions] = useState<PowerBIWorkspaceOption[]>([])
  const [datasetOptions, setDatasetOptions] = useState<PowerBIDatasetOption[]>([])

  const [selectedConnectionId, setSelectedConnectionId] = useState('')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [selectedGatewayId, setSelectedGatewayId] = useState('')
  const [selectedDatasourceId, setSelectedDatasourceId] = useState('')
  const [syncCategory, setSyncCategory] = useState('Operacional')

  const [pbixFile, setPbixFile] = useState<File | null>(null)
  const [pbixDatasetName, setPbixDatasetName] = useState('')
  const [pbixConflictMode, setPbixConflictMode] = useState<'Abort' | 'Ignore' | 'Overwrite' | 'CreateOrOverwrite'>(
    'CreateOrOverwrite',
  )
  const [isUploadingPbix, setIsUploadingPbix] = useState(false)
  const pbixInputRef = useRef<HTMLInputElement>(null)

  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false)
  const [isGatewayDialogOpen, setIsGatewayDialogOpen] = useState(false)

  const [connectionForm, setConnectionForm] = useState<ConnectionForm>({
    tenantId: userTenantId ?? tenants[0]?.id ?? '',
    aadTenantId: '',
    clientId: '',
    clientSecret: '',
    scope: defaultScope,
    apiBaseUrl: defaultApiBaseUrl,
    defaultWorkspaceId: '',
    isActive: true,
  })

  const [gatewayForm, setGatewayForm] = useState<GatewayForm>({
    tenantId: userTenantId ?? tenants[0]?.id ?? '',
    connectionId: '',
    name: '',
    externalGatewayId: '',
    gatewayType: '',
    status: 'active',
    notes: '',
  })

  const availableTenants = useMemo(
    () => (isSuperAdmin ? tenants : tenants.filter((tenant) => tenant.id === userTenantId)),
    [isSuperAdmin, tenants, userTenantId],
  )

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.id === selectedConnectionId),
    [connections, selectedConnectionId],
  )

  const visibleGateways = useMemo(() => {
    if (!selectedConnection) return gateways
    return gateways.filter((gateway) => gateway.tenantId === selectedConnection.tenantId)
  }, [gateways, selectedConnection])

  const filteredDatasourceOptions = useMemo(
    () => datasources.filter((datasource) => datasource.gatewayId === selectedGatewayId),
    [datasources, selectedGatewayId],
  )

  const tenantSelectOptions = useMemo(
    () => availableTenants.map((tenant) => ({ value: tenant.id, label: tenant.name })),
    [availableTenants],
  )

  const tenantIdsWithConnection = useMemo(
    () => new Set(connections.map((connection) => connection.tenantId)),
    [connections],
  )

  const newConnectionTenantOptions = useMemo(
    () => tenantSelectOptions.filter((option) => !tenantIdsWithConnection.has(option.value)),
    [tenantSelectOptions, tenantIdsWithConnection],
  )

  const connectionTenantOptions = useMemo(
    () => (connectionForm.id ? tenantSelectOptions : newConnectionTenantOptions),
    [connectionForm.id, tenantSelectOptions, newConnectionTenantOptions],
  )

  const canCreateConnection = newConnectionTenantOptions.length > 0

  const connectionSelectOptions = useMemo(
    () =>
      connections.map((connection) => ({
        value: connection.id,
        label: `${connection.tenantName} - ${shortClientId(connection.clientId)}`,
        keywords: `${connection.tenantName} ${connection.clientId}`,
      })),
    [connections],
  )

  const workspaceSelectOptions = useMemo(
    () => workspaceOptions.map((workspace) => ({ value: workspace.id, label: workspace.name })),
    [workspaceOptions],
  )

  const datasetSelectOptions = useMemo(
    () => datasetOptions.map((dataset) => ({ value: dataset.id, label: dataset.name })),
    [datasetOptions],
  )

  const gatewaySelectOptions = useMemo(
    () =>
      visibleGateways.map((gateway) => ({
        value: gateway.id,
        label: gateway.name,
        keywords: `${gateway.externalGatewayId} ${gateway.tenantName}`,
      })),
    [visibleGateways],
  )

  const datasourceSelectOptions = useMemo(
    () =>
      filteredDatasourceOptions.map((datasource) => ({
        value: datasource.id,
        label: datasource.name,
        keywords: datasource.externalDatasourceId,
      })),
    [filteredDatasourceOptions],
  )

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [connectionsData, gatewaysData, datasourcesData] = await Promise.all([
        platformApi.listPowerBIConnections(),
        platformApi.listPowerBIGateways(),
        platformApi.listPowerBIGatewayDatasources(),
      ])
      setConnections(connectionsData)
      setGateways(gatewaysData)
      setDatasources(datasourcesData)

      const nextConnectionId =
        connectionsData.find((connection) => connection.id === selectedConnectionId)?.id ?? connectionsData[0]?.id ?? ''
      setSelectedConnectionId(nextConnectionId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar configuracoes do Power BI.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedConnection) {
      setSelectedWorkspaceId('')
      setSelectedDatasetId('')
      setSelectedGatewayId('')
      setSelectedDatasourceId('')
      setWorkspaceOptions([])
      setDatasetOptions([])
      return
    }

    setWorkspaceOptions([])
    setSelectedWorkspaceId(selectedConnection.defaultWorkspaceId || '')
    setSelectedDatasetId('')
    setSelectedGatewayId('')
    setSelectedDatasourceId('')
    setDatasetOptions([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConnectionId])

  const openConnectionCreate = () => {
    if (isReadOnly) return

    if (!canCreateConnection) {
      toast.error('Todos os tenants visiveis ja possuem conexao Power BI exclusiva cadastrada.')
      return
    }

    setConnectionForm({
      tenantId: userTenantId ?? newConnectionTenantOptions[0]?.value ?? '',
      aadTenantId: '',
      clientId: '',
      clientSecret: '',
      scope: defaultScope,
      apiBaseUrl: defaultApiBaseUrl,
      defaultWorkspaceId: '',
      isActive: true,
    })
    setIsConnectionDialogOpen(true)
  }

  const openConnectionEdit = (connection: PowerBIConnection) => {
    if (isReadOnly) return

    setConnectionForm({
      id: connection.id,
      tenantId: connection.tenantId,
      aadTenantId: connection.aadTenantId,
      clientId: connection.clientId,
      clientSecret: '',
      scope: connection.scope,
      apiBaseUrl: connection.apiBaseUrl,
      defaultWorkspaceId: connection.defaultWorkspaceId,
      isActive: connection.isActive,
    })
    setIsConnectionDialogOpen(true)
  }


  const saveConnection = async () => {
    if (!connectionForm.tenantId || !connectionForm.aadTenantId.trim() || !connectionForm.clientId.trim()) {
      toast.error('Preencha tenant, AAD tenant id e client id.')
      return
    }

    if (!connectionForm.id && !connectionForm.clientSecret.trim()) {
      toast.error('Client secret e obrigatoria para criar a conexao.')
      return
    }

    try {
      await platformApi.upsertPowerBIConnection({
        id: connectionForm.id,
        tenant: connectionForm.tenantId,
        aad_tenant_id: connectionForm.aadTenantId.trim(),
        client_id: connectionForm.clientId.trim(),
        ...(connectionForm.clientSecret.trim() ? { client_secret: connectionForm.clientSecret.trim() } : {}),
        scope: connectionForm.scope.trim() || defaultScope,
        api_base_url: connectionForm.apiBaseUrl.trim() || defaultApiBaseUrl,
        default_workspace_id: connectionForm.defaultWorkspaceId.trim(),
        is_active: connectionForm.isActive,
      })

      toast.success(connectionForm.id ? 'Conexao atualizada.' : 'Conexao criada com sucesso.')
      setIsConnectionDialogOpen(false)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar conexao.')
    }
  }

  const deleteConnection = async (connection: PowerBIConnection) => {
    const confirmed = window.confirm(
      `Excluir a conexao do tenant "${connection.tenantName}"? Essa acao remove as credenciais salvas.`,
    )
    if (!confirmed) return

    try {
      await platformApi.deletePowerBIConnection(connection.id)
      toast.success('Conexao excluida com sucesso.')
      if (selectedConnectionId === connection.id) {
        setSelectedConnectionId('')
      }
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel excluir conexao.')
    }
  }

  const openGatewayCreate = () => {
    if (isReadOnly) return

    setGatewayForm({
      tenantId: userTenantId ?? availableTenants[0]?.id ?? '',
      connectionId: selectedConnectionId,
      name: '',
      externalGatewayId: '',
      gatewayType: '',
      status: 'active',
      notes: '',
    })
    setIsGatewayDialogOpen(true)
  }

  const openGatewayEdit = (gateway: PowerBIGateway) => {
    if (isReadOnly) return

    setGatewayForm({
      id: gateway.id,
      tenantId: gateway.tenantId,
      connectionId: gateway.connectionId ?? '',
      name: gateway.name,
      externalGatewayId: gateway.externalGatewayId,
      gatewayType: gateway.gatewayType ?? '',
      status: gateway.status,
      notes: gateway.notes ?? '',
    })
    setIsGatewayDialogOpen(true)
  }

  const saveGateway = async () => {
    if (!gatewayForm.tenantId || !gatewayForm.name.trim() || !gatewayForm.externalGatewayId.trim()) {
      toast.error('Preencha tenant, nome e gateway id.')
      return
    }

    try {
      await platformApi.upsertPowerBIGateway({
        id: gatewayForm.id,
        tenant: gatewayForm.tenantId,
        connection: gatewayForm.connectionId || null,
        name: gatewayForm.name.trim(),
        external_gateway_id: gatewayForm.externalGatewayId.trim(),
        gateway_type: gatewayForm.gatewayType.trim(),
        status: gatewayForm.status,
        notes: gatewayForm.notes.trim(),
      })
      toast.success(gatewayForm.id ? 'Gateway atualizado.' : 'Gateway cadastrado com sucesso.')
      setIsGatewayDialogOpen(false)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar gateway.')
    }
  }

  const testConnection = async (connectionId: string) => {
    try {
      const result = await platformApi.testPowerBIConnection(connectionId)
      toast.success(`${result.detail} (${result.workspacesCount} workspaces)`)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao testar conexao.')
    }
  }

  const syncWorkspaces = async (connectionId: string) => {
    try {
      const result = await platformApi.syncPowerBIWorkspaces(connectionId)
      toast.success(`${result.detail} (${result.synced} sincronizados)`)
      await reloadData()
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar workspaces.')
    }
  }

  const syncGateways = async (connectionId: string) => {
    try {
      const result = await platformApi.syncPowerBIGateways(connectionId)
      toast.success(`${result.detail} Gateways: ${result.gatewaysSynced} | Datasources: ${result.datasourcesSynced}`)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar gateways.')
    }
  }

  const syncGatewayDatasources = async (gatewayId: string) => {
    try {
      const result = await platformApi.syncPowerBIGatewayDatasources(gatewayId)
      toast.success(`${result.detail} (${result.synced})`)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar datasources.')
    }
  }

  const loadWorkspacesFromConnection = async (connectionId = selectedConnectionId) => {
    if (!connectionId) {
      toast.error('Selecione uma conexao primeiro.')
      return
    }

    try {
      const items = await platformApi.listPowerBIWorkspaces(connectionId)
      setWorkspaceOptions(items)
      if (items.length > 0) {
        const preferredWorkspaceId =
          connections.find((connection) => connection.id === connectionId)?.defaultWorkspaceId || ''

        const nextWorkspaceId =
          items.find((workspace) => workspace.id === preferredWorkspaceId)?.id ?? items[0].id

        setSelectedWorkspaceId(nextWorkspaceId)
      } else {
        setSelectedWorkspaceId('')
      }
      toast.success(`Workspaces carregados: ${items.length}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar workspaces.')
    }
  }

  const loadDatasetsFromWorkspace = async (workspaceId: string) => {
    if (!selectedConnectionId || !workspaceId) return

    try {
      const items = await platformApi.listPowerBIDatasets(selectedConnectionId, workspaceId)
      setDatasetOptions(items)
      setSelectedDatasetId(items[0]?.id ?? '')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel carregar datasets.')
    }
  }

  const syncReportsToDashboards = async () => {
    if (!selectedConnectionId || !selectedWorkspaceId) {
      toast.error('Selecione conexao e workspace para sincronizar reports.')
      return
    }

    try {
      const result = await platformApi.syncPowerBIReports(selectedConnectionId, {
        workspace_id: selectedWorkspaceId,
        category: syncCategory.trim() || 'Operacional',
        status: 'draft',
      })
      toast.success(`${result.detail} Criados: ${result.created} | Atualizados: ${result.updated}`)
      await reloadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao sincronizar reports.')
    }
  }

  const uploadPbixToWorkspace = async () => {
    if (!selectedConnectionId || !selectedWorkspaceId) {
      toast.error('Selecione conexao e workspace para upload do PBIX.')
      return
    }

    if (!pbixFile) {
      toast.error('Selecione um arquivo .pbix para enviar.')
      return
    }

    setIsUploadingPbix(true)
    try {
      const result = await platformApi.uploadPowerBIPbix(selectedConnectionId, {
        workspace_id: selectedWorkspaceId,
        pbixFile,
        category: syncCategory.trim() || 'Operacional',
        status: 'draft',
        datasetDisplayName: pbixDatasetName.trim() || undefined,
        nameConflict: pbixConflictMode,
      })

      toast.success(`${result.detail} Criados: ${result.created} | Atualizados: ${result.updated}`)
      setPbixFile(null)
      setPbixDatasetName('')
      if (pbixInputRef.current) pbixInputRef.current.value = ''
      await reloadData()
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao enviar PBIX para o Power BI.')
    } finally {
      setIsUploadingPbix(false)
    }
  }

  const bindDatasetToGateway = async () => {
    if (!selectedConnectionId || !selectedDatasetId || !selectedGatewayId) {
      toast.error('Selecione conexao, dataset e gateway para vincular.')
      return
    }

    try {
      await platformApi.bindDatasetToGateway(selectedConnectionId, {
        dataset_id: selectedDatasetId,
        gateway_id:
          visibleGateways.find((gateway) => gateway.id === selectedGatewayId)?.externalGatewayId ?? selectedGatewayId,
        ...(selectedDatasourceId
          ? {
              datasource_id:
                filteredDatasourceOptions.find((datasource) => datasource.id === selectedDatasourceId)
                  ?.externalDatasourceId ?? selectedDatasourceId,
            }
          : {}),
      })
      toast.success('Dataset vinculado ao gateway com sucesso.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao vincular dataset ao gateway.')
    }
  }

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setDatasetOptions([])
      setSelectedDatasetId('')
      return
    }

    void loadDatasetsFromWorkspace(selectedWorkspaceId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceId, selectedConnectionId])

  return (
    <>
      <section className="animate-fade-in space-y-4">
        <PageHeader
          title="Power BI Embedded"
          description="Configure conexoes exclusivas por tenant, sincronize metadados, publique dashboards e gerencie gateways."
          actions={
            <>
              <Button variant="outline" className="gap-2" onClick={() => void loadData()} disabled={isLoading}>
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </Button>
              <Button variant="outline" className="gap-2" onClick={openGatewayCreate} disabled={isReadOnly}>
                <PlugZap className="h-4 w-4" />
                Novo gateway
              </Button>
              <Button className="gap-2" onClick={openConnectionCreate} disabled={isReadOnly || !canCreateConnection}>
                <DatabaseZap className="h-4 w-4" />
                Nova conexao
              </Button>
            </>
          }
        />

        {isReadOnly ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Visualizacao simulada ativa. As configuracoes do Power BI podem ser consultadas, mas alteracoes, sincronizacoes e uploads estao bloqueados.
          </div>
        ) : null}

        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle>Conexoes Power BI</CardTitle>
            <CardDescription>
              Cada tenant deve possuir sua propria service principal/licenca, sem compartilhamento entre clientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ultimo teste</TableHead>
                    <TableHead>Ultimo sync</TableHead>
                    <TableHead>Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.length > 0 ? (
                    connections.map((connection) => (
                      <TableRow key={connection.id}>
                        <TableCell className="font-medium text-slate-900">{connection.tenantName}</TableCell>
                        <TableCell className="font-mono text-xs">{connection.clientId}</TableCell>
                        <TableCell>
                          <Badge variant={connection.isActive ? 'success' : 'neutral'}>
                            {connection.isActive ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>{connection.lastTestedAt ? formatDate(connection.lastTestedAt) : '-'}</TableCell>
                        <TableCell>{connection.lastSyncAt ? formatDate(connection.lastSyncAt) : '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openConnectionEdit(connection)} disabled={isReadOnly}>
                              Editar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => void deleteConnection(connection)}
                              disabled={isReadOnly}
                            >
                              Excluir
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => void testConnection(connection.id)} disabled={isReadOnly}>
                              <TestTube2 className="h-3.5 w-3.5" />
                              Testar
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => void syncWorkspaces(connection.id)} disabled={isReadOnly}>
                              Sync workspaces
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => void syncGateways(connection.id)} disabled={isReadOnly}>
                              Sync gateways
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-sm text-muted-foreground">
                        Nenhuma conexao cadastrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle>Publicacao e embed</CardTitle>
            <CardDescription>Sincronize reports do workspace para cadastro automatico de dashboards.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full min-w-[240px] flex-1 md:w-[320px] md:flex-none">
                <SearchableSelect
                  value={selectedConnectionId}
                  onValueChange={setSelectedConnectionId}
                  options={connectionSelectOptions}
                  placeholder="Selecione a conexao"
                  searchPlaceholder="Pesquisar conexao"
                  triggerClassName="w-full"
                />
              </div>
              <div className="w-full min-w-[220px] flex-1 md:w-[250px] md:flex-none">
                <SearchableSelect
                  value={selectedWorkspaceId}
                  onValueChange={setSelectedWorkspaceId}
                  options={workspaceSelectOptions}
                  placeholder="Selecione o workspace"
                  searchPlaceholder="Pesquisar workspace"
                  triggerClassName="w-full"
                />
              </div>
              <Input
                className="w-full min-w-[190px] flex-1 md:w-[220px] md:flex-none"
                value={syncCategory}
                onChange={(event) => setSyncCategory(event.target.value)}
                placeholder="Categoria"
              />
              <Button variant="outline" className="gap-2 whitespace-nowrap" onClick={() => void loadWorkspacesFromConnection()}>
                <RefreshCcw className="h-4 w-4" />
                Workspaces
              </Button>
              <Button className="gap-2 whitespace-nowrap" onClick={() => void syncReportsToDashboards()} disabled={isReadOnly}>
                <ShieldCheck className="h-4 w-4" />
                Sync reports
              </Button>
            </div>
            <p className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
              A acao "Sync reports" cria/atualiza dashboards com report_id, dataset_id e embed_url para o embed real.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle>Importacao PBIX</CardTitle>
            <CardDescription>
              Envie arquivo .pbix para o workspace selecionado, sem precisar acesso direto ao Power BI Service.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Input
                className="w-full md:w-[360px] md:flex-none"
                ref={pbixInputRef}
                type="file"
                accept=".pbix"
                disabled={isReadOnly}
                onChange={(event) => setPbixFile(event.target.files?.[0] ?? null)}
              />
              <Input
                className="w-full md:w-[260px] md:flex-none"
                value={pbixDatasetName}
                disabled={isReadOnly}
                onChange={(event) => setPbixDatasetName(event.target.value)}
                placeholder="Nome do dataset (opcional)"
              />
              <div className="w-full md:w-[190px] md:flex-none">
                <Select
                  value={pbixConflictMode}
                  onValueChange={(value) =>
                    setPbixConflictMode(value as 'Abort' | 'Ignore' | 'Overwrite' | 'CreateOrOverwrite')
                  }
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CreateOrOverwrite">CreateOrOverwrite</SelectItem>
                    <SelectItem value="Overwrite">Overwrite</SelectItem>
                    <SelectItem value="Abort">Abort</SelectItem>
                    <SelectItem value="Ignore">Ignore</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="gap-2 whitespace-nowrap md:flex-none" onClick={() => void uploadPbixToWorkspace()} disabled={isReadOnly || isUploadingPbix || !pbixFile}>
                <FileUp className="h-4 w-4" />
                {isUploadingPbix ? 'Enviando...' : 'Enviar PBIX'}
              </Button>
            </div>
            <p className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
              {pbixFile ? `Arquivo selecionado: ${pbixFile.name}` : 'Selecione um arquivo .pbix para iniciar o upload.'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle>Gateways e datasources</CardTitle>
            <CardDescription>Cadastre/sincronize gateways e vincule datasets para atualizacao segura.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="w-full md:w-[280px] md:flex-none">
                <SearchableSelect
                  value={selectedConnectionId}
                  onValueChange={setSelectedConnectionId}
                  options={connectionSelectOptions}
                  placeholder="Conexao"
                  searchPlaceholder="Pesquisar conexao"
                  triggerClassName="w-full"
                />
              </div>
              <div className="w-full md:w-[220px] md:flex-none">
                <SearchableSelect
                  value={selectedDatasetId}
                  onValueChange={setSelectedDatasetId}
                  options={datasetSelectOptions}
                  placeholder="Dataset"
                  searchPlaceholder="Pesquisar dataset"
                  triggerClassName="w-full"
                  disabled={isReadOnly}
                />
              </div>
              <div className="w-full md:w-[220px] md:flex-none">
                <SearchableSelect
                  value={selectedGatewayId}
                  onValueChange={(value) => {
                    setSelectedGatewayId(value)
                    setSelectedDatasourceId('')
                  }}
                  options={gatewaySelectOptions}
                  placeholder="Gateway"
                  searchPlaceholder="Pesquisar gateway"
                  triggerClassName="w-full"
                  disabled={isReadOnly}
                />
              </div>
              <div className="w-full md:w-[220px] md:flex-none">
                <Select value={selectedDatasourceId || '__none__'} onValueChange={(value) => setSelectedDatasourceId(value === '__none__' ? '' : value)} disabled={isReadOnly}>
                  <SelectTrigger>
                    <SelectValue placeholder="Datasource (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Datasource (opcional)</SelectItem>
                    {datasourceSelectOptions.map((datasource) => (
                      <SelectItem key={datasource.value} value={datasource.value}>
                        {datasource.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="gap-2 whitespace-nowrap md:flex-none" onClick={() => void bindDatasetToGateway()} disabled={isReadOnly}>
                <PlugZap className="h-4 w-4" />
                Vincular dataset
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Gateway ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Datasources</TableHead>
                    <TableHead>Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleGateways.length > 0 ? (
                    visibleGateways.map((gateway) => (
                      <TableRow key={gateway.id}>
                        <TableCell className="font-medium text-slate-900">{gateway.name}</TableCell>
                        <TableCell>{gateway.tenantName}</TableCell>
                        <TableCell className="font-mono text-xs">{gateway.externalGatewayId}</TableCell>
                        <TableCell>
                          <Badge variant={gatewayStatusVariantMap[gateway.status]}>{gateway.status}</Badge>
                        </TableCell>
                        <TableCell>{gateway.datasourcesCount}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openGatewayEdit(gateway)} disabled={isReadOnly}>
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => void syncGatewayDatasources(gateway.id)}
                              disabled={isReadOnly}
                            >
                              <RefreshCcw className="h-3.5 w-3.5" />
                              Sync datasources
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-20 text-center text-sm text-muted-foreground">
                        Nenhum gateway cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={isConnectionDialogOpen} onOpenChange={setIsConnectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{connectionForm.id ? 'Editar conexao Power BI' : 'Nova conexao Power BI'}</DialogTitle>
            <DialogDescription>
              Configure credenciais exclusivas da service principal para este tenant.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {isSuperAdmin ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Tenant</label>
                <div className="mt-1">
                  <SearchableSelect
                    value={connectionForm.tenantId}
                    onValueChange={(value) => setConnectionForm((current) => ({ ...current, tenantId: value }))}
                    options={connectionTenantOptions}
                    placeholder="Selecione o tenant"
                    searchPlaceholder="Pesquisar tenant"
                  />
                </div>
                {!connectionForm.id ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Apenas tenants sem conexao cadastrada aparecem na criacao.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="text-sm font-medium text-slate-700">AAD Tenant ID</label>
              <Input
                className="mt-1"
                value={connectionForm.aadTenantId}
                onChange={(event) => setConnectionForm((current) => ({ ...current, aadTenantId: event.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Client ID</label>
              <Input
                className="mt-1"
                value={connectionForm.clientId}
                onChange={(event) => setConnectionForm((current) => ({ ...current, clientId: event.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Client Secret</label>
              <Input
                className="mt-1"
                type="password"
                placeholder={connectionForm.id ? 'Deixe em branco para manter o secret existente' : ''}
                value={connectionForm.clientSecret}
                onChange={(event) => setConnectionForm((current) => ({ ...current, clientSecret: event.target.value }))}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Scope</label>
                <Input
                  className="mt-1"
                  value={connectionForm.scope}
                  onChange={(event) => setConnectionForm((current) => ({ ...current, scope: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Default workspace ID</label>
                <Input
                  className="mt-1"
                  value={connectionForm.defaultWorkspaceId}
                  onChange={(event) =>
                    setConnectionForm((current) => ({ ...current, defaultWorkspaceId: event.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">API base URL</label>
              <Input
                className="mt-1"
                value={connectionForm.apiBaseUrl}
                onChange={(event) => setConnectionForm((current) => ({ ...current, apiBaseUrl: event.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Status</label>
              <Select
                value={connectionForm.isActive ? 'active' : 'inactive'}
                onValueChange={(value) => setConnectionForm((current) => ({ ...current, isActive: value === 'active' }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConnectionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveConnection()} disabled={isReadOnly}>
              {connectionForm.id ? 'Salvar alteracoes' : 'Criar conexao'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isGatewayDialogOpen} onOpenChange={setIsGatewayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{gatewayForm.id ? 'Editar gateway' : 'Novo gateway'}</DialogTitle>
            <DialogDescription>Configure metadados do gateway para vinculo de datasets.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {isSuperAdmin ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Tenant</label>
                <div className="mt-1">
                  <SearchableSelect
                    value={gatewayForm.tenantId}
                    onValueChange={(value) => setGatewayForm((current) => ({ ...current, tenantId: value }))}
                    options={tenantSelectOptions}
                    placeholder="Selecione o tenant"
                    searchPlaceholder="Pesquisar tenant"
                  />
                </div>
              </div>
            ) : null}

            <div>
              <label className="text-sm font-medium text-slate-700">Conexao</label>
              <div className="mt-1">
                <SearchableSelect
                  value={gatewayForm.connectionId}
                  onValueChange={(value) => setGatewayForm((current) => ({ ...current, connectionId: value }))}
                  options={connectionSelectOptions.filter((option) => {
                    const connection = connections.find((item) => item.id === option.value)
                    return connection ? connection.tenantId === gatewayForm.tenantId : true
                  })}
                  placeholder="Selecione a conexao"
                  searchPlaceholder="Pesquisar conexao"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Nome</label>
              <Input
                className="mt-1"
                value={gatewayForm.name}
                onChange={(event) => setGatewayForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Gateway ID</label>
              <Input
                className="mt-1"
                value={gatewayForm.externalGatewayId}
                onChange={(event) =>
                  setGatewayForm((current) => ({ ...current, externalGatewayId: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Tipo</label>
                <Input
                  className="mt-1"
                  placeholder="Ex.: Enterprise"
                  value={gatewayForm.gatewayType}
                  onChange={(event) => setGatewayForm((current) => ({ ...current, gatewayType: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Status</label>
                <Select
                  value={gatewayForm.status}
                  onValueChange={(value) =>
                    setGatewayForm((current) => ({ ...current, status: value as PowerBIGateway['status'] }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="error">Erro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Observacoes</label>
              <textarea
                className="mt-1 min-h-[84px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/35"
                value={gatewayForm.notes}
                onChange={(event) => setGatewayForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGatewayDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveGateway()} disabled={isReadOnly}>{gatewayForm.id ? 'Salvar' : 'Criar gateway'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

