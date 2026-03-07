import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Bell, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { COMMON_TIMEZONES, resolveDisplayTimezone } from '@/lib/timezones'
import { profileService } from '@/services/profile.service'

interface ProfileWorkspaceProps {
  eyebrow: string
  description: string
  translationPrefix: string
}

export function ProfileWorkspace({ eyebrow, description, translationPrefix }: ProfileWorkspaceProps) {
  const { t } = useTranslation()
  const { user, setAuthenticatedUser } = useAuth()
  const [profileForm, setProfileForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    timezone: resolveDisplayTimezone(user?.timezone),
  })
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  })
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    productUpdates: false,
  })

  const profileMutation = useMutation({
    mutationFn: () => profileService.updateProfile(profileForm),
    onSuccess: (data) => {
      setAuthenticatedUser(data.user)
      toast.success(t(`${translationPrefix}.profileSaved`))
    },
  })

  const passwordMutation = useMutation({
    mutationFn: () => profileService.updatePassword(passwordForm),
    onSuccess: () => {
      toast.success(t(`${translationPrefix}.passwordSaved`))
      setPasswordForm({ current_password: '', password: '', password_confirmation: '' })
    },
  })

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
              <Input id="profile-name" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email" className="inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Mail className="h-3.5 w-3.5" />
                </span>
                {t('common.email')}
              </Label>
              <Input id="profile-email" type="email" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone" className="inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <Phone className="h-3.5 w-3.5" />
                </span>
                {t('common.phone')}
              </Label>
              <Input id="profile-phone" value={profileForm.phone ?? ''} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-timezone">{t('common.timezone', { defaultValue: 'Timezone' })}</Label>
              <select
                id="profile-timezone"
                value={profileForm.timezone ?? 'UTC'}
                onChange={(event) => setProfileForm((current) => ({ ...current, timezone: event.target.value }))}
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
            <Button type="button" onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
              {profileMutation.isPending ? t('common.saving') : t(`${translationPrefix}.saveProfile`)}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
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
              <Input id="current-password" type="password" value={passwordForm.current_password} onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t(`${translationPrefix}.newPassword`)}</Label>
              <Input id="new-password" type="password" value={passwordForm.password} onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t(`${translationPrefix}.confirmPassword`)}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.password_confirmation}
                onChange={(event) => setPasswordForm((current) => ({ ...current, password_confirmation: event.target.value }))}
              />
            </div>
            <Button type="button" onClick={() => passwordMutation.mutate()} disabled={passwordMutation.isPending}>
              {passwordMutation.isPending ? t('common.saving') : t(`${translationPrefix}.updatePassword`)}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                <Bell className="h-4 w-4" />
              </span>
              {t(`${translationPrefix}.preferences`)}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={preferences.emailNotifications}
                onChange={(event) => setPreferences((current) => ({ ...current, emailNotifications: event.target.checked }))}
              />
              {t(`${translationPrefix}.emailNotifications`)}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={preferences.productUpdates}
                onChange={(event) => setPreferences((current) => ({ ...current, productUpdates: event.target.checked }))}
              />
              {t(`${translationPrefix}.productUpdates`)}
            </label>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
