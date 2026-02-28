import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowUpRight, PackageSearch } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { StaggerGroup, StaggerItem } from '@/components/shared/PageTransition'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { programService } from '@/services/program.service'

interface ProgramCatalogPageProps {
  eyebrow: string
  title: string
  description: string
  translationPrefix: string
}

export function ProgramCatalogPage({ eyebrow, title, description, translationPrefix }: ProgramCatalogPageProps) {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [search, setSearch] = useState('')

  const programsQuery = useQuery({
    queryKey: ['program-catalog', translationPrefix, search],
    queryFn: () => programService.getAll({ per_page: 100, search, status: 'active' }),
  })

  const programs = programsQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <Card>
        <CardContent className="p-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t(`${translationPrefix}.searchPlaceholder`)}
          />
        </CardContent>
      </Card>

      {programsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : null}

      {programs.length === 0 && !programsQuery.isLoading ? (
        <EmptyState title={t(`${translationPrefix}.emptyTitle`)} description={t(`${translationPrefix}.emptyDescription`)} icon={PackageSearch} />
      ) : (
        <StaggerGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((program) => (
            <StaggerItem key={program.id}>
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{program.name}</CardTitle>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t(`${translationPrefix}.version`)} {program.version}
                      </p>
                    </div>
                    <StatusBadge status={program.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <p className="min-h-16 text-sm text-slate-600 dark:text-slate-300">{program.description || t(`${translationPrefix}.noDescription`)}</p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t(`${translationPrefix}.basePrice`)}</p>
                      <p className="mt-1 font-semibold">{formatCurrency(program.base_price, 'USD', locale)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t(`${translationPrefix}.trialDays`)}</p>
                      <p className="mt-1 font-semibold">{program.trial_days}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t(`${translationPrefix}.licensesSold`)}</p>
                      <p className="mt-1 font-semibold">{program.licenses_sold}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t(`${translationPrefix}.activeLicenses`)}</p>
                      <p className="mt-1 font-semibold">{program.active_licenses_count}</p>
                    </div>
                  </div>

                  <Button type="button" variant="outline" className="w-full justify-between" onClick={() => window.open(program.download_link, '_blank', 'noopener,noreferrer')}>
                    {t(`${translationPrefix}.openDownload`)}
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}
    </div>
  )
}
