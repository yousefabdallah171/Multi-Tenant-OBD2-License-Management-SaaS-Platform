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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
        className="relative flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_48%),linear-gradient(180deg,_#f8fafc,_#e2e8f0)] px-4 py-8 focus:outline-none dark:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_45%),linear-gradient(180deg,_#0f172a,_#020617)]"
      >
        <Button
          type="button"
          variant="outline"
          className="absolute left-4 top-4 z-10"
          onClick={toggleTheme}
          aria-label={t('common.toggleTheme')}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="ms-2">{isDark ? t('common.lightMode') : t('common.darkMode')}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          className="absolute right-4 top-4 z-10"
          onClick={switchLanguage}
        >
          {lang === 'ar' ? 'EN' : 'AR'}
        </Button>

        {canInstall ? (
          <Button
            type="button"
            variant="outline"
            className="absolute top-4 z-10"
            style={isRtl ? { left: '5.5rem' } : { right: '5.5rem' }}
            onClick={() => void promptInstall()}
            aria-label={lang === 'ar' ? 'تثبيت التطبيق' : 'Install app'}
          >
            <Download className="h-4 w-4" />
          </Button>
        ) : null}

        <div className="w-full max-w-[440px] text-start" dir={isRtl ? 'rtl' : 'ltr'}>
          <Card className={`rounded-none border-white/20 bg-white/95 shadow-2xl sm:rounded-3xl dark:border-slate-800/80 dark:bg-slate-950/90`}>
            <CardHeader className="space-y-4 px-8 pt-8 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">{t('brand.badge')}</p>
              <div className="space-y-1">
                <CardTitle className="text-2xl font-bold">{t('login.title')}</CardTitle>
                <CardDescription>{t('login.subtitle')}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-8 pb-8">
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
                  className={`rounded-2xl border p-3 text-sm ${
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

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
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
                <div className="space-y-2">
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
                      className={isRtl ? 'ps-12' : 'pe-12'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      disabled={isSubmitting || isLocked}
                      className={`absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-slate-500 ${isRtl ? 'left-1' : 'right-1'}`}
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
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <span>{lang === 'ar' ? 'البقاء مسجل الدخول' : 'Keep me signed in'}</span>
                </label>
                <Button className="h-11 w-full" disabled={isSubmitting || isLocked} type="submit">
                  {isSubmitting ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? t('login.signingIn') : t('login.submitBtn')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">{t('login.footer')}</p>
        </div>
      </main>
    </>
  )
}
