import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { COMMON_TIMEZONES, resolveDisplayTimezone } from '@/lib/timezones'
import { profileService } from '@/services/profile.service'

export function ProfilePage() {
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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const profileMutation = useMutation({
    mutationFn: () => profileService.updateProfile(profileForm),
    onSuccess: (data) => {
      setAuthenticatedUser(data.user)
      toast.success(t('superAdmin.pages.profile.profileSaved'))
    },
  })

  const passwordMutation = useMutation({
    mutationFn: () => profileService.updatePassword(passwordForm),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.profile.passwordSaved'))
      setPasswordForm({ current_password: '', password: '', password_confirmation: '' })
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
    },
  })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('superAdmin.pages.profile.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.profile.description')}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t('superAdmin.pages.profile.accountCard')}</CardTitle>
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
            <CardTitle>{t('superAdmin.pages.profile.editProfile')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">{t('common.name')}</Label>
              <Input id="profile-name" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">{t('common.email')}</Label>
              <Input id="profile-email" type="email" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">{t('common.phone')}</Label>
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
            </div>
            <Button type="button" onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
              {profileMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('superAdmin.pages.profile.changePassword')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t('superAdmin.pages.profile.currentPassword')}</Label>
            <div className="relative">
              <Input id="current-password" type={showCurrentPassword ? 'text' : 'password'} value={passwordForm.current_password} onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))} className="pe-12" />
              <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-9 -translate-y-1/2 px-2" onClick={() => setShowCurrentPassword((current) => !current)}>
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showCurrentPassword ? t('common.hide') : t('common.show')}</span>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('superAdmin.pages.profile.newPassword')}</Label>
            <div className="relative">
              <Input id="new-password" type={showNewPassword ? 'text' : 'password'} value={passwordForm.password} onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))} className="pe-12" />
              <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-9 -translate-y-1/2 px-2" onClick={() => setShowNewPassword((current) => !current)}>
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showNewPassword ? t('common.hide') : t('common.show')}</span>
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('superAdmin.pages.profile.confirmPassword')}</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwordForm.password_confirmation}
                onChange={(event) => setPasswordForm((current) => ({ ...current, password_confirmation: event.target.value }))}
                className="pe-12"
              />
              <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-9 -translate-y-1/2 px-2" onClick={() => setShowConfirmPassword((current) => !current)}>
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">{showConfirmPassword ? t('common.hide') : t('common.show')}</span>
              </Button>
            </div>
          </div>
          <Button type="button" onClick={() => passwordMutation.mutate()} disabled={passwordMutation.isPending}>
            {passwordMutation.isPending ? t('common.saving') : t('superAdmin.pages.profile.updatePassword')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
