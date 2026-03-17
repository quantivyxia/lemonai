import { Bell, Globe2, Lock, Save, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/use-auth'
import { usePlatformStore } from '@/hooks/use-platform-store'
import type { PlatformSettings } from '@/types/entities'

export const PlatformSettingsPage = () => {
  const { isViewAsMode } = useAuth()
  const { settings, setPlatformSettings } = usePlatformStore()
  const [form, setForm] = useState<PlatformSettings>(settings)
  const isReadOnly = isViewAsMode

  useEffect(() => {
    setForm(settings)
  }, [settings])

  const saveSettings = () => {
    if (isReadOnly) {
      toast.error('Modo "Ver tela do usuario" permite apenas visualizacao.')
      return
    }

    setPlatformSettings(form)
    toast.success('Configuracoes gerais salvas no frontend.')
  }

  return (
    <section className="animate-fade-in">
      <PageHeader
        title="Configuracoes gerais"
        description="Preferencias de idioma, notificacoes e seguranca da plataforma."
        actions={
          <Button className="gap-2" onClick={saveSettings} disabled={isReadOnly}>
            <Save className="h-4 w-4" />
            Salvar configuracoes
          </Button>
        }
      />

      {isReadOnly ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Visualizacao simulada ativa. As preferencias podem ser consultadas, mas alteracoes estao bloqueadas.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-primary" />
              Preferencias da plataforma
            </CardTitle>
            <CardDescription>Idioma e politicas globais de operacao.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Idioma padrao</label>
              <Select
                value={form.language}
                onValueChange={(value) => setForm((current) => ({ ...current, language: value as PlatformSettings['language'] }))}
                disabled={isReadOnly}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Portugues (Brasil)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="es-ES">Espanol</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Tempo de sessao</label>
              <Select
                value={`${form.sessionTimeoutMinutes}`}
                onValueChange={(value) => setForm((current) => ({ ...current, sessionTimeoutMinutes: Number(value) as PlatformSettings['sessionTimeoutMinutes'] }))}
                disabled={isReadOnly}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">60 minutos</SelectItem>
                  <SelectItem value="120">120 minutos</SelectItem>
                  <SelectItem value="240">240 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm">
              Permitir exportacao de dados
              <Switch
                checked={form.allowExport}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, allowExport: checked }))}
                disabled={isReadOnly}
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notificacoes
            </CardTitle>
            <CardDescription>Defina os canais de alerta e atualizacao.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm">
              Notificar por e-mail
              <Switch
                checked={form.notifyByEmail}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, notifyByEmail: checked }))}
                disabled={isReadOnly}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm">
              Notificacao in-app
              <Switch
                checked={form.notifyInApp}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, notifyInApp: checked }))}
                disabled={isReadOnly}
              />
            </label>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Seguranca
            </CardTitle>
            <CardDescription>Diretrizes de autenticacao e controle de sessao.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm">
              MFA obrigatorio
              <Switch
                checked={form.mfaRequired}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, mfaRequired: checked }))}
                disabled={isReadOnly}
              />
            </label>
            <div className="rounded-lg border border-border/70 px-3 py-2 text-sm text-muted-foreground">
              <Lock className="mr-2 inline h-4 w-4" />
              Sessao atual expira em {form.sessionTimeoutMinutes} minutos.
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

