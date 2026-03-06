import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Activity, ArrowUpRight, BadgeDollarSign, PackageSearch, Timer } from 'lucide-react'
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
  onActivate?: (program: { id: number; name: string; base_price: number; has_external_api: boolean; external_software_id: number | null }) => void
}

export function ProgramCatalogPage({ eyebrow, title, description, translationPrefix, onActivate }: ProgramCatalogPageProps) {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [search, setSearch] = useState('')

  const programsQuery = useQuery({
    queryKey: ['program-catalog', translationPrefix, search],
    queryFn: () => programService.getAll({ per_page: 100, search, status: 'active' }),
    refetchOnMount: 'always',
    retry: 1,
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

      {programsQuery.isError ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-5">
            <p className="text-sm text-rose-600 dark:text-rose-400">{t('common.connectionLost')}</p>
            <Button type="button" variant="outline" onClick={() => void programsQuery.refetch()}>
              {t('common.tryAgain')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {programs.length === 0 && !programsQuery.isLoading && !programsQuery.isError ? (
        <EmptyState title={t(`${translationPrefix}.emptyTitle`)} description={t(`${translationPrefix}.emptyDescription`)} icon={PackageSearch} />
      ) : programs.length > 0 ? (
        <StaggerGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((program) => (
            <StaggerItem key={program.id}>
              <Card className="overflow-hidden border-b-2 border-b-sky-500 border-slate-200/80 shadow-sm transition-shadow duration-200 hover:shadow-lg dark:border-slate-800">
                <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-sky-100 via-cyan-50 to-blue-100 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/40">
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
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <BadgeDollarSign className="h-3.5 w-3.5 rounded-full bg-sky-200/60 p-0.5 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" />
                        {t(`${translationPrefix}.basePrice`)}
                      </p>
                      <p className="mt-1 font-semibold">{formatCurrency(program.base_price, 'USD', locale)}</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <Timer className="h-3.5 w-3.5 rounded-full bg-cyan-200/60 p-0.5 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" />
                        {t(`${translationPrefix}.trialDays`)}
                      </p>
                      <p className="mt-1 font-semibold">{program.trial_days}</p>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <Activity className="h-3.5 w-3.5 rounded-full bg-blue-200/60 p-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" />
                        {t(`${translationPrefix}.licensesSold`)}
                      </p>
                      <p className="mt-1 font-semibold">{program.licenses_sold}</p>
                    </div>
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                      <p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <Activity className="h-3.5 w-3.5 rounded-full bg-indigo-200/60 p-0.5 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" />
                        {t(`${translationPrefix}.activeLicenses`)}
                      </p>
                      <p className="mt-1 font-semibold">{program.active_licenses_count}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1 justify-between" onClick={() => window.open(program.download_link, '_blank', 'noopener,noreferrer')}>
                      {t(`${translationPrefix}.openDownload`)}
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                    {onActivate ? (
                      <Button
                        type="button"
                        className="shrink-0 shadow-[0_0_0_0_rgba(14,165,233,0.5)] transition-shadow hover:shadow-[0_0_0_8px_rgba(14,165,233,0.15)]"
                        onClick={() =>
                          onActivate({
                            id: program.id,
                            name: program.name,
                            base_price: program.base_price,
                            has_external_api: program.has_external_api,
                            external_software_id: program.external_software_id,
                          })
                        }
                      >
                        {t('common.activate')}
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-2 py-1 ${program.has_external_api ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                      {program.has_external_api ? t('software.apiConfigured') : t('software.apiNotConfigured')}
                    </span>
                    {program.external_software_id ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {t('software.externalSoftwareId')}: {program.external_software_id}
                      </span>
                    ) : null}
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
