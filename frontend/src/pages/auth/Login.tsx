import { useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { Download, Eye, EyeOff, LoaderCircle, Moon, Sun, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SkipToContent } from '@/components/shared/SkipToContent'
import { LockoutBanner } from '@/components/auth/LockoutBanner'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { useTheme } from '@/hooks/useTheme'
import { clearAccountDisabledState, extractAccountDisabledState, storeAccountDisabledState } from '@/lib/account-disabled'
import { isRequired, isValidEmail } from '@/lib/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { routePaths } from '@/router/routes'

interface LockState {
  reason: 'account_locked' | 'ip_blocked'
  unlocks_at?: number | null
  seconds_remaining?: number | null
}

type NoticeTone = 'danger' | 'warning'

export function LoginPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { lang, switchLanguage, isRtl } = useLanguage()
  const { toggleTheme, isDark } = useTheme()
  const { canInstall, promptInstall } = usePwaInstall()
  const { login, getDefaultRoute } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null)
  const [lockState, setLockState] = useState<LockState | null>(null)
  const isLocked = lockState !== null

  function clearFeedback() {
    setNotice(null)
    setLockState(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()

    if (!isRequired(email) || !isValidEmail(email) || !isRequired(password)) {
      setNotice({ tone: 'danger', message: t('auth.validation') })
      return
    }

    try {
      setIsSubmitting(true)
      const result = await login(email, password, rememberMe)
      clearAccountDisabledState()
      navigate(getDefaultRoute(lang, result.user.role), { replace: true })
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const payload = error.response?.data as { reason?: unknown; message?: string; unlocks_at?: number | null; seconds_remaining?: number | null } | undefined
        const accountDisabledState = extractAccountDisabledState(payload)

        if (accountDisabledState) {
          storeAccountDisabledState(accountDisabledState)
          navigate(routePaths.errors.accountDisabled(lang), { replace: true })
          return
        }

        if (!error.response) {
          setNotice({ tone: 'warning', message: t('login.networkError') })
        } else if (error.response.status === 429) {
          if (payload?.reason === 'account_locked' || payload?.reason === 'ip_blocked') {
            setLockState({
              reason: payload.reason as LockState['reason'],
              unlocks_at: payload.unlocks_at ?? null,
              seconds_remaining: payload.seconds_remaining ?? null,
            })
          } else {
            setNotice({ tone: 'danger', message: payload?.message ?? t('auth.serverError') })
          }
        } else if (error.response.status === 401) {
          const payload = error.response.data as { message?: string } | undefined
          setNotice({ tone: 'danger', message: payload?.message ?? t('auth.invalidCredentials') })
        } else {
          const payload = error.response.data as { message?: string } | undefined
          setNotice({ tone: 'danger', message: payload?.message ?? t('auth.serverError') })
        }
      } else {
        setNotice({ tone: 'danger', message: t('auth.serverError') })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <SkipToContent targetId="auth-main-content" />
      <main
        id="auth-main-content"
        tabIndex={-1}
        className="flex min-h-screen focus:outline-none"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Brand panel — hidden on mobile, visible md+ */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 p-12 dark:bg-brand-900 md:flex md:w-[42%] lg:w-[45%]">
          {/* Subtle geometric accent — top-end corner block */}
          <div className="absolute end-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/40 dark:bg-brand-800/60" aria-hidden="true" />
          <div className="absolute bottom-0 start-0 h-48 w-48 -translate-x-1/2 translate-y-1/2 rounded-full bg-brand-600/30 dark:bg-brand-800/50" aria-hidden="true" />

          {/* Top: wordmark */}
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-200">{t('brand.badge')}</p>
          </div>

          {/* Center: headline */}
          <div className="relative z-10 space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white lg:text-5xl">
              {t('brand.title')}
            </h1>
            <p className="max-w-xs text-base leading-relaxed text-brand-200">
              {t('login.subtitle')}
            </p>
          </div>

          {/* Bottom: footer */}
          <p className="relative z-10 text-xs text-brand-300">{t('login.footer')}</p>
        </div>

        {/* Form panel */}
        <div className="flex flex-1 flex-col bg-white dark:bg-slate-950">
          {/* Top utility bar */}
          <div className="flex items-center justify-end gap-2 p-4">
            {canInstall ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void promptInstall()}
                aria-label={t('common.installApp')}
              >
                <Download className="me-1.5 h-4 w-4" />
                {t('common.installApp')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              aria-label={t('common.toggleTheme')}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="ms-2 hidden sm:inline">{isDark ? t('common.lightMode') : t('common.darkMode')}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={switchLanguage}
            >
              {lang === 'ar' ? 'EN' : 'AR'}
            </Button>
          </div>

          {/* Centered form */}
          <div className="flex flex-1 items-center justify-center px-6 py-8">
            <div className="w-full max-w-[400px] space-y-8">
              {/* Mobile-only brand badge */}
              <div className="md:hidden">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-400">{t('brand.badge')}</p>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{t('login.title')}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('login.subtitle')}</p>
              </div>

              {lockState ? (
                <LockoutBanner
                  reason={lockState.reason}
                  unlocksAt={lockState.unlocks_at}
                  secondsRemaining={lockState.seconds_remaining}
                  onExpired={() => setLockState(null)}
                />
              ) : null}

              {notice ? (
                <div
                  className={`rounded-xl border p-3 text-sm ${
                    notice.tone === 'warning'
                      ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                      : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
                  }`}
                  role="alert"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p>{notice.message}</p>
                    <button type="button" className="opacity-70 hover:opacity-100" onClick={() => setNotice(null)} aria-label={t('common.closeDialog')}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t('login.emailLabel')}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('login.emailPlaceholder', { defaultValue: 'Enter your email' })}
                    value={email}
                    disabled={isSubmitting || isLocked}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      clearFeedback()
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t('login.passwordLabel')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder={t('login.passwordPlaceholder', { defaultValue: 'Enter your password' })}
                      value={password}
                      disabled={isSubmitting || isLocked}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        clearFeedback()
                      }}
                      className="pe-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      disabled={isSubmitting || isLocked}
                      className="absolute end-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-slate-500"
                      aria-label={showPassword ? t('common.hide') : t('common.show')}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    disabled={isSubmitting || isLocked}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <span>{t('login.rememberMe')}</span>
                </label>
                <Button className="h-11 w-full" disabled={isSubmitting || isLocked} type="submit">
                  {isSubmitting ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? t('login.signingIn') : t('login.submitBtn')}
                </Button>
              </form>

              {/* Mobile footer */}
              <p className="text-center text-xs text-slate-400 dark:text-slate-500 md:hidden">{t('login.footer')}</p>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
