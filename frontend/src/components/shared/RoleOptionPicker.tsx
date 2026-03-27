import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/user.types'

export interface RoleOptionPickerOption {
  id: number
  name: string
  role?: UserRole | null
  secondary?: string | null
}

interface RoleOptionPickerProps {
  value: number | ''
  onChange: (value: number | '') => void
  options: RoleOptionPickerOption[]
  placeholder: string
  emptyLabel?: string
  disabled?: boolean
  className?: string
}

export function RoleOptionPicker({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  disabled = false,
  className,
}: RoleOptionPickerProps) {
  const selected = value === '' ? null : options.find((option) => option.id === value) ?? null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          className={cn('h-11 w-full justify-between rounded-xl border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950', className)}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {selected ? (
              <>
                <span className="truncate">{selected.name}</span>
                {selected.role ? <RoleBadge role={selected.role} /> : null}
              </>
            ) : (
              <span className="truncate text-slate-500 dark:text-slate-400">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="ms-2 h-4 w-4 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
        {emptyLabel ? (
          <DropdownMenuItem onSelect={() => onChange('')}>
            <span className="text-slate-500 dark:text-slate-400">{emptyLabel}</span>
          </DropdownMenuItem>
        ) : null}
        {options.map((option) => (
          <DropdownMenuItem key={option.id} onSelect={() => onChange(option.id)}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate">{option.name}</span>
                {option.role ? <RoleBadge role={option.role} /> : null}
              </div>
              {option.secondary ? <div className="text-xs text-slate-500 dark:text-slate-400">{option.secondary}</div> : null}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
