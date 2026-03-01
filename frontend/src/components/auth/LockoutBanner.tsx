import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Ban } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface LockoutBannerProps {
  reason: 'account_locked' | 'ip_blocked'
  unlocksAt?: number | null
  secondsRemaining?: number | null
  onExpired?: () => void
}

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function LockoutBanner({ reason, unlocksAt, secondsRemaining, onExpired }: LockoutBannerProps) {
  const { t, i18n } = useTranslation()
  const [remaining, setRemaining] = useState<number>(Math.max(0, secondsRemaining ?? 0))
  const isRtl = i18n.dir() === 'rtl'

  useEffect(() => {
    setRemaining(Math.max(0, secondsRemaining ?? 0))
  }, [secondsRemaining])

  useEffect(() => {
    if (reason === 'ip_blocked' || remaining <= 0) {
      return
    }

    const timer = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [reason, remaining])

  useEffect(() => {
    if (!onExpired || reason === 'ip_blocked') {
      return
    }

    if ((secondsRemaining ?? 0) > 0 && remaining === 0) {
      onExpired()
    }
  }, [onExpired, reason, remaining, secondsRemaining])

  const unlockText = useMemo(() => {
    if (reason === 'ip_blocked') {
      return null
    }

    if (remaining > 0) {
      return formatCountdown(remaining)
    }

    if (unlocksAt) {
      return new Date(unlocksAt * 1000).toLocaleString()
    }

    return null
  }, [reason, remaining, unlocksAt])

  if (reason !== 'ip_blocked' && secondsRemaining == null) {
    return null
  }

  if (reason === 'ip_blocked') {
    return (
      <div className={`rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 ${isRtl ? 'text-right' : 'text-left'}`}>
        <div className="flex items-start gap-2">
          <Ban className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">{t('login.ipBlockedPermanent')}</p>
            <p>{t('login.ipBlockedMessage')}</p>
            <p>
              {t('login.contactSupport')}{' '}
              <a className="underline" href={`mailto:${t('login.supportEmail')}`}>{t('login.supportEmail')}</a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 ${isRtl ? 'text-right' : 'text-left'}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">{t('login.lockedTitle')}</p>
          <p>{t('login.lockedMessage')}</p>
          {unlockText ? <p className="font-semibold">{t('login.retryIn', { time: unlockText })}</p> : null}
        </div>
      </div>
    </div>
  )
}
