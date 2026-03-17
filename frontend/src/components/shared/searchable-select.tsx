import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type SearchableSelectOption = {
  value: string
  label: string
  keywords?: string
}

type SearchableSelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  triggerClassName?: string
  contentClassName?: string
  disabled?: boolean
}

export const SearchableSelect = ({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder = 'Pesquisar...',
  emptyMessage = 'Nenhuma opcao encontrada.',
  triggerClassName,
  contentClassName,
  disabled = false,
}: SearchableSelectProps) => {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setSearchTerm('')
      return
    }
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  const filteredOptions = useMemo(() => {
    const uniqueOptions = options.filter(
      (option, index, array) => array.findIndex((current) => current.value === option.value) === index,
    )
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return uniqueOptions

    return uniqueOptions.filter((option) => {
      const blob = `${option.label} ${option.keywords ?? ''}`.toLowerCase()
      return blob.includes(normalizedSearch)
    })
  }, [options, searchTerm])

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        onValueChange(nextValue)
        setOpen(false)
      }}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
    >
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={cn('p-0', contentClassName)}>
        <div
          className="border-b border-border/70 bg-popover px-2 py-2"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={searchTerm}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 text-sm"
              onChange={(event) => setSearchTerm(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))
          ) : (
            <p className="px-2 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
          )}
        </div>
      </SelectContent>
    </Select>
  )
}
