import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useResolvedTimezone } from '@/hooks/useResolvedTimezone'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { COMMON_TIMEZONES } from '@/lib/timezones'
import { profileService } from '@/services/profile.service'

interface ProfileWorkspaceProps {
  eyebrow: string
  description: string
  translationPrefix: string
}

export function ProfileWorkspace({ eyebrow, description, translationPrefix }: ProfileWorkspaceProps) {
  const { t } = useTranslation()
  const { user, setAuthenticatedUser } = useAuth()
  const { timezone: resolvedTimezone } = useResolvedTimezone(user?.timezone)
  const initialProfileForm = useMemo(
    () => ({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      timezone: user?.timezone ?? resolvedTimezone,
      branding: {
        primary_color: user?.branding?.primary_color ?? '#0284c7',
      },
    }),
    [resolvedTimezone, user?.email, user?.name, user?.phone, user?.timezone, user?.branding?.primary_color],
  )
  const [profileForm, setProfileForm] = useState(initialProfileForm)
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [isProfileDirty, setIsProfileDirty] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const profileMutation = useMutation({
    mutationFn: () => profileService.updateProfile(profileForm),
    onSuccess: (data) => {
      setAuthenticatedUser(data.user)
      setProfileForm({
        name: data.user.name ?? '',
        email: data.user.email ?? '',
        phone: data.user.phone ?? '',
        timezone: data.user.timezone ?? resolvedTimezone,
        branding: {
          primary_color: data.user.branding?.primary_color ?? '#0284c7',
        },
      })
      setIsProfileDirty(false)
      toast.success(t(`${translationPrefix}.profileSaved`))
    },
  })

  const passwordMutation = useMutation({
    mutationFn: () => profileService.updatePassword(passwordForm),
    onSuccess: () => {
      toast.success(t(`${translationPrefix}.passwordSaved`))
      setPasswordForm({ current_password: '', password: '', password_confirmation: '' })
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
    },
  })

  useEffect(() => {
    if (!isProfileDirty) {
      setProfileForm(initialProfileForm)
    }
  }, [initialProfileForm, isProfileDirty])

  function updateProfileField<K extends keyof typeof profileForm>(key: K, value: (typeof profileForm)[K]) {
    setIsProfileDirty(true)
    setProfileForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={t(`${translationPrefix}.title`)} description={description} />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader className="border-b border-sky-100 bg-gradient-to-r from-sky-100 via-cyan-50 to-blue-100 py-4 dark:border-sky-900/40 dark:from-sky-950/40 dark:via-slate-900 dark:to-sky-950/30">
            <CardTitle>{t(`${translationPrefix}.accountCard`)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 text-2xl font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
              {user?.name?.slice(0, 1)}
            </div>
            <div className="space-y-1">
              <div className="text-xl font-semibold">{user?.name}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</div>
            </div>
            {user ? <RoleBadge role={user.role} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(`${translationPrefix}.editProfile`)}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name" className="inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                  <UserRound className="h-3.5 w-3.5" />
                </span>
                {t('common.name')}
              </Label>
              <Input id="profile-name" value={profileForm.name} onChange={(event) => updateProfileField('name', event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email" className="inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Mail className="h-3.5 w-3.5" />
                </span>
                {t('common.email')}
              </Label>
              <Input id="profile-email" type="email" value={profileForm.email} onChange={(event) => updateProfileField('email', event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone" className="inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <Phone className="h-3.5 w-3.5" />
                </span>
                {t('common.phone')}
              </Label>
              <Input id="profile-phone" value={profileForm.phone ?? ''} onChange={(event) => updateProfileField('phone', event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-timezone">{t('common.timezone', { defaultValue: 'Timezone' })}</Label>
              <select
                id="profile-timezone"
                value={profileForm.timezone ?? 'UTC'}
                onChange={(event) => updateProfileField('timezone', event.target.value)}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {COMMON_TIMEZONES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('common.timezoneHint', { defaultValue: 'Used for date display and schedule defaults.' })}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-color">{t('common.personalColor', { defaultValue: 'Personal Dashboard Color' })}</Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('common.personalColorHint', { defaultValue: 'Customize your dashboard theme color. Leave empty to use role default.' })}
              </p>
              <div className="flex items-center gap-2">
                <input
                  id="profile-color"
                  type="color"
                  value={profileForm.branding.primary_color}
                  onChange={(event) => updateProfileField('branding', { primary_color: event.target.value })}
                  className="h-10 w-16 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700"
                />
                <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{profileForm.branding.primary_color}</span>
              </div>
            </div>
            <Button type="button" onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
              {profileMutation.isPending ? t('common.saving') : t(`${translationPrefix}.saveProfile`)}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-200 bg-gradient-to-br from-amber-50/70 to-orange-100/40 dark:border-amber-900/40 dark:from-amber-950/10 dark:to-orange-950/10">
        <CardHeader className="border-b border-amber-200/70 dark:border-amber-900/40">
          <CardTitle className="inline-flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <LockKeyhole className="h-4 w-4" />
            </span>
            {t(`${translationPrefix}.changePassword`)}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t(`${translationPrefix}.currentPassword`)}</Label>
            <div className="relative">
              <Input id="current-password" type={showCurrentPassword ? 'text' : 'password'} value={passwordForm.current_password} onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))} className="pe-12" />
              <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-11 w-11 -translate-y-1/2 px-0" onClick={() => setShowCurrentPassword((current) => !current)}>
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showCurrentPassword ? t('common.hide') : t('common.show')}</span>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t(`${translationPrefix}.newPassword`)}</Label>
            <div className="relative">
              <Input id="new-password" type={showNewPassword ? 'text' : 'password'} value={passwordForm.password} onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))} className="pe-12" />
              <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-11 w-11 -translate-y-1/2 px-0" onClick={() => setShowNewPassword((current) => !current)}>
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showNewPassword ? t('common.hide') : t('common.show')}</span>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t(`${translationPrefix}.confirmPassword`)}</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwordForm.password_confirmation}
                onChange={(event) => setPasswordForm((current) => ({ ...current, password_confirmation: event.target.value }))}
                className="pe-12"
              />
              <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-11 w-11 -translate-y-1/2 px-0" onClick={() => setShowConfirmPassword((current) => !current)}>
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showConfirmPassword ? t('common.hide') : t('common.show')}</span>
              </Button>
            </div>
          </div>
          <Button type="button" onClick={() => passwordMutation.mutate()} disabled={passwordMutation.isPending}>
            {passwordMutation.isPending ? t('common.saving') : t(`${translationPrefix}.updatePassword`)}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
