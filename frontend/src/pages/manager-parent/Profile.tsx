import { useTranslation } from 'react-i18next'
import { ProfileWorkspace } from '@/components/shared/ProfileWorkspace'

export function ProfilePage() {
  const { t } = useTranslation()

  return (
    <ProfileWorkspace
      eyebrow={t('managerParent.layout.eyebrow')}
      description={t('managerParent.pages.profile.description')}
      translationPrefix="managerParent.pages.profile"
    />
  )
}
