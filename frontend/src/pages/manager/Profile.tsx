import { useTranslation } from 'react-i18next'
import { ProfileWorkspace } from '@/components/shared/ProfileWorkspace'

export function ProfilePage() {
  const { t } = useTranslation()

  return (
    <ProfileWorkspace
      eyebrow={t('manager.layout.eyebrow')}
      description={t('manager.pages.profile.description')}
      translationPrefix="manager.pages.profile"
    />
  )
}
