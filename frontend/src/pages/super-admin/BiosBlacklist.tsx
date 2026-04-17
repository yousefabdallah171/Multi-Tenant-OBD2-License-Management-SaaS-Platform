import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Plus, Search, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LineChartWidget } from '@/components/charts/LineChartWidget'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { localizeMonthLabel } from '@/lib/chart-labels'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { biosService } from '@/services/bios.service'
import type { BiosBlacklistEntry } from '@/types/super-admin.types'

export function BiosBlacklistPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingReasonFor, setEditingReasonFor] = useState<BiosBlacklistEntry | null>(null)
  const [form, setForm] = useState({ bios_id: '', reason: '' })
  const [submitError, setSubmitError] = useState('')

  const blacklistQuery = useQuery({
    queryKey: ['super-admin', 'bios-blacklist', page, perPage, search, status],
    queryFn: () => biosService.getBlacklist({ page, per_page: perPage, search, status }),
  })

  const statsQuery = useQuery({
    queryKey: ['super-admin', 'bios-blacklist', 'stats'],
    queryFn: () => biosService.getBlacklistStats(),
  })

  const addMutation = useMutation({
    mutationFn: () => biosService.addToBlacklist({
      bios_id: form.bios_id.trim(),
      reason: form.reason.trim(),
    }),
    onSuccess: () => {
      setSubmitError('')
      toast.success(t('superAdmin.pages.biosBlacklist.saveSuccess'))
      setFormOpen(false)
      setEditingReasonFor(null)
      setForm({ bios_id: '', reason: '' })
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'bios-blacklist'] })
    },
    onError: (error: unknown) => {
      const message = resolveApiErrorMessage(error, t('common.error'))
      setSubmitError(message)
      toast.error(message)
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => biosService.removeFromBlacklist(id),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.biosBlacklist.removeSuccess'))
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'bios-blacklist'] })
    },
  })

  const purgeMutation = useMutation({
    mutationFn: (id: number) => biosService.purgeFromBlacklist(id),
    onSuccess: () => {
      toast.success(t('superAdmin.pages.biosBlacklist.purgeSuccess', { defaultValue: 'Entry permanently deleted.' }))
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'bios-blacklist'] })
    },
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => biosService.importBlacklist(file),
    onSuccess: (data) => {
      toast.success(t('superAdmin.pages.biosBlacklist.importSuccess', { count: data.created }))
      void queryClient.invalidateQueries({ queryKey: ['super-admin', 'bios-blacklist'] })
    },
  })

  const columns = useMemo<Array<DataTableColumn<BiosBlacklistEntry>>>(
    () => [
      { key: 'bios', label: t('superAdmin.pages.biosBlacklist.biosId'), sortable: true, sortValue: (row) => row.bios_id, render: (row) => <button type="button" className="text-sky-600 hover:underline dark:text-sky-300" onClick={() => navigate(routePaths.superAdmin.biosDetail(lang, row.bios_id))}><code>{row.bios_id}</code></button> },
      { key: 'tenant', label: t('common.tenant'), sortable: true, sortValue: (row) => row.tenant?.name ?? '', render: (row) => row.tenant?.name ?? 'Global' },
      { key: 'addedBy', label: t('common.addedBy'), sortable: true, sortValue: (row) => row.added_by ?? '', render: (row) => row.added_by ?? '-' },
      { key: 'reason', label: t('common.reason'), sortable: true, sortValue: (row) => row.reason, render: (row) => row.reason || '-' },
      { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
      { key: 'createdAt', label: t('common.createdAt'), sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-') },
      {
        key: 'actions',
        label: t('common.actions'),
        className: 'w-20',
        render: (row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="ghost" aria-label={t('common.actions')}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate(routePaths.superAdmin.biosDetail(lang, row.bios_id))}>
                {t('superAdmin.pages.biosBlacklist.viewHistory')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={row.status === 'removed'}
                onSelect={() => {
                  setSubmitError('')
                  setEditingReasonFor(row)
                  setForm({ bios_id: row.bios_id, reason: row.reason ?? '' })
                  setFormOpen(true)
                }}
              >
                {t('superAdmin.pages.biosBlacklist.editReason', { defaultValue: 'Edit reason' })}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={row.status === 'removed'} onSelect={() => removeMutation.mutate(row.id)}>
                {t('superAdmin.pages.biosBlacklist.remove')}
              </DropdownMenuItem>
              {row.status === 'removed' && (
                <DropdownMenuItem
                  className="text-red-600 dark:text-red-400"
                  onSelect={() => {
                    if (window.confirm(t('superAdmin.pages.biosBlacklist.purgeConfirm', { defaultValue: 'Permanently delete this entry? This cannot be undone.' }))) {
                      purgeMutation.mutate(row.id)
                    }
                  }}
                >
                  {t('superAdmin.pages.biosBlacklist.purge', { defaultValue: 'Delete Permanently' })}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [lang, locale, navigate, purgeMutation, removeMutation, t],
  )
  const trendData = (statsQuery.data?.data ?? []).map((item) => ({
    ...item,
    month: item.month ? localizeMonthLabel(item.month, locale) : item.month,
  }))

  const formErrors = useMemo(() => {
    const next: { bios_id?: string } = {}

    if (!form.bios_id.trim()) {
      next.bios_id = t('validation.required', { defaultValue: 'Field required' })
    }

    return next
  }, [form.bios_id, t])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{t('superAdmin.pages.biosBlacklist.title')}</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('superAdmin.pages.biosBlacklist.description')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]

              if (!file) {
                return
              }

              importMutation.mutate(file)
              event.target.value = ''
            }}
          />
          <Button type="button" variant="secondary" onClick={() => importInputRef.current?.click()}>
            <Upload className="me-2 h-4 w-4" />
            {t('superAdmin.pages.biosBlacklist.import')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void biosService.exportBlacklist()}>
            {t('superAdmin.pages.biosBlacklist.export')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setSubmitError('')
              setEditingReasonFor(null)
              setForm({ bios_id: '', reason: '' })
              setFormOpen(true)
            }}
          >
            <Plus className="me-2 h-4 w-4" />
            {t('superAdmin.pages.biosBlacklist.add')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="ps-10"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder={t('common.search')}
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">{t('common.allStatuses')}</option>
            <option value="active">{t('common.active')}</option>
            <option value="removed">{t('common.removed')}</option>
          </select>
        </CardContent>
      </Card>

      <LineChartWidget
        title={t('superAdmin.pages.biosBlacklist.trendTitle')}
        description={t('superAdmin.pages.biosBlacklist.trendDescription')}
        data={trendData}
        isLoading={statsQuery.isLoading}
        xKey="month"
        series={[
          { key: 'additions', label: t('superAdmin.pages.biosBlacklist.additions') },
          { key: 'removals', label: t('superAdmin.pages.biosBlacklist.removals') },
        ]}
      />

      <DataTable
        tableKey="super_admin_bios_blacklist"
        columns={columns}
        data={blacklistQuery.data?.data ?? []}
        rowKey={(row) => row.id}
        isLoading={blacklistQuery.isLoading}
        pagination={{
          page: blacklistQuery.data?.meta.current_page ?? 1,
          lastPage: blacklistQuery.data?.meta.last_page ?? 1,
          total: blacklistQuery.data?.meta.total ?? 0,
          perPage: blacklistQuery.data?.meta.per_page ?? perPage,
        }}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPerPage(nextPageSize)
          setPage(1)
        }}
      />

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setSubmitError('')
            setEditingReasonFor(null)
            setForm({ bios_id: '', reason: '' })
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingReasonFor
                ? t('superAdmin.pages.biosBlacklist.editReasonTitle', { defaultValue: 'Edit blacklist reason' })
                : t('superAdmin.pages.biosBlacklist.addTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingReasonFor
                ? t('superAdmin.pages.biosBlacklist.editReasonDescription', { defaultValue: 'Update the reason stored for this blocked BIOS identifier.' })
                : t('superAdmin.pages.biosBlacklist.formDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {submitError ? (
              <div aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                {submitError}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="bios-id">{t('superAdmin.pages.biosBlacklist.biosId')}</Label>
              <Input
                id="bios-id"
                value={form.bios_id}
                readOnly={editingReasonFor !== null}
                aria-invalid={Boolean(formErrors.bios_id)}
                aria-describedby={formErrors.bios_id ? 'bios-id-error' : undefined}
                onChange={(event) => setForm((current) => ({ ...current, bios_id: event.target.value }))}
              />
              {formErrors.bios_id ? <p id="bios-id-error" className="text-sm text-rose-600 dark:text-rose-400">{formErrors.bios_id}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bios-reason">{t('common.reason')}</Label>
              <Textarea id="bios-reason" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setSubmitError('')

                if (formErrors.bios_id) {
                  toast.error(formErrors.bios_id ?? t('common.error'))
                  return
                }

                addMutation.mutate()
              }}
              disabled={addMutation.isPending}
            >
              {addMutation.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
