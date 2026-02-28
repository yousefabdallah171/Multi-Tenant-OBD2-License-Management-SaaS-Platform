import { Compass, Home, LogIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { ErrorPageShell } from '@/pages/errors/ErrorPageShell'
import { getDashboardPath, routePaths } from '@/router/routes'

export function NotFoundPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const { user } = useAuth()
  const primaryHref = user ? getDashboardPath(user.role, lang) : routePaths.login(lang)

  return (
    <ErrorPageShell
      code="404"
      icon={Compass}
      title={t('common.errorPages.notFound.title')}
      description={t('common.errorPages.notFound.description')}
      actions={
        <>
          <Button type="button" onClick={() => window.location.assign(primaryHref)}>
            <Home className="me-2 h-4 w-4" />
            {t('common.goToDashboard')}
          </Button>
          {!user ? (
            <Button type="button" variant="outline" onClick={() => window.location.assign(routePaths.login(lang))}>
              <LogIn className="me-2 h-4 w-4" />
              {t('common.signIn')}
            </Button>
          ) : null}
        </>
      }
    />
  )
}
