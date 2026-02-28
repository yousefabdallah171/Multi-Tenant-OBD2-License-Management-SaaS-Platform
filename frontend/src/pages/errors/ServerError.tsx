import { Home, RotateCcw, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { ErrorPageShell } from '@/pages/errors/ErrorPageShell'
import { getDashboardPath, routePaths } from '@/router/routes'

export function ServerErrorPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const { user } = useAuth()
  const dashboardHref = user ? getDashboardPath(user.role, lang) : routePaths.login(lang)

  return (
    <ErrorPageShell
      code="500"
      icon={TriangleAlert}
      title={t('common.errorPages.serverError.title')}
      description={t('common.errorPages.serverError.description')}
      actions={
        <>
          <Button type="button" onClick={() => window.location.reload()}>
            <RotateCcw className="me-2 h-4 w-4" />
            {t('common.tryAgain')}
          </Button>
          <Button type="button" variant="outline" onClick={() => window.location.assign(dashboardHref)}>
            <Home className="me-2 h-4 w-4" />
            {t('common.goToDashboard')}
          </Button>
        </>
      }
    />
  )
}
