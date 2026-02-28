import { ProfileWorkspace } from '@/components/shared/ProfileWorkspace'
import { useLanguage } from '@/hooks/useLanguage'

export function ProfilePage() {
  const { lang } = useLanguage()

  return (
    <ProfileWorkspace
      eyebrow={lang === 'ar' ? 'موزع' : 'Reseller'}
      description={lang === 'ar' ? 'قم بتحديث بيانات حساب الموزع وكلمة المرور وتفضيلات الإشعارات الخاصة بك.' : 'Update your reseller account details, password, and notification preferences.'}
    />
  )
}
