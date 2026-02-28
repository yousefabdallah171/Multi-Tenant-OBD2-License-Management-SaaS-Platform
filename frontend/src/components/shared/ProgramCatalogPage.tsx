import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, PackageSearch } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
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
}

export function ProgramCatalogPage({ eyebrow, title, description }: ProgramCatalogPageProps) {
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const copy = lang === 'ar'
    ? {
        searchPlaceholder: 'ابحث باسم البرنامج',
        emptyTitle: 'لم يتم العثور على برامج',
        emptyDescription: 'عدّل عبارة البحث أو فعّل البرامج أولاً من كتالوج البرامج الخاص بالمدير الرئيسي.',
        version: 'الإصدار',
        noDescription: 'لا يوجد وصف متاح.',
        basePrice: 'السعر الأساسي',
        trialDays: 'أيام التجربة',
        licensesSold: 'التراخيص المباعة',
        activeLicenses: 'التراخيص النشطة',
        openDownload: 'فتح التحميل',
      }
    : {
        searchPlaceholder: 'Search by program name',
        emptyTitle: 'No programs found',
        emptyDescription: 'Adjust the search term or activate programs from the manager parent software catalog first.',
        version: 'Version',
        noDescription: 'No description provided.',
        basePrice: 'Base Price',
        trialDays: 'Trial Days',
        licensesSold: 'Licenses Sold',
        activeLicenses: 'Active Licenses',
        openDownload: 'Open Download',
      }
  const [search, setSearch] = useState('')

  const programsQuery = useQuery({
    queryKey: ['program-catalog', eyebrow, search],
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
            placeholder={copy.searchPlaceholder}
          />
        </CardContent>
      </Card>

      {programs.length === 0 && !programsQuery.isLoading ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} icon={PackageSearch} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((program) => (
            <Card key={program.id} className="overflow-hidden">
              <CardHeader className="border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{program.name}</CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{copy.version} {program.version}</p>
                  </div>
                  <StatusBadge status={program.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <p className="min-h-16 text-sm text-slate-600 dark:text-slate-300">{program.description || copy.noDescription}</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{copy.basePrice}</p>
                    <p className="mt-1 font-semibold">{formatCurrency(program.base_price, 'USD', locale)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{copy.trialDays}</p>
                    <p className="mt-1 font-semibold">{program.trial_days}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{copy.licensesSold}</p>
                    <p className="mt-1 font-semibold">{program.licenses_sold}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{copy.activeLicenses}</p>
                    <p className="mt-1 font-semibold">{program.active_licenses_count}</p>
                  </div>
                </div>

                <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => window.open(program.download_link, '_blank', 'noopener,noreferrer')}>
                  {copy.openDownload}
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
