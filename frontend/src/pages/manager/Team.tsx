import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { managerService } from '@/services/manager.service'
import type { ManagerTeamReseller } from '@/types/manager-reseller.types'

export function TeamPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [status, setStatus] = useState<'active' | 'suspended' | 'inactive' | ''>('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const teamQuery = useQuery({
    queryKey: ['manager', 'team', page, perPage, status, search],
    queryFn: () =>
      managerService.getTeam({
        page,
        per_page: perPage,
        status,
        search,
      }),
  })

  const detailQuery = useQuery({
    queryKey: ['manager', 'team', 'detail', selectedId],
    queryFn: () => managerService.getTeamMember(selectedId ?? 0),
    enabled: selectedId !== null,
  })

  const columns = useMemo<Array<DataTableColumn<ManagerTeamReseller>>>(
    () => [
      {
        key: 'name',
        label: t('manager.pages.team.columns.reseller'),
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <div>
            <p className="font-medium text-slate-950 dark:text-white">{row.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{row.email}</p>
          </div>
        ),
      },
      { key: 'customers', label: t('manager.pages.dashboard.teamCustomers'), sortable: true, sortValue: (row) => row.customers_count, render: (row) => row.customers_count },
      { key: 'licenses', label: t('manager.pages.dashboard.activeLicenses'), sortable: true, sortValue: (row) => row.active_licenses_count, render: (row) => row.active_licenses_count },
      { key: 'revenue', label: t('common.revenue'), sortable: true, sortValue: (row) => row.revenue, render: (row) => formatCurrency(row.revenue, 'USD', locale) },
      { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
    ],
    [locale, t],
  )

  const selectedReseller = detailQuery.data?.data

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t('manager.layout.eyebrow')} title={t('manager.pages.team.title')} description={t('manager.pages.team.description')} />

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('manager.pages.team.searchPlaceholder')}
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as 'active' | 'suspended' | 'inactive' | '')
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('common.allStatuses')}</option>
            <option value="active">{t('common.active')}</option>
            <option value="suspended">{t('common.suspended')}</option>
            <option value="inactive">{t('common.inactive')}</option>
          </select>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={teamQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => setSelectedId(row.id)}
        isLoading={teamQuery.isLoading}
        pagination={{
          page: teamQuery.data?.meta.current_page ?? 1,
          lastPage: teamQuery.data?.meta.last_page ?? 1,
          total: teamQuery.data?.meta.total ?? 0,
          perPage: teamQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPerPage(size)
          setPage(1)
        }}
      />

      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="left-auto right-0 top-0 h-screen w-[min(100vw,44rem)] max-w-[44rem] translate-x-0 translate-y-0 overflow-y-auto rounded-none rounded-s-3xl">
          <DialogHeader>
            <DialogTitle>{selectedReseller?.name ?? t('manager.pages.team.resellerDetail')}</DialogTitle>
            <DialogDescription>{selectedReseller?.email ?? t('manager.pages.team.resellerDetailDescription')}</DialogDescription>
          </DialogHeader>

          {selectedReseller ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <MetricCard label={t('manager.pages.dashboard.teamCustomers')} value={selectedReseller.customers_count} />
                <MetricCard label={t('manager.pages.dashboard.activeLicenses')} value={selectedReseller.active_licenses_count} />
                <MetricCard label={t('common.revenue')} value={formatCurrency(selectedReseller.revenue, 'USD', locale)} />
                <MetricCard label={t('common.status')} value={<StatusBadge status={selectedReseller.status} />} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('manager.pages.team.recentLicenses')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedReseller.recent_licenses.length === 0 ? (
                    <EmptyState title={t('manager.pages.team.noRecentLicensesTitle')} description={t('manager.pages.team.noRecentLicensesDescription')} />
                  ) : (
                    selectedReseller.recent_licenses.map((license) => (
                      <div key={license.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-950 dark:text-white">{license.customer?.name ?? t('manager.pages.team.unknownCustomer')}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{license.customer?.email ?? t('manager.pages.team.noEmail')}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{license.program ?? t('manager.pages.customers.unknownProgram')}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('manager.pages.team.biosId')} {license.bios_id}</p>
                          </div>
                          <div className="text-right">
                            <StatusBadge status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} />
                            <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatCurrency(license.price, 'USD', locale)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {t('manager.pages.customers.expires')} {license.expires_at ? formatDate(license.expires_at, locale) : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('manager.pages.team.joined')} {selectedReseller.created_at ? formatDate(selectedReseller.created_at, locale) : '-'}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-2 font-semibold text-slate-950 dark:text-white">{value}</div>
      </CardContent>
    </Card>
  )
}
