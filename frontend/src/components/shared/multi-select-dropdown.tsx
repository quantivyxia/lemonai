import { ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type MultiSelectDropdownOption = {
  value: string
  label: string
  keywords?: string
}

type MultiSelectDropdownProps = {
  values: string[]
  onChange: (values: string[]) => void
  options: MultiSelectDropdownOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  triggerClassName?: string
  contentClassName?: string
  disabled?: boolean
  maxVisibleLabels?: number
  showClearAction?: boolean
}

export const MultiSelectDropdown = ({
  values,
  onChange,
  options,
  placeholder = 'Selecione opcoes',
  searchPlaceholder = 'Pesquisar...',
  emptyMessage = 'Nenhuma opcao encontrada.',
  triggerClassName,
  contentClassName,
  disabled = false,
  maxVisibleLabels = 2,
  showClearAction = true,
}: MultiSelectDropdownProps) => {
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

  const uniqueOptions = useMemo(
    () => options.filter((option, index, array) => array.findIndex((item) => item.value === option.value) === index),
    [options],
  )

  const optionByValue = useMemo(() => new Map(uniqueOptions.map((option) => [option.value, option])), [uniqueOptions])

  const filteredOptions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return uniqueOptions

    return uniqueOptions.filter((option) => {
      const searchableText = `${option.label} ${option.keywords ?? ''}`.toLowerCase()
      return searchableText.includes(normalizedSearch)
    })
  }, [searchTerm, uniqueOptions])

  const selectedLabels = values
    .map((value) => optionByValue.get(value)?.label)
    .filter((label): label is string => Boolean(label))

  const triggerLabel =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= maxVisibleLabels
        ? selectedLabels.join(', ')
        : `${selectedLabels.length} selecionados`

  const toggleValue = (value: string) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-11 w-full justify-between gap-2 rounded-xl border-border/70 text-left font-normal hover:bg-background',
            triggerClassName,
          )}
          disabled={disabled}
        >
          <span className={cn('truncate', selectedLabels.length === 0 && 'text-muted-foreground')}>{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn('w-[var(--radix-dropdown-menu-trigger-width)] min-w-[220px] p-0', contentClassName)}>
        <div
          className="border-b border-border/70 bg-white px-2 py-2"
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
        <div className="max-h-56 overflow-y-auto p-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={values.includes(option.value)}
                onCheckedChange={() => toggleValue(option.value)}
                onSelect={(event) => event.preventDefault()}
                className="rounded-md"
              >
                <span className="truncate">{option.label}</span>
              </DropdownMenuCheckboxItem>
            ))
          ) : (
            <p className="px-2 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
          )}
        </div>
        {showClearAction && values.length > 0 ? (
          <div className="border-t border-border/70 px-1 py-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={() => onChange([])}
            >
              <X className="h-3.5 w-3.5" />
              Limpar selecao
            </Button>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
