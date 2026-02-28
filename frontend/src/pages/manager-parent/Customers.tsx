import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { customerService } from '@/services/customer.service'
import { programService } from '@/services/program.service'
import { teamService } from '@/services/team.service'
import type { CustomerSummary } from '@/types/manager-parent.types'

const STATUS_OPTIONS = ['all', 'active', 'expired', 'suspended', 'pending'] as const

export function CustomersPage() {
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
    queryKey: ['manager-parent', 'customers', page, perPage, search, status, resellerId, programId],
    queryFn: () =>
      customerService.getAll({
        page,
        per_page: perPage,
        search,
        reseller_id: resellerId,
        program_id: programId,
        status: status === 'all' ? '' : status,
      }),
  })

  const detailQuery = useQuery({
    queryKey: ['manager-parent', 'customers', 'detail', selectedCustomerId],
    queryFn: () => customerService.getOne(selectedCustomerId ?? 0),
    enabled: selectedCustomerId !== null,
  })

  const resellerQuery = useQuery({
    queryKey: ['manager-parent', 'customers', 'resellers'],
    queryFn: () => teamService.getAll({ role: 'reseller', per_page: 100 }),
  })

  const programsQuery = useQuery({
    queryKey: ['manager-parent', 'customers', 'programs'],
    queryFn: () => programService.getAll({ per_page: 100 }),
  })

  const columns = useMemo<Array<DataTableColumn<CustomerSummary>>>(
    () => [
      { key: 'name', label: 'Name', sortable: true, sortValue: (row) => row.name, render: (row) => row.name },
      { key: 'email', label: 'Email', sortable: true, sortValue: (row) => row.email, render: (row) => row.email },
      { key: 'bios', label: 'BIOS ID', sortable: true, sortValue: (row) => row.bios_id ?? '', render: (row) => row.bios_id ?? '-' },
      { key: 'reseller', label: 'Reseller', sortable: true, sortValue: (row) => row.reseller ?? '', render: (row) => row.reseller ?? '-' },
      { key: 'program', label: 'Program', sortable: true, sortValue: (row) => row.program ?? '', render: (row) => row.program ?? '-' },
      { key: 'status', label: 'Status', sortable: true, sortValue: (row) => row.status ?? '', render: (row) => (row.status ? <StatusBadge status={row.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} /> : '-') },
      { key: 'expiry', label: 'Expiry', sortable: true, sortValue: (row) => row.expiry ?? '', render: (row) => (row.expiry ? formatDate(row.expiry, locale) : '-') },
    ],
    [locale],
  )

  const selectedCustomer = detailQuery.data?.data

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Read-only customer directory with tenant-scoped filters for reseller, program, status, and BIOS search." />

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
              {option === 'all' ? 'All' : option.charAt(0).toUpperCase() + option.slice(1)}
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
                placeholder="Search by customer, email, or BIOS ID"
              />
              <select
                value={resellerId}
                onChange={(event) => {
                  setResellerId(event.target.value ? Number(event.target.value) : '')
                  setPage(1)
                }}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">All resellers</option>
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
                <option value="">All programs</option>
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
            <DialogTitle>{selectedCustomer?.name ?? 'Customer details'}</DialogTitle>
            <DialogDescription>{selectedCustomer?.email ?? 'Select a customer row to inspect license history.'}</DialogDescription>
          </DialogHeader>
          {selectedCustomer ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">BIOS ID</p>
                    <p className="mt-2 font-semibold">{selectedCustomer.bios_id ?? '-'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Reseller</p>
                    <p className="mt-2 font-semibold">{selectedCustomer.reseller ?? '-'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Program</p>
                    <p className="mt-2 font-semibold">{selectedCustomer.program ?? '-'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
                    <p className="mt-2">{selectedCustomer.status ? <StatusBadge status={selectedCustomer.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} /> : '-'}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold">License History</h3>
                {selectedCustomer.licenses.map((license) => (
                  <div key={license.id} className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-950 dark:text-white">{license.program ?? 'Unknown program'}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">BIOS {license.bios_id}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Activated by {license.reseller ?? 'Unknown reseller'}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={license.status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} />
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{license.activated_at ? formatDate(license.activated_at, locale) : '-'}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Expires {license.expires_at ? formatDate(license.expires_at, locale) : '-'}</p>
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
