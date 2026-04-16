import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import type { ImpersonationState } from '@/lib/impersonation'
import { clearImpersonationState, setImpersonationState } from '@/lib/impersonation'
import { getDashboardPath } from '@/router/routes'
import { superAdminPlatformService } from '@/services/super-admin-platform.service'

const senderMessageType = 'super-admin-impersonation-launch'

export function ImpersonationLaunchPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const { setAuthenticatedUser } = useAuth()
  const [status, setStatus] = useState<'waiting' | 'processing' | 'failed'>('waiting')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const expectedOrigin = useMemo(() => (typeof window === 'undefined' ? '' : window.location.origin), [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    clearImpersonationState()

    let handled = false

    const onMessage = (event: MessageEvent) => {
      if (handled) {
        return
      }

      if (event.origin !== expectedOrigin) {
        return
      }

      const data = event.data as { type?: string; token?: string } | null
      if (!data || data.type !== senderMessageType || !data.token) {
        return
      }
      const launchToken = data.token

      handled = true
      setStatus('processing')

      void (async () => {
        try {
          const response = await superAdminPlatformService.exchangeImpersonation(launchToken)
          const nextState: ImpersonationState = {
            active: true,
            token: response.data.token,
            actor: response.data.impersonation.actor,
            target: response.data.impersonation.target,
            started_at: response.data.impersonation.started_at,
            expires_at: response.data.impersonation.expires_at,
          }
          setImpersonationState(nextState)
          setAuthenticatedUser(response.data.user)
          navigate(getDashboardPath(response.data.user.role, lang), { replace: true })
        } catch (error) {
          const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
          setErrorMessage(message ?? t('common.error'))
          setStatus('failed')
          toast.error(message ?? t('common.error'))
        }
      })()
    }

    window.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('message', onMessage)
    }
  }, [expectedOrigin, lang, navigate, setAuthenticatedUser, t])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {status === 'waiting' ? (
          <>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('superAdmin.pages.impersonation.launchWaitingTitle')}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.impersonation.launchWaitingDescription')}</p>
          </>
        ) : null}
        {status === 'processing' ? (
          <>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('superAdmin.pages.impersonation.launchProcessingTitle')}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.impersonation.launchProcessingDescription')}</p>
          </>
        ) : null}
        {status === 'failed' ? (
          <>
            <h2 className="text-xl font-semibold text-rose-700 dark:text-rose-300">{t('superAdmin.pages.impersonation.launchFailedTitle')}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{errorMessage || t('superAdmin.pages.impersonation.launchFailedDescription')}</p>
          </>
        ) : null}
      </div>
    </div>
  )
}
