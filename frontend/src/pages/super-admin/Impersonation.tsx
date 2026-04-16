import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { superAdminPlatformService } from '@/services/super-admin-platform.service'
import { tenantService } from '@/services/tenant.service'
import type { ImpersonationTargetSummary } from '@/types/super-admin.types'

const senderMessageType = 'super-admin-impersonation-launch'

export function ImpersonationPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<'' | 'manager_parent' | 'manager' | 'reseller'>('')
  const [status, setStatus] = useState<'' | 'active' | 'suspended' | 'inactive'>('')
  const [tenantId, setTenantId] = useState<number | ''>('')
  const [launchingId, setLaunchingId] = useState<number | null>(null)

  const targetsQuery = useQuery({
    queryKey: ['super-admin', 'impersonation', 'targets', page, perPage, search, role, status, tenantId],
    queryFn: () => superAdminPlatformService.getImpersonationTargets({
      page,
      per_page: perPage,
      search,
      role,
      status,
      tenant_id: tenantId,
    }),
  })

  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'impersonation', 'tenants'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
  })

  const launchImpersonation = async (targetUserId: number) => {
    if (typeof window === 'undefined') {
      return
    }

    setLaunchingId(targetUserId)

    const popup = window.open('', '_blank')
    if (!popup) {
      toast.error(t('superAdmin.pages.impersonation.popupBlocked'))
      setLaunchingId(null)
      return
    }

    try {
      const startResponse = await superAdminPlatformService.startImpersonation(targetUserId)
      const launchPath = routePaths.superAdmin.impersonationLaunch(lang)
      popup.location.href = launchPath

      const payload = {
        type: senderMessageType,
        token: startResponse.data.token,
      }
      const targetOrigin = window.location.origin
      const startedAt = Date.now()

      const send = () => {
        if (popup.closed) {
          return false
        }

        try {
          popup.postMessage(payload, targetOrigin)
          return true
        } catch {
          return false
        }
      }

      send()
      const interval = window.setInterval(() => {
        const elapsed = Date.now() - startedAt
        if (popup.closed || elapsed > 10_000) {
          window.clearInterval(interval)
          return
        }
        send()
      }, 250)

      toast.success(t('superAdmin.pages.impersonation.launching'))
    } catch (error) {
      popup.close()
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(message ?? t('common.error'))
    } finally {
      setLaunchingId(null)
    }
  }

  const columns = useMemo<Array<DataTableColumn<ImpersonationTargetSummary>>>(() => [
    {
      key: 'name',
      label: t('common.name'),
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <div>
          <div className="font-medium text-slate-950 dark:text-white">{row.name}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{row.email ?? '-'}</div>
        </div>
      ),
    },
    { key: 'role', label: t('common.role'), sortable: true, sortValue: (row) => row.role, render: (row) => <RoleBadge role={row.role} /> },
    { key: 'tenant', label: t('common.tenant'), sortable: true, sortValue: (row) => row.tenant?.name ?? '', render: (row) => row.tenant?.name ?? '-' },
    { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'last_seen_at',
      label: t('superAdmin.pages.impersonation.lastSeen'),
      sortable: true,
      sortValue: (row) => row.last_seen_at ?? '',
      render: (row) => (row.last_seen_at ? formatDate(row.last_seen_at, locale) : '-'),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => (
        <Button
          type="button"
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            void launchImpersonation(row.id)
          }}
          disabled={launchingId === row.id}
        >
          {launchingId === row.id
            ? t('superAdmin.pages.impersonation.launching')
            : t('superAdmin.pages.impersonation.loginAs')}
        </Button>
      ),
    },
  ], [lang, launchingId, locale, t])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{t('superAdmin.pages.impersonation.title')}</h2>
        <p className="max-w-4xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.impersonation.description')}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="ps-10"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder={t('superAdmin.pages.impersonation.searchPlaceholder')}
              />
            </div>
            <select
              value={role}
              onChange={(event) => {
                setRole((event.target.value || '') as '' | 'manager_parent' | 'manager' | 'reseller')
                setPage(1)
              }}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('common.allRoles')}</option>
              <option value="manager_parent">{t('roles.manager_parent')}</option>
              <option value="manager">{t('roles.manager')}</option>
              <option value="reseller">{t('roles.reseller')}</option>
            </select>
            <select
              value={status}
              onChange={(event) => {
                setStatus((event.target.value || '') as '' | 'active' | 'suspended' | 'inactive')
                setPage(1)
              }}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('common.allStatuses')}</option>
              <option value="active">{t('common.active')}</option>
              <option value="suspended">{t('common.suspended')}</option>
              <option value="inactive">{t('common.inactive')}</option>
            </select>
            <select
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value ? Number(event.target.value) : '')
                setPage(1)
              }}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">{t('common.allTenants')}</option>
              {tenantsQuery.data?.data.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <DataTable
        tableKey="super_admin_impersonation_targets"
        columns={columns}
        data={targetsQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={targetsQuery.isLoading}
        pagination={{
          page: targetsQuery.data?.meta.current_page ?? page,
          lastPage: targetsQuery.data?.meta.last_page ?? 1,
          total: targetsQuery.data?.meta.total ?? 0,
          perPage: targetsQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPerPage(nextPageSize)
          setPage(1)
        }}
      />
    </div>
  )
}
