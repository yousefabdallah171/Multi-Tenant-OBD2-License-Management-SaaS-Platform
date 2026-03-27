import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/user.types'

interface RoleIdentityProps {
  name: string | null | undefined
  role?: UserRole | null
  href?: string
  onClick?: () => void
  secondary?: ReactNode
  className?: string
  nameClassName?: string
}

export function RoleIdentity({ name, role, href, onClick, secondary, className, nameClassName }: RoleIdentityProps) {
  const label = name ?? '-'
  const nameNode = href
    ? (
        <Link className={cn('font-medium text-sky-600 hover:underline dark:text-sky-300', nameClassName)} to={href}>
          {label}
        </Link>
      )
    : onClick
      ? (
          <button type="button" className={cn('text-start font-medium text-sky-600 hover:underline dark:text-sky-300', nameClassName)} onClick={onClick}>
            {label}
          </button>
        )
      : <span className={cn('font-medium', nameClassName)}>{label}</span>

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {nameNode}
        {role ? <RoleBadge role={role} /> : null}
      </div>
      {secondary ? <div className="text-sm text-slate-500 dark:text-slate-400">{secondary}</div> : null}
    </div>
  )
}
