import { ArrowUpRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type TopDashboardItem = {
  id: string
  name: string
  views: number
}

export const TopDashboardsCard = ({ items }: { items?: TopDashboardItem[] }) => {
  const data = items ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboards mais visualizados</CardTitle>
        <CardDescription>Ranking de consumo na semana</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {data.length > 0 ? (
          data.map((dashboard, index) => (
            <div key={dashboard.id} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {index + 1}. {dashboard.name}
                </p>
                <p className="text-xs text-muted-foreground">{dashboard.views} visualizacoes</p>
              </div>
              <Badge variant="neutral" className="gap-1">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {Math.round(dashboard.views / 10)}%
              </Badge>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhum dashboard disponivel neste tenant.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
