import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { StatusFilterCard } from '@/components/customers/StatusFilterCard'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'
import { teamService } from '@/services/team.service'
import type { SellerLogEntry } from '@/types/manager-parent.types'
import type { UserRole } from '@/types/user.types'

const ACTION_OPTIONS = [
  'license.activated',
  'license.renewed',
  'license.deactivated',
  'license.delete',
] as const

interface SellerOption {
  id: number
  name: string
  role: UserRole
}

export function ResellerLogsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(() => parsePositiveInt(searchParams.get('page'), 1))
  const [perPage, setPerPage] = useState(() => parsePositiveInt(searchParams.get('per_page'), 15))
  const [sellerId, setSellerId] = useState<number | ''>(() => parseOptionalNumber(searchParams.get('seller_id')))
  const [action, setAction] = useState<string>(() => searchParams.get('action') ?? '')
  const [range, setRange] = useState<DateRangeValue>(() => ({
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
  }))

  // Reset all filters when navigating to clean URL (e.g. sidebar click)
  useEffect(() => {
    if (searchParams.toString() === '') {
      setPage(1)
      setPerPage(15)
      setSellerId('')
      setAction('')
      setRange({ from: '', to: '' })
    }
  }, [searchParams])

  useEffect(() => {
    const next = new URLSearchParams()

    if (page > 1) {
      next.set('page', String(page))
    }

    if (perPage !== 15) {
      next.set('per_page', String(perPage))
    }

    if (sellerId !== '') {
      next.set('seller_id', String(sellerId))
    }

    if (action !== '') {
      next.set('action', action)
    }

    if (range.from) {
      next.set('from', range.from)
    }

    if (range.to) {
      next.set('to', range.to)
    }

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [action, page, perPage, range.from, range.to, searchParams, sellerId, setSearchParams])

  const logsQuery = useQuery({
    queryKey: ['manager-parent', 'seller-logs', page, perPage, sellerId, action, range.from, range.to],
    queryFn: () => managerParentService.getSellerLogs({ page, per_page: perPage, seller_id: sellerId, action, from: range.from, to: range.to }),
  })

  const teamQuery = useQuery({
    queryKey: ['manager-parent', 'seller-logs', 'team'],
    queryFn: () => teamService.getAll({ per_page: 100 }),
  })

  const sellerOptions = useMemo<SellerOption[]>(() => {
    const options = (teamQuery.data?.data ?? [])
      .map((member) => {
        const role = normalizeRole(member.role)
        return role ? { id: member.id, name: member.name, role } : null
      })
      .filter((member): member is SellerOption => member !== null)

    if (user && user.role === 'manager_parent' && !options.some((member) => member.id === user.id)) {
      options.unshift({ id: user.id, name: user.name, role: user.role })
    }

    return options
  }, [teamQuery.data?.data, user])

  const columns = useMemo<Array<DataTableColumn<SellerLogEntry>>>(() => [
    {
      key: 'created_at',
      label: t('common.timestamp'),
      sortable: true,
      sortValue: (row) => row.created_at ?? '',
      render: (row) => row.created_at ? formatDate(row.created_at, locale) : '-',
    },
    {
      key: 'seller',
      label: t('common.user'),
      sortable: true,
      sortValue: (row) => row.seller?.name ?? '',
      render: (row) => {
        const role = normalizeRole(row.seller?.role)

        return row.seller ? (
          <div className="space-y-1">
            {row.seller.id && (role === 'manager' || role === 'reseller') ? (
              <Link
                className="text-start font-medium text-sky-600 hover:underline dark:text-sky-300"
                to={routePaths.managerParent.teamMemberDetail(lang, row.seller.id)}
              >
                {row.seller.name ?? '-'}
              </Link>
            ) : (
              <button
                type="button"
                className="text-start font-medium text-sky-600 hover:underline dark:text-sky-300"
                onClick={() => {
                  if (row.seller?.id) {
                    setSellerId(row.seller.id)
                    setPage(1)
                  }
                }}
              >
                {row.seller.name ?? '-'}
              </button>
            )}
            {role ? <RoleBadge role={role} /> : null}
          </div>
        ) : '-'
      },
    },
    {
      key: 'action',
      label: t('common.action'),
      sortable: true,
      sortValue: (row) => row.action,
      render: (row) => <ActionPill label={getActionLabel(row.action, t)} action={row.action} />,
    },
    {
      key: 'customer',
      label: t('common.customer'),
      sortable: true,
      sortValue: (row) => row.customer_name ?? getMetadataString(row.metadata, 'customer_name') ?? '',
      render: (row) => {
        const customerName = row.customer_name ?? getMetadataString(row.metadata, 'customer_name') ?? '-'

        return row.customer_id ? (
          <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.customerDetail(lang, row.customer_id)}>
            {customerName}
          </Link>
        ) : customerName
      },
    },
    {
      key: 'program',
      label: t('common.program'),
      sortable: true,
      sortValue: (row) => row.program_name ?? getMetadataString(row.metadata, 'program_name') ?? '',
      render: (row) => row.program_name ?? getMetadataString(row.metadata, 'program_name') ?? '-',
    },
    {
      key: 'bios_id',
      label: t('activate.biosId'),
      sortable: true,
      sortValue: (row) => row.bios_id ?? getMetadataString(row.metadata, 'bios_id') ?? '',
      render: (row) => {
        const biosId = row.bios_id ?? getMetadataString(row.metadata, 'bios_id')
        if (!biosId) {
          return '-'
        }

        return (
          <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.biosDetail(lang, biosId)}>
            {biosId}
          </Link>
        )
      },
    },
    {
      key: 'price',
      label: t('common.price'),
      sortable: true,
      sortValue: (row) => row.price ?? getMetadataNumber(row.metadata, 'price') ?? 0,
      render: (row) => {
        const price = row.price ?? getMetadataNumber(row.metadata, 'price')
        return price === null ? '-' : formatCurrency(price, 'USD', locale)
      },
    },
    {
      key: 'license_status',
      label: t('common.status'),
      sortable: true,
      sortValue: (row) => row.license_status ?? '',
      render: (row) => row.license_status
        ? <StatusBadge status={row.license_status as 'active' | 'expired' | 'suspended' | 'inactive' | 'pending'} />
        : '-',
    },
    {
      key: 'ip_address',
      label: 'IP',
      sortable: true,
      sortValue: (row) => row.ip_address ?? '',
      render: (row) => row.ip_address ?? '-',
    },
  ], [lang, locale, t])

  const summary = logsQuery.data?.summary ?? {
    total_entries: 0,
    activations: 0,
    renewals: 0,
    deactivations: 0,
    deletions: 0,
    revenue: 0,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('managerParent.nav.resellerLogs')}
        description={t('managerParent.pages.resellerLogs.description')}
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSellerId('')
              setAction('')
              setRange({ from: '', to: '' })
              setPage(1)
            }}
          >
            {t('common.clear')}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatusFilterCard label={t('managerParent.pages.activity.allActions')} count={summary.total_entries} isActive={action === ''} onClick={() => { setAction(''); setPage(1) }} color="sky" />
        <StatusFilterCard label={t('common.activate')} count={summary.activations} isActive={action === 'license.activated'} onClick={() => { setAction('license.activated'); setPage(1) }} color="emerald" />
        <StatusFilterCard label={t('common.renew')} count={summary.renewals} isActive={action === 'license.renewed'} onClick={() => { setAction('license.renewed'); setPage(1) }} color="sky" />
        <StatusFilterCard label={t('common.deactivate')} count={summary.deactivations} isActive={action === 'license.deactivated'} onClick={() => { setAction('license.deactivated'); setPage(1) }} color="amber" />
        <StatusFilterCard label={t('common.delete')} count={summary.deletions} isActive={action === 'license.delete'} onClick={() => { setAction('license.delete'); setPage(1) }} color="rose" />
        <MetricCard label={t('common.revenue')} value={formatCurrency(summary.revenue, 'USD', locale)} />
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[260px_240px_minmax(0,1fr)]">
          <select
            value={sellerId}
            onChange={(event) => {
              setSellerId(event.target.value ? Number(event.target.value) : '')
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('common.all')} {t('common.users')}</option>
            {sellerOptions.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.name} ({t(`roles.${seller.role}`)})
              </option>
            ))}
          </select>
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('managerParent.pages.activity.allActions')}</option>
            {ACTION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {getActionLabel(option, t)}
              </option>
            ))}
          </select>
          <DateRangePicker
            value={range}
            onChange={(value) => {
              setRange(value)
              setPage(1)
            }}
          />
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={logsQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={logsQuery.isLoading}
        emptyMessage={t('managerParent.pages.activity.noMatches')}
        onRowClick={(row) => {
          const role = normalizeRole(row.seller?.role)
          if (row.seller?.id && (role === 'manager' || role === 'reseller')) {
            navigate(routePaths.managerParent.teamMemberDetail(lang, row.seller.id))
          }
        }}
        pagination={{
          page: logsQuery.data?.meta.page ?? 1,
          lastPage: logsQuery.data?.meta.last_page ?? 1,
          total: logsQuery.data?.meta.total ?? 0,
          perPage: logsQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPerPage(size)
          setPage(1)
        }}
      />
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

function ActionPill({ label, action }: { label: string; action: string }) {
  const styles: Record<string, string> = {
    'license.activated': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    'license.renewed': 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
    'license.deactivated': 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    'license.delete': 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  }

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[action] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{label}</span>
}

function normalizeRole(role: string | null | undefined): UserRole | null {
  return role === 'manager_parent' || role === 'manager' || role === 'reseller' || role === 'customer' || role === 'super_admin'
    ? role
    : null
}

function getActionLabel(action: string, t: (key: string, options?: Record<string, unknown>) => string) {
  if (action === 'license.activated') {
    return t('common.activate')
  }

  if (action === 'license.renewed') {
    return t('common.renew')
  }

  if (action === 'license.deactivated') {
    return t('common.deactivate')
  }

  if (action === 'license.delete') {
    return t('common.delete')
  }

  return action
}

function getMetadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' ? value : null
}

function getMetadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value)
  }

  return null
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseOptionalNumber(value: string | null): number | '' {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : ''
}
