import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { COMMON_TIMEZONES, resolveDisplayTimezone } from '@/lib/timezones'
import { profileService } from '@/services/profile.service'
import { settingsService } from '@/services/settings.service'
import type { SystemSettings } from '@/types/super-admin.types'

export function SettingsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user, setAuthenticatedUser } = useAuth()
  const [showApiKey, setShowApiKey] = useState(false)
  const [draft, setDraft] = useState<SystemSettings | null>(null)
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

  const settingsQuery = useQuery({
    queryKey: ['super-admin', 'settings'],
    queryFn: () => settingsService.get(),
  })

  const form = draft ?? settingsQuery.data?.data ?? null

  const saveMutation = useMutation({
    mutationFn: () => settingsService.update(form as SystemSettings),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.settings.saveSuccess'))
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'settings'] })
    },
  })

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

  if (!form) {
    return <div className="py-20 text-center text-sm text-slate-500">{t('common.loading')}</div>
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('superAdmin.pages.settings.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.settings.description')}</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t('superAdmin.pages.settings.general')}</TabsTrigger>
          <TabsTrigger value="api">{t('superAdmin.pages.settings.api')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('superAdmin.pages.settings.notifications')}</TabsTrigger>
          <TabsTrigger value="security">{t('superAdmin.pages.settings.security')}</TabsTrigger>
          <TabsTrigger value="profile">{t('superAdmin.pages.settings.profileTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="platform-name">{t('superAdmin.pages.settings.platformName')}</Label>
                <Input id="platform-name" value={form.general.platform_name} onChange={(event) => setDraft((current) => ({ ...(current ?? form), general: { ...(current ?? form).general, platform_name: event.target.value } }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trial-days">{t('superAdmin.pages.settings.defaultTrialDays')}</Label>
                <Input
                  id="trial-days"
                  type="number"
                  value={form.general.default_trial_days}
                  onChange={(event) => setDraft((current) => ({ ...(current ?? form), general: { ...(current ?? form).general, default_trial_days: Number(event.target.value) } }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.general.maintenance_mode}
                  onChange={(event) => setDraft((current) => ({ ...(current ?? form), general: { ...(current ?? form).general, maintenance_mode: event.target.checked } }))}
                />
                {t('superAdmin.pages.settings.maintenanceMode')}
              </label>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="server-timezone">{t('settings.serverTimezone')}</Label>
                <select
                  id="server-timezone"
                  value={form.general.server_timezone}
                  onChange={(event) => setDraft((current) => ({ ...(current ?? form), general: { ...(current ?? form).general, server_timezone: event.target.value } }))}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {COMMON_TIMEZONES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('settings.timezonePurpose')}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="api-url">{t('superAdmin.pages.settings.apiUrl')}</Label>
                <Input id="api-url" value={form.api.url} readOnly className="cursor-not-allowed bg-slate-100 dark:bg-slate-900" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="api-key">{t('superAdmin.pages.settings.apiKey')}</Label>
                <div className="flex gap-3">
                  <Input
                    id="api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={form.api.key}
                    onChange={(event) => setDraft((current) => ({ ...(current ?? form), api: { ...(current ?? form).api, key: event.target.value } }))}
                  />
                  <Button type="button" variant="secondary" onClick={() => setShowApiKey((current) => !current)}>
                    {showApiKey ? t('common.hide') : t('common.show')}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeout">{t('superAdmin.pages.settings.timeout')}</Label>
                <Input id="timeout" type="number" value={form.api.timeout} onChange={(event) => setDraft((current) => ({ ...(current ?? form), api: { ...(current ?? form).api, timeout: Number(event.target.value) } }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retries">{t('superAdmin.pages.settings.retries')}</Label>
                <Input id="retries" type="number" value={form.api.retries} onChange={(event) => setDraft((current) => ({ ...(current ?? form), api: { ...(current ?? form).api, retries: Number(event.target.value) } }))} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardContent className="grid gap-4 p-6">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.notifications.email_enabled}
                  onChange={(event) => setDraft((current) => ({ ...(current ?? form), notifications: { ...(current ?? form).notifications, email_enabled: event.target.checked } }))}
                />
                {t('superAdmin.pages.settings.emailNotifications')}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.notifications.pusher_enabled}
                  onChange={(event) => setDraft((current) => ({ ...(current ?? form), notifications: { ...(current ?? form).notifications, pusher_enabled: event.target.checked } }))}
                />
                {t('superAdmin.pages.settings.pusherNotifications')}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={form.widgets.show_online_widget_to_resellers}
                  onChange={(event) => setDraft((current) => ({ ...(current ?? form), widgets: { ...(current ?? form).widgets, show_online_widget_to_resellers: event.target.checked } }))}
                />
                {t('superAdmin.pages.settings.showOnlineWidgetToResellers')}
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="min-password">{t('superAdmin.pages.settings.minPasswordLength')}</Label>
                <Input
                  id="min-password"
                  type="number"
                  value={form.security.min_password_length}
                  onChange={(event) => setDraft((current) => ({ ...(current ?? form), security: { ...(current ?? form).security, min_password_length: Number(event.target.value) } }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-timeout">{t('superAdmin.pages.settings.sessionTimeout')}</Label>
                <Input
                  id="session-timeout"
                  type="number"
                  value={form.security.session_timeout}
                  onChange={(event) => setDraft((current) => ({ ...(current ?? form), security: { ...(current ?? form).security, session_timeout: Number(event.target.value) } }))}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardContent className="grid gap-4 p-6">
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
                  <Input id="profile-phone" type="tel" value={profileForm.phone ?? ''} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-timezone">{t('common.timezone', { defaultValue: 'Timezone' })}</Label>
                  <select
                    id="profile-timezone"
                    value={profileForm.timezone ?? 'UTC'}
                    onChange={(event) => setProfileForm((current) => ({ ...current, timezone: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    {COMMON_TIMEZONES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="button" onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
                  {profileMutation.isPending ? t('common.saving') : t('superAdmin.pages.settings.saveProfile')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="grid gap-4 p-6">
                <div className="space-y-2">
                  <Label htmlFor="profile-current-password">{t('superAdmin.pages.profile.currentPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="profile-current-password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.current_password}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))}
                      className="pe-12"
                    />
                    <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-9 -translate-y-1/2 px-2" onClick={() => setShowCurrentPassword((current) => !current)}>
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">{showCurrentPassword ? t('common.hide') : t('common.show')}</span>
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-new-password">{t('superAdmin.pages.profile.newPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="profile-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.password}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))}
                      className="pe-12"
                    />
                    <Button type="button" variant="ghost" size="sm" className="absolute end-1 top-1/2 h-9 -translate-y-1/2 px-2" onClick={() => setShowNewPassword((current) => !current)}>
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">{showNewPassword ? t('common.hide') : t('common.show')}</span>
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-confirm-password">{t('superAdmin.pages.profile.confirmPassword')}</Label>
                  <div className="relative">
                    <Input
                      id="profile-confirm-password"
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
                  {passwordMutation.isPending ? t('common.saving') : t('superAdmin.pages.settings.savePassword')}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? t('common.saving') : t('common.save')}
      </Button>
    </div>
  )
}
