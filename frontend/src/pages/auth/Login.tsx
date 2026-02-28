import { useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { isRequired, isValidEmail } from '@/lib/validators'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { lang, switchLanguage, isRtl } = useLanguage()
  const { login, getDefaultRoute } = useAuth()
  const [email, setEmail] = useState('admin@obd2sw.com')
  const [password, setPassword] = useState('password')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!isRequired(email) || !isValidEmail(email) || !isRequired(password)) {
      setError(t('auth.validation'))
      return
    }

    try {
      setIsSubmitting(true)
      const result = await login(email, password)
      toast.success(t('auth.loginSuccess'))
      navigate(getDefaultRoute(lang, result.user.role), { replace: true })
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        setError(t('auth.networkError'))
      } else if (axios.isAxiosError(error) && error.response?.status === 401) {
        setError(t('auth.invalidCredentials'))
      } else {
        setError(t('auth.serverError'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_35%),linear-gradient(180deg,_#f8fafc,_#e2e8f0)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_35%),linear-gradient(180deg,_#020617,_#0f172a)]">
      <div className={`w-full max-w-5xl ${isRtl ? 'text-right' : 'text-left'}`}>
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">{t('brand.badge')}</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{t('brand.title')}</h1>
          </div>
          <Button variant="secondary" type="button" onClick={switchLanguage}>
            {lang === 'ar' ? 'EN' : 'AR'}
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6 rounded-3xl border border-white/40 bg-white/60 p-8 backdrop-blur dark:border-slate-800 dark:bg-slate-900/50">
            <p className="max-w-xl text-base leading-8 text-slate-600 dark:text-slate-300">{t('auth.heroDescription')}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {['secure', 'roles', 'speed'].map((key) => (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{t(`auth.cards.${key}.title`)}</p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t(`auth.cards.${key}.description`)}</p>
                </div>
              ))}
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>{t('auth.loginTitle')}</CardTitle>
              <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input id="email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <Input id="password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </div>
                {error ? <p className="text-sm text-rose-500">{error}</p> : null}
                <Button className="w-full" disabled={isSubmitting} type="submit">
                  {isSubmitting ? t('auth.loading') : t('auth.submit')}
                </Button>
                <button
                  className="text-sm font-medium text-sky-600 transition hover:text-sky-500 dark:text-sky-400"
                  onClick={() => navigate(`/${lang}/forgot-password`)}
                  type="button"
                >
                  {t('auth.forgotPassword')}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
