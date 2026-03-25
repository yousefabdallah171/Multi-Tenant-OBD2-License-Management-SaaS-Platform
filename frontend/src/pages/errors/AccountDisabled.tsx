import { ShieldX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { clearAccountDisabledState, readAccountDisabledState } from '@/lib/account-disabled'
import { useLanguage } from '@/hooks/useLanguage'
import { ErrorPageShell } from '@/pages/errors/ErrorPageShell'
import { routePaths } from '@/router/routes'

export function AccountDisabledPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const state = readAccountDisabledState()
  const reason = state?.reason ?? 'account_inactive'

  function goToLogin() {
    clearAccountDisabledState()
    window.location.assign(routePaths.login(lang))
  }

  const descriptionKey = `common.errorPages.accountDisabled.reasons.${reason}`

  return (
    <ErrorPageShell
      code="403"
      icon={ShieldX}
      title={t('common.errorPages.accountDisabled.title')}
      description={t(descriptionKey, {
        defaultValue: state?.message ?? t('common.errorPages.accountDisabled.reasons.account_inactive'),
      })}
      actions={
        <Button type="button" onClick={goToLogin}>
          {t('common.signIn')}
        </Button>
      }
    />
  )
}
