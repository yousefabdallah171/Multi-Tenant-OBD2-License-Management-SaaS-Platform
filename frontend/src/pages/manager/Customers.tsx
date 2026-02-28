import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { managerService } from '@/services/manager.service'
import { programService } from '@/services/program.service'
import type { ManagerCustomerSummary } from '@/types/manager-reseller.types'

const STATUS_OPTIONS = ['all', 'active', 'expired', 'suspended', 'pending'] as const

export function CustomersPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>('all')
  const [resellerId, setResellerId] = useState<number | ''>('')
  const [programId, setProgramId] = useState<number | ''>('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)

  const customersQuery = useQuery({
    queryKey: ['manager', 'customers', page, perPage, search, status, resellerId, programId],
    queryFn: () =>
      managerService.getCustomers({
        page,
        per_page: perPage,
        search,
        reseller_id: resellerId,
        program_id: programId,
        status: status === 'all' ? '' : status,
      }),
  })

  const detailQuery = useQuery({
    queryKey: ['manager', 'customers', 'detail', selectedCustomerId],
    queryFn: () => managerService.getCustomer(selectedCustomerId ?? 0),
    enabled: selectedCustomerId !== null,
  })

  const resellerQuery = useQuery({
    queryKey: ['manager', 'customers', 'resellers'],
    queryFn: () => managerService.getTeam({ per_page: 100 }),
  })

  const programsQuery = useQuery({
    queryKey: ['manager', 'customers', 'programs'],
    queryFn: () => programService.getAll({ per_page: 100 }),
  })

  const columns = useMemo<Array<DataTableColumn<ManagerCustomerSummary>>>(
    () => [
      { key: 'name', label: t('common.name'), sortable: true, sortValue: (row) => row.name, render: (row) => row.name },
      { key: 'email', label: t('common.email'), sortable: true, sortValue: (row) => row.email, render: (row) => row.email },
      { key: 'bios', label: t('manager.pages.customers.biosId'), sortable: true, sortValue: (row) => row.bios_id ?? '', render: (row) => row.bios_id ?? '-' },
      { key: 'reseller', label: t('common.reseller'), sortable: true, sortValue: (row) => row.reseller ?? '', render: (row) => row.reseller ?? '-' },
      { key: 'program', label: t('common.program'), sortable: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
      {
        key: 'status',
        label: t('common.status'),
        sortable: true,
        sortValue: (row) => row.status ?? '',
        render: (row) => (row.status ? <StatusBadge status={row.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} /> : '-'),
      },
      { key: 'expiry', label: t('common.expiry'), sortable: true, sortValue: (row) => row.expiry ?? '', render: (row) => (row.expiry ? formatDate(row.expiry, locale) : '-') },
    ],
    [locale, t],
  )

  const selectedCustomer = detailQuery.data?.data

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('manager.layout.eyebrow')}
        title={t('manager.pages.customers.title')}
        description={t('manager.pages.customers.description')}
      />

      <Tabs
        value={status}
        onValueChange={(value) => {
          setStatus(value as (typeof STATUS_OPTIONS)[number])
          setPage(1)
        }}
      >
        <TabsList>
          {STATUS_OPTIONS.map((option) => (
            <TabsTrigger key={option} value={option}>
              {option === 'all'
                ? t('common.all')
                : option === 'active'
                  ? t('common.active')
                  : option === 'expired'
                    ? t('common.expired')
                    : option === 'suspended'
                      ? t('common.suspended')
                      : t('common.pending')}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={status} className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder={t('manager.pages.customers.searchPlaceholder')}
              />
              <select
                value={resellerId}
                onChange={(event) => {
                  setResellerId(event.target.value ? Number(event.target.value) : '')
                  setPage(1)
                }}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">{t('manager.pages.customers.allResellers')}</option>
                {(resellerQuery.data?.data ?? []).map((reseller) => (
                  <option key={reseller.id} value={reseller.id}>
                    {reseller.name}
                  </option>
                ))}
              </select>
              <select
                value={programId}
                onChange={(event) => {
                  setProgramId(event.target.value ? Number(event.target.value) : '')
                  setPage(1)
                }}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">{t('manager.pages.customers.allPrograms')}</option>
                {(programsQuery.data?.data ?? []).map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          <DataTable
            columns={columns}
            data={customersQuery.data?.data ?? []}
            rowKey={(row) => row.id}
            onRowClick={(row) => setSelectedCustomerId(row.id)}
            isLoading={customersQuery.isLoading}
            pagination={{
              page: customersQuery.data?.meta.current_page ?? 1,
              lastPage: customersQuery.data?.meta.last_page ?? 1,
              total: customersQuery.data?.meta.total ?? 0,
              perPage: customersQuery.data?.meta.per_page ?? perPage,
            }}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPerPage(size)
              setPage(1)
            }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={selectedCustomerId !== null} onOpenChange={(open) => !open && setSelectedCustomerId(null)}>
        <DialogContent className="left-auto right-0 top-0 h-screen w-[min(100vw,44rem)] max-w-[44rem] translate-x-0 translate-y-0 overflow-y-auto rounded-none rounded-s-3xl">
          <DialogHeader>
            <DialogTitle>{selectedCustomer?.name ?? t('manager.pages.customers.customerDetails')}</DialogTitle>
            <DialogDescription>{selectedCustomer?.email ?? t('manager.pages.customers.customerDetailsDescription')}</DialogDescription>
          </DialogHeader>
          {selectedCustomer ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <InfoCard label={t('manager.pages.customers.biosId')} value={selectedCustomer.bios_id ?? '-'} />
                <InfoCard label={t('common.reseller')} value={selectedCustomer.reseller ?? '-'} />
                <InfoCard label={t('common.program')} value={selectedCustomer.program ?? '-'} />
                <InfoCard
                  label={t('common.status')}
                  value={selectedCustomer.status ? <StatusBadge status={selectedCustomer.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} /> : '-'}
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold">{t('manager.pages.customers.licenseHistory')}</h3>
                {selectedCustomer.licenses.map((license) => (
                  <div key={license.id} className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-950 dark:text-white">{license.program ?? t('manager.pages.customers.unknownProgram')}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('manager.pages.customers.biosId')} {license.bios_id}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {t('common.reseller')} {license.reseller ?? t('manager.pages.customers.unknownReseller')}
                        </p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} />
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{license.activated_at ? formatDate(license.activated_at, locale) : '-'}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {t('manager.pages.customers.expires')} {license.expires_at ? formatDate(license.expires_at, locale) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-2 font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}
