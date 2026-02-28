import type { UserRole } from '@/types/user.types'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const roleStyles: Record<UserRole, string> = {
  super_admin: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  manager_parent: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  manager: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  reseller: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  customer: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export function RoleBadge({ role }: { role: UserRole }) {
  const { t } = useTranslation()

  return <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold', roleStyles[role])}>{t(`roles.${role}`)}</span>
}
