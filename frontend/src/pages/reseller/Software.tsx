import { ProgramCatalogPage } from '@/components/shared/ProgramCatalogPage'
import { useLanguage } from '@/hooks/useLanguage'

export function SoftwarePage() {
  const { lang } = useLanguage()

  return (
    <ProgramCatalogPage
      eyebrow={lang === 'ar' ? 'موزع' : 'Reseller'}
      title={lang === 'ar' ? 'البرامج' : 'Software'}
      description={lang === 'ar' ? 'استعرض البرامج النشطة المتاحة للتفعيل. هذا الكتالوج للقراءة فقط لحسابات الموزعين.' : 'Browse the active programs available for activation. This catalog is read-only for reseller accounts.'}
    />
  )
}
