import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { accessSeries } from '@/mocks/analytics'
import type { AccessSeriesPoint } from '@/types/entities'

export const AccessChartCard = ({ data }: { data?: AccessSeriesPoint[] }) => {
  const chartData = data ?? accessSeries

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Acessos nos ultimos 7 dias</CardTitle>
        <CardDescription>Volume consolidado por ambiente multi-tenant</CardDescription>
      </CardHeader>
      <CardContent className="h-[300px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="accessGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.36} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                borderColor: '#e2e8f0',
                boxShadow: '0 14px 28px rgba(15, 23, 42, 0.08)',
              }}
            />
            <Area type="monotone" dataKey="accesses" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#accessGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
