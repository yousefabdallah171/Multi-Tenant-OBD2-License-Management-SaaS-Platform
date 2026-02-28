import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { ErrorPageShell } from '@/pages/errors/ErrorPageShell'
import { getDashboardPath } from '@/router/routes'

export function AccessDeniedPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const { user } = useAuth()
  const dashboardHref = getDashboardPath(user?.role ?? 'super_admin', lang)

  return (
    <ErrorPageShell
      code="403"
      icon={LockKeyhole}
      title={t('common.errorPages.accessDenied.title')}
      description={t('common.errorPages.accessDenied.description')}
      actions={
        <>
          <Button type="button" onClick={() => window.location.assign(dashboardHref)}>
            {t('common.goToDashboard')}
          </Button>
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="me-2 h-4 w-4" />
            {t('common.goBack')}
          </Button>
        </>
      }
    />
  )
}
