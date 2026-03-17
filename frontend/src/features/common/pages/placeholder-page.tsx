import { Construction } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'

export const PlaceholderPage = ({
  title,
  description,
}: {
  title: string
  description: string
}) => {
  return (
    <div className="animate-fade-in">
      <EmptyState title={title} description={description} icon={Construction} />
    </div>
  )
}
