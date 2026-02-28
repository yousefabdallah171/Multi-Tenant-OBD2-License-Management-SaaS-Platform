import { useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { authService } from '@/services/auth.service'
import { useLanguage } from '@/hooks/useLanguage'
import { isValidEmail } from '@/lib/validators'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const { isRtl } = useLanguage()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!isValidEmail(email)) {
      setError(t('auth.validation'))
      return
    }

    try {
      setIsSubmitting(true)
      const result = await authService.forgotPassword(email)
      toast.success(result.message)
      setEmail('')
    } catch (error) {
      if (axios.isAxiosError(error) && !error.response) {
        setError(t('auth.networkError'))
      } else {
        setError(t('auth.resetError'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 dark:bg-slate-950">
      <Card className={`w-full max-w-xl ${isRtl ? 'text-right' : 'text-left'}`}>
        <CardHeader>
          <CardTitle>{t('auth.forgotPassword')}</CardTitle>
          <CardDescription>{t('auth.resetSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="reset-email">{t('auth.email')}</Label>
              <Input id="reset-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            {error ? <p className="text-sm text-rose-500">{error}</p> : null}
            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? t('auth.loading') : t('auth.resetSubmit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
