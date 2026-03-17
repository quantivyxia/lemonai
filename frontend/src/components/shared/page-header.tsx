import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export const PageHeader = ({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center"
    >
      <div>
        <h2 className="font-display text-[1.45rem] font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </motion.div>
  )
}
