import { useState } from 'react'
import { PackageSearch } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ProgramCard } from '@/components/customer/ProgramCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { StaggerGroup, StaggerItem } from '@/components/shared/PageTransition'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { customerPortalService } from '@/services/customer.service'

export function SoftwarePage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const softwareQuery = useQuery({
    queryKey: ['customer', 'software'],
    queryFn: () => customerPortalService.getSoftware(),
  })

  const filteredPrograms = (softwareQuery.data ?? []).filter((program) => {
    const haystack = `${program.name ?? ''} ${program.description ?? ''}`.toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-400">{t('customerPortal.layout.eyebrow')}</p>
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">{t('customerPortal.software.title')}</h1>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('customerPortal.software.description')}</p>
      </section>

      <Card>
        <CardContent className="p-4">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('customerPortal.software.searchPlaceholder')} />
        </CardContent>
      </Card>

      {softwareQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} lines={4} />)}
        </div>
      ) : null}

      {!softwareQuery.isLoading && filteredPrograms.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={t('customerPortal.software.emptyTitle')}
          description={t('customerPortal.software.emptyDescription')}
        />
      ) : null}

      {filteredPrograms.length > 0 ? (
        <StaggerGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPrograms.map((program) => (
            <StaggerItem key={program.license_id}>
              <ProgramCard
                licenseId={program.license_id}
                name={program.name ?? t('customerPortal.dashboard.unknownProgram')}
                version={program.version}
                description={program.description}
                icon={program.icon}
                status={program.status}
                downloadLink={program.download_link}
                canDownload={program.can_download}
              />
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : null}
    </div>
  )
}
