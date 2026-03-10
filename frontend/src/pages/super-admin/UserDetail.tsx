import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '@/components/shared/EmptyState'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { userService } from '@/services/user.service'

export function UserDetailPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const params = useParams()
  const id = Number(params.id)

  const detailQuery = useQuery({
    queryKey: ['super-admin', 'users', 'detail-page', id],
    queryFn: () => userService.getOne(id),
    enabled: Number.isFinite(id) && id > 0,
  })

  const user = detailQuery.data?.data

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{user?.name ?? t('superAdmin.pages.users.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{user?.email ?? t('superAdmin.pages.users.description')}</p>
      </div>

      {user ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label={t('common.username')} value={user.username ?? '-'} />
            <MetricCard label={t('managerParent.pages.teamManagement.customers')} value={user.customers_count} />
            <MetricCard label={t('managerParent.pages.teamManagement.activeLicenses')} value={user.active_licenses_count} />
            <MetricCard label={t('common.revenue')} value={new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(user.revenue)} />
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label={t('common.role')} value={<RoleBadge role={user.role} />} />
            <MetricCard label={t('common.status')} value={<StatusBadge status={user.status} />} />
            <MetricCard label={t('common.tenant')} value={user.tenant?.name ?? '-'} />
            <MetricCard label={t('superAdmin.pages.usernameManagement.locked')} value={<StatusBadge status={user.username_locked ? 'suspended' : 'active'} />} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('manager.pages.team.recentLicenses')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {user.recent_licenses.length === 0 ? (
                <EmptyState title={t('common.noData')} description={t('common.adjustFilters')} />
              ) : (
                user.recent_licenses.map((license) => (
                  <div key={license.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-medium text-slate-950 dark:text-white">{license.customer?.name ?? '-'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{license.customer?.email ?? '-'}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{license.program ?? t('manager.pages.customers.unknownProgram')}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('activate.biosId')}{' '}
                      <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.biosDetail(lang, license.bios_id)}>
                        {license.bios_id}
                      </Link>
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('superAdmin.pages.dashboard.recentActivity')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {user.recent_activity.length === 0 ? (
                <EmptyState title={t('common.noData')} description={t('superAdmin.pages.dashboard.noActivity')} />
              ) : (
                user.recent_activity.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-medium text-slate-950 dark:text-white">{entry.action}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{entry.description ?? '-'}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-2 font-semibold text-slate-950 dark:text-white">{value}</div>
      </CardContent>
    </Card>
  )
}
