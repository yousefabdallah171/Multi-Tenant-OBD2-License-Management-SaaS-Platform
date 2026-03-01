import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, PackageSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { StaggerGroup, StaggerItem } from '@/components/shared/PageTransition'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { customerPortalService } from '@/services/customer.service'

export function SoftwarePage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const softwareQuery = useQuery({
    queryKey: ['customer', 'software'],
    queryFn: () => customerPortalService.getSoftware(),
  })

  const filteredPrograms = useMemo(() => {
    const list = softwareQuery.data?.data ?? []
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) {
      return list
    }

    return list.filter((program) => (program.name ?? '').toLowerCase().includes(normalizedSearch))
  }, [search, softwareQuery.data?.data])

  const openDownload = (downloadLink: string | null) => {
    if (!downloadLink) {
      toast.error(t('customerPortal.download.disabledTooltip'))
      return
    }

    window.open(downloadLink, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('customerPortal.software.title')}</h2>
        <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('customerPortal.software.description')}</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('customerPortal.software.searchPlaceholder')}
          />
        </CardContent>
      </Card>

      {softwareQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index} lines={4} />
          ))}
        </div>
      ) : null}

      {filteredPrograms.length === 0 && !softwareQuery.isLoading ? (
        <EmptyState
          title={t('customerPortal.software.emptyTitle')}
          description={t('customerPortal.software.emptyDescription')}
          icon={PackageSearch}
        />
      ) : null}

      {!softwareQuery.isLoading ? (
        <StaggerGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPrograms.map((program) => (
            <StaggerItem key={program.license_id}>
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{program.name ?? t('customerPortal.dashboard.unknownProgram')}</CardTitle>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {t('customerPortal.software.version')} {program.version ?? '-'}
                      </p>
                    </div>
                    <StatusBadge status={program.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="min-h-16 text-sm text-slate-600 dark:text-slate-300">{program.description ?? t('customerPortal.software.noDescription')}</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1 justify-between"
                      disabled={!program.can_download}
                      onClick={() => openDownload(program.download_link)}
                    >
                      {t('customerPortal.actions.download')}
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : null}
    </div>
  )
}
