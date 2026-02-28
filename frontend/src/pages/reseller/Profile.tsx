import { useTranslation } from 'react-i18next'
import { ProfileWorkspace } from '@/components/shared/ProfileWorkspace'

export function ProfilePage() {
  const { t } = useTranslation()

  return (
    <ProfileWorkspace
      eyebrow={t('roles.reseller')}
      description={t('reseller.pages.profile.description')}
      translationPrefix="reseller.pages.profile"
    />
  )
}
