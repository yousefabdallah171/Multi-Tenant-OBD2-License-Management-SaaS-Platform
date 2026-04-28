import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { useTheme } from '@/hooks/useTheme'
import { formatCurrency } from '@/lib/utils'
import { getDashboardStats } from '@/services/api'
import type { UserRole } from '@/types/user.types'

export function RoleDashboard({ role }: { role: UserRole }) {
  const { t } = useTranslation()
  const { lang, switchLanguage } = useLanguage()
  const { logout, user } = useAuth()
  const { toggleTheme, isDark } = useTheme()
  const { data } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    retry: 0,
  })

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto max-w-6xl space-y-6 text-start">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-brand-600 dark:text-brand-400">{t('dashboard.roleLabel')}</p>
            <h1 className="text-3xl font-bold tracking-tight">{t(`roles.${role}`)}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={switchLanguage} type="button" variant="secondary">
              {lang === 'ar' ? 'EN' : 'AR'}
            </Button>
            <Button onClick={toggleTheme} type="button" variant="secondary">
              {isDark ? t('dashboard.lightMode') : t('dashboard.darkMode')}
            </Button>
            <Button onClick={() => void logout()} type="button">
              {t('auth.logout')}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label={t('dashboard.stats.users')} value={String(data?.stats.users ?? 0)} />
          <StatCard label={t('dashboard.stats.programs')} value={String(data?.stats.programs ?? 0)} />
          <StatCard label={t('dashboard.stats.licenses')} value={String(data?.stats.licenses ?? 0)} />
          <StatCard label={t('dashboard.stats.activeLicenses')} value={String(data?.stats.active_licenses ?? 0)} />
          <StatCard label={t('dashboard.stats.revenue')} value={formatCurrency(data?.stats.revenue ?? 0)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.foundationTitle')}</CardTitle>
            <CardDescription>{t('dashboard.foundationDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>{t('dashboard.foundationCopy')}</p>
            <p>{t('dashboard.nextSteps')}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}
