import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

type StatCardProps = {
  label: string
  value: string
  trend: string
  icon: LucideIcon
}

export const StatCard = ({ label, value, trend, icon: Icon }: StatCardProps) => {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 280, damping: 22 }}>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className="mt-3 font-display text-2xl font-semibold text-slate-900">{value}</p>
              <p className="mt-2 text-xs font-medium text-emerald-600">{trend}</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
