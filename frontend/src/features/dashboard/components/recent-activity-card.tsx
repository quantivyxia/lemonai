import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'
import type { ActivityItem } from '@/types/entities'

export const RecentActivityCard = ({ items }: { items?: ActivityItem[] }) => {
  const data = items ?? []

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Atividades recentes</CardTitle>
        <CardDescription>Ultimos eventos relevantes do portal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.map((item) => (
          <div key={item.id} className="rounded-xl border border-border/70 bg-muted/25 p-3">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.timestamp)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
