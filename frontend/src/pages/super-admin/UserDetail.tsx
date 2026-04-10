import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { EmptyState } from '@/components/shared/EmptyState'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/hooks/useLanguage'
import { normalizeAccountStatus, toStoredAccountStatus } from '@/lib/account-status'
import { formatActivityActionLabel, formatDate, formatReadableActivityDescription, isValidPhoneNumber, normalizePhoneInput } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { adminService } from '@/services/admin.service'
import { biosService } from '@/services/bios.service'
import { tenantService } from '@/services/tenant.service'
import { userService } from '@/services/user.service'
import type { ManagedUser } from '@/types/super-admin.types'

interface EditFormState {
  name: string
  email: string
  username: string
  phone: string
  role: ManagedUser['role']
  tenant_id: number | ''
  status: 'active' | 'inactive'
}

export function UserDetailPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const params = useParams()
  const id = Number(params.id)
  const navigationState = location.state as { returnTo?: string; restore?: Record<string, unknown> } | null
  const returnTo = navigationState?.returnTo ?? routePaths.superAdmin.users(lang)
  const restoreState = navigationState?.restore
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<EditFormState>({
    name: '',
    email: '',
    username: '',
    phone: '',
    role: 'manager_parent',
    tenant_id: '',
    status: 'active',
  })

  const detailQuery = useQuery({
    queryKey: ['super-admin', 'users', 'detail', id],
    queryFn: () => userService.getOne(id),
    enabled: Number.isFinite(id) && id > 0,
  })
  const tenantsQuery = useQuery({
    queryKey: ['super-admin', 'admin-tenant-options'],
    queryFn: () => tenantService.getAll({ per_page: 100 }),
  })

  const user = detailQuery.data?.data
  const visibleEmail = user?.email ?? t('manager.pages.team.noEmail')
  const editMutation = useMutation({
    mutationFn: async () => {
      await adminService.update(id, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: normalizePhoneInput(form.phone.trim()) || null,
        role: form.role === 'customer' ? 'reseller' : form.role,
        tenant_id: form.role === 'super_admin' ? null : Number(form.tenant_id),
        status: form.status,
      })

      const currentUsername = user?.username?.trim() ?? ''
      const desiredUsername = form.username.trim()

      if (desiredUsername && desiredUsername !== currentUsername) {
        try {
          await biosService.changeUsername(id, desiredUsername)
          return { usernameUpdated: true, usernameErrorMessage: null as string | null }
        } catch (error) {
          return {
            usernameUpdated: false,
            usernameErrorMessage: getApiErrorMessage(error, t('superAdmin.pages.usernameManagement.usernameRequired')),
          }
        }
      }

      return { usernameUpdated: true, usernameErrorMessage: null as string | null }
    },
    onSuccess: ({ usernameUpdated, usernameErrorMessage }) => {
      setEditOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'users'] })
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'admin-management'] })
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'users', 'detail', id] })

      if (usernameUpdated) {
        toast.success(t('superAdmin.pages.adminManagement.saveSuccess'))
        return
      }

      toast.error(usernameErrorMessage ?? t('common.partialUsernameUpdate', { defaultValue: 'Account details were saved, but the username could not be updated.' }))
    },
  })

  return (
    <div className="space-y-6">
      <Button type="button" variant="outline" onClick={() => navigate(returnTo, restoreState ? { state: { restore: restoreState } } : undefined)}>
        {t('common.back')}
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="max-w-4xl break-words text-2xl font-semibold leading-tight sm:text-3xl">{user?.name ?? t('superAdmin.pages.users.title')}</h2>
          <p className="max-w-3xl break-all text-sm text-slate-500 dark:text-slate-400 sm:break-words">{user ? visibleEmail : t('superAdmin.pages.users.description')}</p>
        </div>
        {user ? (
          <Button
            type="button"
            onClick={() => {
              setForm({
                name: user.name,
                email: user.email ?? '',
                username: user.username ?? '',
                phone: user.phone ?? '',
                role: user.role,
                tenant_id: user.tenant?.id ?? '',
                status: toStoredAccountStatus(normalizeAccountStatus(user.status)),
              })
              setEditOpen(true)
            }}
          >
            {t('common.edit')}
          </Button>
        ) : null}
      </div>

      {user ? (
        <>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label={t('common.username')} value={user.username ?? '-'} />
            <MetricCard label={t('common.email')} value={visibleEmail} />
            <MetricCard label={t('common.phone')} value={user.phone ?? '-'} />
            <MetricCard label={t('managerParent.pages.teamManagement.customers')} value={user.customers_count} />
            <MetricCard label={t('managerParent.pages.teamManagement.activeLicenses')} value={user.active_licenses_count} />
            <MetricCard label={t('common.revenue')} value={new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(user.revenue)} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label={t('common.role')} value={<RoleBadge role={user.role} />} />
            <MetricCard label={t('common.accountStatus')} value={<StatusBadge status={normalizeAccountStatus(user.status)} />} />
            <MetricCard label={t('common.tenant')} value={user.tenant?.name ?? '-'} />
          </div>

          {user.role === 'reseller' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard
                label={t('common.assignedTo', { defaultValue: 'Assigned To' })}
                value={user.created_by ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <RoleBadge role={user.created_by.role ?? 'manager'} />
                      <span>{user.created_by.name}</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{user.created_by.email ?? '-'}</p>
                  </div>
                ) : '-'}
              />
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('manager.pages.team.recentLicenses')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {user.recent_licenses.length === 0 ? (
                <EmptyState title={t('common.noData')} description={t('common.adjustFilters')} />
              ) : (
                user.recent_licenses.map((license) => (
                  <div key={license.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-medium text-slate-950 dark:text-white">
                      {license.customer?.id ? <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.customerDetail(lang, license.customer.id)}>{license.customer.name}</Link> : (license.customer?.name ?? '-')}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{license.customer?.email ?? '-'}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{license.program ?? t('manager.pages.customers.unknownProgram')}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('activate.biosId')}{' '}
                      <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.superAdmin.biosDetail(lang, license.bios_id)}>
                        {license.bios_id}
                      </Link>
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('superAdmin.pages.dashboard.recentActivity')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {user.recent_activity.length === 0 ? (
                <EmptyState title={t('common.noData')} description={t('superAdmin.pages.dashboard.noActivity')} />
              ) : (
                user.recent_activity.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-medium text-slate-950 dark:text-white">{formatActivityActionLabel(entry.action, t)}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatReadableActivityDescription(entry.description, locale)}</p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('superAdmin.pages.adminManagement.editTitle')}</DialogTitle>
            <DialogDescription>{t('superAdmin.pages.adminManagement.formDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="detail-admin-name">{t('common.name')}</Label>
              <Input id="detail-admin-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-admin-email">{t('common.email')}</Label>
              <Input id="detail-admin-email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-admin-username">{t('common.username')}</Label>
              <Input id="detail-admin-username" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-admin-phone">{t('common.phone')}</Label>
              <Input id="detail-admin-phone" type="tel" inputMode="tel" placeholder="+966..." value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: normalizePhoneInput(event.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-admin-role">{t('common.role')}</Label>
              <select
                id="detail-admin-role"
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as ManagedUser['role'] }))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="super_admin">{t('roles.super_admin')}</option>
                <option value="manager_parent">{t('roles.manager_parent')}</option>
                <option value="manager">{t('roles.manager')}</option>
                <option value="reseller">{t('roles.reseller')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-admin-tenant">{t('common.tenant')}</Label>
              <select
                id="detail-admin-tenant"
                value={form.tenant_id}
                onChange={(event) => setForm((current) => ({ ...current, tenant_id: event.target.value ? Number(event.target.value) : '' }))}
                disabled={form.role === 'super_admin'}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">{t('common.selectTenant')}</option>
                {tenantsQuery.data?.data.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-admin-status">{t('common.status')}</Label>
              <select
                id="detail-admin-status"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as 'active' | 'inactive' }))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="active">{t('common.active')}</option>
                <option value="inactive">{t('common.deactive')}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!form.username.trim()) {
                  toast.error(t('superAdmin.pages.usernameManagement.usernameRequired'))
                  return
                }

                if (form.phone.trim() && !isValidPhoneNumber(form.phone)) {
                  toast.error(t('validation.invalidPhone', { defaultValue: 'Invalid phone number' }))
                  return
                }

                editMutation.mutate()
              }}
              disabled={editMutation.isPending}
            >
              {editMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-2 break-words text-lg font-semibold leading-snug text-slate-950 dark:text-white sm:text-xl">
          {value}
        </div>
      </CardContent>
    </Card>
  )
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message && error.message !== 'Request failed with status code 422') {
    return error.message
  }

  const response = (error as AxiosError<{ message?: string; errors?: Record<string, string[]> }>).response

  return response?.data?.message
    ?? Object.values(response?.data?.errors ?? {})[0]?.[0]
    ?? fallback
}
