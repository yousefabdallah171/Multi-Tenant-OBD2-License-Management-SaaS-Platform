import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { BlockBadge } from '@/components/shared/BlockBadge'

type LicenseStatus = ComponentProps<typeof StatusBadge>['status']

interface LicenseStatusBadgesProps {
  status: LicenseStatus
  isBlocked?: boolean
  isNew?: boolean
}

export function LicenseStatusBadges({ status, isBlocked = false, isNew = false }: LicenseStatusBadgesProps) {
  const { t, i18n } = useTranslation()

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <StatusBadge status={status} />
      {isNew ? (
        <span className="inline-flex items-center rounded-full border border-fuchsia-200 bg-fuchsia-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-700 shadow-sm dark:border-fuchsia-900/60 dark:bg-fuchsia-950/50 dark:text-fuchsia-300">
          {t('common.new', { defaultValue: i18n.language === 'ar' ? 'جديد' : 'New' })}
        </span>
      ) : null}
      {isBlocked ? <BlockBadge /> : null}
    </div>
  )
}
