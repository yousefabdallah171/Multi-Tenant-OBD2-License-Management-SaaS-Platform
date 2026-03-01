import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivateLicenseModal } from '@/components/ActivateLicenseModal'
import { ProgramCatalogPage } from '@/components/shared/ProgramCatalogPage'

export function SoftwarePage() {
  const { t } = useTranslation()
  const [selectedProgram, setSelectedProgram] = useState<{ id: number; name: string; base_price: number; has_external_api: boolean; external_software_id: number | null } | null>(null)

  return (
    <>
      <ProgramCatalogPage
        eyebrow={t('roles.reseller')}
        title={t('reseller.pages.software.title')}
        description={t('reseller.pages.software.description')}
        translationPrefix="reseller.pages.software"
        onActivate={(program) => setSelectedProgram(program)}
      />
      <ActivateLicenseModal
        open={selectedProgram !== null}
        onClose={() => setSelectedProgram(null)}
        program={
          selectedProgram
            ? {
                id: selectedProgram.id,
                name: selectedProgram.name,
                price_per_day: selectedProgram.base_price,
                has_external_api: selectedProgram.has_external_api,
                external_software_id: selectedProgram.external_software_id,
              }
            : null
        }
      />
    </>
  )
}
