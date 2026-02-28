import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { profileService } from '@/services/profile.service'

interface ProfileWorkspaceProps {
  eyebrow: string
  description: string
}

export function ProfileWorkspace({ eyebrow, description }: ProfileWorkspaceProps) {
  const { user, setAuthenticatedUser } = useAuth()
  const { lang } = useLanguage()
  const copy = lang === 'ar'
    ? {
        title: 'الملف الشخصي',
        accountCard: 'بطاقة الحساب',
        editProfile: 'تعديل الملف الشخصي',
        saveProfile: 'حفظ الملف الشخصي',
        saving: 'جارٍ الحفظ...',
        changePassword: 'تغيير كلمة المرور',
        currentPassword: 'كلمة المرور الحالية',
        newPassword: 'كلمة المرور الجديدة',
        confirmPassword: 'تأكيد كلمة المرور',
        updatePassword: 'تحديث كلمة المرور',
        preferences: 'تفضيلات الإشعارات',
        emailNotifications: 'إشعارات البريد الإلكتروني',
        productUpdates: 'تحديثات المنتجات وتغييرات المنصة',
        profileSaved: 'تم تحديث الملف الشخصي بنجاح.',
        passwordSaved: 'تم تحديث كلمة المرور بنجاح.',
        name: 'الاسم',
        email: 'البريد الإلكتروني',
        phone: 'الهاتف',
      }
    : {
        title: 'Profile',
        accountCard: 'Account Card',
        editProfile: 'Edit Profile',
        saveProfile: 'Save Profile',
        saving: 'Saving...',
        changePassword: 'Change Password',
        currentPassword: 'Current Password',
        newPassword: 'New Password',
        confirmPassword: 'Confirm Password',
        updatePassword: 'Update Password',
        preferences: 'Notification Preferences',
        emailNotifications: 'Email notifications',
        productUpdates: 'Product updates and platform changes',
        profileSaved: 'Profile updated successfully.',
        passwordSaved: 'Password updated successfully.',
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
      }
  const [profileForm, setProfileForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
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
      toast.success(copy.profileSaved)
    },
  })

  const passwordMutation = useMutation({
    mutationFn: () => profileService.updatePassword(passwordForm),
    onSuccess: () => {
      toast.success(copy.passwordSaved)
      setPasswordForm({ current_password: '', password: '', password_confirmation: '' })
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={copy.title} description={description} />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{copy.accountCard}</CardTitle>
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
            <CardTitle>{copy.editProfile}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">{copy.name}</Label>
              <Input id="profile-name" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">{copy.email}</Label>
              <Input id="profile-email" type="email" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">{copy.phone}</Label>
              <Input id="profile-phone" value={profileForm.phone ?? ''} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
            </div>
            <Button type="button" onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
              {profileMutation.isPending ? copy.saving : copy.saveProfile}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{copy.changePassword}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{copy.currentPassword}</Label>
              <Input id="current-password" type="password" value={passwordForm.current_password} onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{copy.newPassword}</Label>
              <Input id="new-password" type="password" value={passwordForm.password} onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{copy.confirmPassword}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.password_confirmation}
                onChange={(event) => setPasswordForm((current) => ({ ...current, password_confirmation: event.target.value }))}
              />
            </div>
            <Button type="button" onClick={() => passwordMutation.mutate()} disabled={passwordMutation.isPending}>
              {passwordMutation.isPending ? copy.saving : copy.updatePassword}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{copy.preferences}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={preferences.emailNotifications}
                onChange={(event) => setPreferences((current) => ({ ...current, emailNotifications: event.target.checked }))}
              />
              {copy.emailNotifications}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={preferences.productUpdates}
                onChange={(event) => setPreferences((current) => ({ ...current, productUpdates: event.target.checked }))}
              />
              {copy.productUpdates}
            </label>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
