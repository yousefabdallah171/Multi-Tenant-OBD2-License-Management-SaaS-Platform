import type { UserRole } from '@/types/user.types'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const roleStyles: Record<UserRole, string> = {
  super_admin: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  manager_parent: 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300',
  manager: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  reseller: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  customer: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400',
}

export function RoleBadge({ role }: { role: UserRole }) {
  const { t } = useTranslation()

  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide', roleStyles[role])}>
      {t(`roles.${role}`)}
    </span>
  )
}
