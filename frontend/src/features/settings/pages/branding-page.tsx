import { Globe, Image, RotateCcw, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { SearchableSelect } from '@/components/shared/searchable-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/use-auth'
import { usePlatformStore } from '@/hooks/use-platform-store'
import { useTenantScope } from '@/hooks/use-tenant-scope'

export const BrandingPage = () => {
  const defaultPrimaryColor = '#0f6fe8'
  const defaultSecondaryColor = '#14b8a6'

  const { isViewAsMode } = useAuth()
  const { tenants, brandings, upsertBranding } = usePlatformStore()
  const { isSuperAdmin, userTenantId, userTenantName } = useTenantScope()
  const isReadOnly = isViewAsMode
  const [searchParams] = useSearchParams()
  const tenantFromQuery = searchParams.get('tenant')

  const initialTenantId = isSuperAdmin
    ? (tenantFromQuery ?? tenants[0]?.id ?? '')
    : (userTenantId ?? tenants[0]?.id ?? '')
  const [tenantId, setTenantId] = useState(initialTenantId)
  const [platformName, setPlatformName] = useState('')
  const [domain, setDomain] = useState('')
  const [primaryColor, setPrimaryColor] = useState(defaultPrimaryColor)
  const [secondaryColor, setSecondaryColor] = useState(defaultSecondaryColor)
  const [logoUrl, setLogoUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [customDomainEnabled, setCustomDomainEnabled] = useState(true)

  const currentBranding = useMemo(
    () => brandings.find((item) => item.tenantId === tenantId),
    [brandings, tenantId],
  )

  useEffect(() => {
    if (!currentBranding) {
      const tenantName = tenants.find((item) => item.id === tenantId)?.name ?? 'Portal'
      setPlatformName(tenantName)
      setDomain('')
      setPrimaryColor(defaultPrimaryColor)
      setSecondaryColor(defaultSecondaryColor)
      setLogoUrl('')
      setFaviconUrl('')
      return
    }

    setPlatformName(currentBranding.platformName)
    setDomain(currentBranding.domain)
    setPrimaryColor(currentBranding.primaryColor)
    setSecondaryColor(currentBranding.secondaryColor)
    setLogoUrl(currentBranding.logoUrl ?? '')
    setFaviconUrl(currentBranding.faviconUrl ?? '')
  }, [currentBranding, tenantId, tenants])

  useEffect(() => {
    if (!isSuperAdmin && userTenantId) {
      setTenantId(userTenantId)
    }
  }, [isSuperAdmin, userTenantId])

  const tenantSelectOptions = isSuperAdmin
    ? tenants
    : tenants.filter((tenant) => tenant.id === userTenantId)
  const searchableTenantOptions = useMemo(
    () => tenantSelectOptions.map((tenant) => ({ value: tenant.id, label: tenant.name })),
    [tenantSelectOptions],
  )

  const saveBranding = async () => {
    if (isReadOnly) {
      toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
      return
    }

    try {
      await upsertBranding({
        tenantId,
        platformName,
        primaryColor,
        secondaryColor,
        domain,
        logoUrl,
        faviconUrl,
      })
      toast.success('Configuracoes de branding salvas com sucesso.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o branding.')
    }
  }

  const resetColorsToDefault = () => {
    if (isReadOnly) {
      toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
      return
    }

    setPrimaryColor(defaultPrimaryColor)
    setSecondaryColor(defaultSecondaryColor)
    toast.success('Cores restauradas para o padrao original.')
  }

  return (
    <section className="animate-fade-in">
      <PageHeader
        title="White-label e branding"
        description="Personalize identidade visual por tenant com preview em tempo real."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={resetColorsToDefault} disabled={isReadOnly}>
              <RotateCcw className="h-4 w-4" />
              Restaurar cores padrao
            </Button>
            <Button className="gap-2" onClick={saveBranding} disabled={isReadOnly}>
              <Save className="h-4 w-4" />
              Salvar configuracoes
            </Button>
          </div>
        }
      />

      {isReadOnly ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Visualizacao simulada ativa. O branding pode ser consultado, mas alteracoes estao bloqueadas.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4 rounded-2xl border border-border/70 bg-white p-5 shadow-card">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Tenant</label>
              <div className="mt-1">
                <SearchableSelect
                  value={tenantId}
                  onValueChange={setTenantId}
                  options={searchableTenantOptions}
                  placeholder="Tenant"
                  searchPlaceholder="Pesquisar tenant"
                  disabled={!isSuperAdmin || isReadOnly}
                />
              </div>
              {!isSuperAdmin ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Conta vinculada ao tenant: {userTenantName}
                </p>
              ) : null}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Nome da plataforma</label>
              <Input className="mt-1" value={platformName} onChange={(event) => setPlatformName(event.target.value)} disabled={isReadOnly} />
              <p className="mt-1 text-xs text-muted-foreground">
                Nome exibido na sidebar para usuarios deste tenant.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Cor primaria</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  className="h-10 w-12 rounded-md border border-border bg-transparent"
                  disabled={isReadOnly}
                />
                <Input value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} disabled={isReadOnly} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Cor secundaria</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(event) => setSecondaryColor(event.target.value)}
                  className="h-10 w-12 rounded-md border border-border bg-transparent"
                  disabled={isReadOnly}
                />
                <Input value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} disabled={isReadOnly} />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Dominio personalizado</label>
            <Input
              className="mt-1"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              disabled={!customDomainEnabled || isReadOnly}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <Switch checked={customDomainEnabled} onCheckedChange={setCustomDomainEnabled} disabled={isReadOnly} />
              Habilitar dominio customizado para este tenant
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Upload de logo</label>
              <Input
                className="mt-1"
                type="file"
                accept="image/*"
                disabled={isReadOnly}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) setLogoUrl(URL.createObjectURL(file))
                }}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Upload de favicon</label>
              <Input
                className="mt-1"
                type="file"
                accept="image/*"
                disabled={isReadOnly}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) setFaviconUrl(URL.createObjectURL(file))
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-card">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            Preview em tempo real
          </p>
          <div className="overflow-hidden rounded-2xl border border-border/70">
            <div
              className="h-24 px-5 py-4"
              style={{
                background: `linear-gradient(120deg, ${primaryColor}18, ${secondaryColor}16)`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded-md object-cover" />
                  ) : (
                    <div
                      className="h-7 w-7 rounded-md"
                      style={{ backgroundColor: primaryColor }}
                    />
                  )}
                  <div>
                    <p className="font-display text-sm font-semibold text-slate-900">{platformName || 'Portal'}</p>
                    <p className="text-xs text-slate-600">{tenants.find((item) => item.id === tenantId)?.name}</p>
                  </div>
                </div>
                <Badge className="bg-white/70 text-slate-700" variant="neutral">
                  Preview
                </Badge>
              </div>
            </div>
            <div className="space-y-4 bg-slate-50/80 p-4">
              <div className="rounded-xl bg-white p-3 shadow-card">
                <p className="text-xs text-muted-foreground">Cor principal aplicada</p>
                <div className="mt-2 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
              </div>
              <div className="rounded-xl bg-white p-3 shadow-card">
                <p className="text-xs text-muted-foreground">Cor secundaria aplicada</p>
                <div className="mt-2 h-3 rounded-full" style={{ backgroundColor: secondaryColor }} />
              </div>
              <div className="rounded-xl bg-white p-3 shadow-card">
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5" />
                  Dominio configurado
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{domain || 'dominio-nao-definido'}</p>
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Image className="h-3.5 w-3.5" />
                  {faviconUrl ? 'Favicon carregado' : 'Favicon padrao'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

