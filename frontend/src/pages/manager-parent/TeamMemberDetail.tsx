import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/hooks/useLanguage'
import { formatActivityActionLabel, formatCurrency, formatDate, isCustomerLicenseHistoryAction, isValidPhoneNumber, normalizePhoneInput } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerParentService } from '@/services/manager-parent.service'
import { teamService } from '@/services/team.service'
import type { TeamMemberDetail } from '@/types/manager-parent.types'

type DetailStatus = 'active' | 'suspended' | 'cancelled' | 'inactive' | 'expired' | 'pending' | 'scheduled' | 'scheduled_failed' | 'removed' | 'online' | 'offline' | 'degraded' | 'unknown'
interface EditFormState {
  name: string
  email: string
  phone: string
  username: string
}

export function TeamMemberDetailPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const params = useParams()
  const id = Number(params.id)
  const navigationState = location.state as { returnTo?: string; restore?: Record<string, unknown> } | null
  const returnTo = navigationState?.returnTo ?? routePaths.managerParent.teamManagement(lang)
  const restoreState = navigationState?.restore
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<EditFormState>({ name: '', email: '', phone: '', username: '' })

  const detailQuery = useQuery({
    queryKey: ['manager-parent', 'team', 'detail', id],
    queryFn: () => teamService.getOne(id),
    enabled: Number.isFinite(id) && id > 0,
  })

  const member = detailQuery.data?.data
  const customerLicenseHistory = useMemo(
    () => (member?.seller_log_history ?? []).filter((entry) => isCustomerLicenseHistoryAction(entry.action)),
    [member?.seller_log_history],
  )
  const editMutation = useMutation({
    mutationFn: async () => {
      await teamService.update(id, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: normalizePhoneInput(form.phone.trim()) || null,
      })

      const currentUsername = member?.username?.trim() ?? ''
      const desiredUsername = form.username.trim()

      if (desiredUsername && desiredUsername !== currentUsername) {
        try {
          await managerParentService.changeUsername(id, desiredUsername)
          return { usernameUpdated: true, usernameErrorMessage: null as string | null }
        } catch (error) {
          return {
            usernameUpdated: false,
            usernameErrorMessage: getApiErrorMessage(error, t('managerParent.pages.usernameManagement.usernameRequired')),
          }
        }
      }

      return { usernameUpdated: true, usernameErrorMessage: null as string | null }
    },
    onSuccess: ({ usernameUpdated, usernameErrorMessage }) => {
      setEditOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team'] })
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'team', 'detail', id] })

      if (usernameUpdated) {
        toast.success(t('managerParent.pages.teamManagement.updateSuccess'))
        return
      }

      toast.error(usernameErrorMessage ?? t('common.partialUsernameUpdate', { defaultValue: 'Account details were saved, but the username could not be updated.' }))
    },
  })
  const historyColumns: Array<DataTableColumn<TeamMemberDetail['seller_log_history'][number]>> = [
    {
      key: 'created_at',
      label: t('common.timestamp'),
      render: (row) => row.created_at ? formatDate(row.created_at, locale) : '-',
    },
    {
      key: 'action',
      label: t('common.action'),
      render: (row) => formatActivityActionLabel(row.action),
    },
    {
      key: 'customer',
      label: t('common.customer'),
      render: (row) => row.customer_id
        ? (
          <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.customerDetail(lang, row.customer_id)}>
            {row.customer_name ?? '-'}
          </Link>
          )
        : (row.customer_name ?? '-'),
    },
    {
      key: 'program',
      label: t('common.program'),
      render: (row) => row.program_name ?? '-',
    },
    {
      key: 'bios_id',
      label: t('activate.biosId'),
      render: (row) => row.bios_id
        ? (
          <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.biosDetail(lang, row.bios_id)}>
            {row.bios_id}
          </Link>
          )
        : '-',
    },
    {
      key: 'price',
      label: t('common.price'),
      render: (row) => row.price === null ? '-' : formatCurrency(row.price, 'USD', locale),
    },
    {
      key: 'status',
      label: t('common.status'),
      render: (row) => row.license_status ? <StatusBadge status={row.license_status as DetailStatus} /> : '-',
    },
  ]

  return (
    <div className="space-y-6">
      <Button type="button" variant="outline" onClick={() => navigate(returnTo, restoreState ? { state: { restore: restoreState } } : undefined)}>
        {t('common.back')}
      </Button>
      <PageHeader
        title={member?.name ?? t('managerParent.pages.teamManagement.title')}
        description={member?.email ?? t('managerParent.pages.teamManagement.description')}
        actions={member ? (
          <Button
            type="button"
            onClick={() => {
              setForm({
                name: member.name,
                email: member.email,
                phone: member.phone ?? '',
                username: member.username ?? '',
              })
              setEditOpen(true)
            }}
          >
            {t('common.edit')}
          </Button>
        ) : null}
      />

      {member ? (
        <>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label={t('common.username')} value={member.username ?? '-'} />
            <MetricCard label={t('common.email')} value={member.email} />
            <MetricCard label={t('common.phone')} value={member.phone ?? '-'} />
            <MetricCard label={t('managerParent.pages.teamManagement.customers')} value={member.customers_count} />
            <MetricCard label={t('managerParent.pages.teamManagement.activeLicenses')} value={member.active_licenses_count} />
            <MetricCard label={t('common.revenue')} value={formatCurrency(member.revenue, 'USD', locale)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <MetricCard label={t('common.accountStatus')} value={<StatusBadge status={member.status} />} />
            <MetricCard label={t('common.role')} value={member.role} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('manager.pages.team.recentLicenses')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {member.recent_licenses.length === 0 ? (
                <EmptyState title={t('common.noData')} description={t('common.adjustFilters')} />
              ) : (
                member.recent_licenses.map((license) => (
                  <div key={license.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-medium text-slate-950 dark:text-white">{license.customer?.name ?? '-'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{license.customer?.email ?? '-'}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{license.program ?? '-'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('activate.biosId')}{' '}
                      <Link className="text-sky-600 hover:underline dark:text-sky-300" to={routePaths.managerParent.biosDetail(lang, license.bios_id)}>
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
              <CardTitle className="text-lg">{t('managerParent.nav.activity')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {member.recent_activity.length === 0 ? (
                <EmptyState title={t('common.noData')} description={t('managerParent.pages.activity.noMatches')} />
              ) : (
                member.recent_activity.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-medium text-slate-950 dark:text-white">{entry.action}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{entry.description ?? '-'}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{entry.created_at ? formatDate(entry.created_at, locale) : '-'}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('common.customerLicenseHistory', { defaultValue: 'Customer & License History' })}</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={historyColumns}
                data={customerLicenseHistory}
                rowKey={(row) => row.id}
                emptyMessage={t('managerParent.pages.activity.noMatches')}
              />
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('managerParent.pages.teamManagement.editTitle')}</DialogTitle>
            <DialogDescription>{t('managerParent.pages.teamManagement.editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="detail-team-member-name">{t('common.name')}</Label>
              <Input id="detail-team-member-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-team-member-email">{t('common.email')}</Label>
              <Input id="detail-team-member-email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-team-member-username">{t('common.username')}</Label>
              <Input id="detail-team-member-username" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-team-member-phone">{t('common.phone')}</Label>
              <Input
                id="detail-team-member-phone"
                type="tel"
                inputMode="tel"
                placeholder="+966..."
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: normalizePhoneInput(event.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (form.name.trim().length < 2) {
                  toast.error(t('managerParent.pages.teamManagement.nameValidation'))
                  return
                }

                if (!form.username.trim()) {
                  toast.error(t('managerParent.pages.usernameManagement.usernameRequired'))
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
              {editMutation.isPending ? t('common.saving') : t('managerParent.pages.teamManagement.saveChanges')}
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
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-2 font-semibold text-slate-950 dark:text-white">{value}</div>
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
