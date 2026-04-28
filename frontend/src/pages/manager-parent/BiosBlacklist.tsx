import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { resolveApiErrorMessage } from '@/lib/api-errors'
import { formatDate } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { tenantBiosService } from '@/services/tenant-bios.service'
import type { BiosBlacklistEntry } from '@/types/super-admin.types'

export function BiosBlacklistPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingReasonFor, setEditingReasonFor] = useState<BiosBlacklistEntry | null>(null)
  const [form, setForm] = useState({ bios_id: '', reason: '' })
  const [submitError, setSubmitError] = useState('')

  const blacklistQuery = useQuery({
    queryKey: ['manager-parent', 'bios-blacklist', page, perPage, search, status],
    queryFn: () => tenantBiosService.getBlacklist({ page, per_page: perPage, search, status }),
  })

  const addMutation = useMutation({
    mutationFn: () => tenantBiosService.addToBlacklist({
      bios_id: form.bios_id.trim(),
      reason: form.reason.trim(),
    }),
    onSuccess: () => {
      setSubmitError('')
      toast.success(t('managerParent.pages.biosBlacklist.saveSuccess'))
      setFormOpen(false)
      setEditingReasonFor(null)
      setForm({ bios_id: '', reason: '' })
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'bios-blacklist'] })
    },
    onError: (error: unknown) => {
      const message = resolveApiErrorMessage(error, t('common.error'))
      setSubmitError(message)
      toast.error(message)
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => tenantBiosService.removeFromBlacklist(id),
    onSuccess: () => {
      toast.success(t('managerParent.pages.biosBlacklist.removeSuccess'))
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'bios-blacklist'] })
    },
  })

  const columns = useMemo<Array<DataTableColumn<BiosBlacklistEntry>>>(
    () => [
      { key: 'bios', label: t('managerParent.pages.biosBlacklist.biosId'), sortable: true, sortValue: (row) => row.bios_id, render: (row) => <button type="button" className="text-sky-600 hover:underline dark:text-sky-300" onClick={() => navigate(routePaths.managerParent.biosDetail(lang, row.bios_id))}><code>{row.bios_id}</code></button> },
      { key: 'addedBy', label: t('common.addedBy'), sortable: true, sortValue: (row) => row.added_by ?? '', render: (row) => row.added_by ?? '-' },
      { key: 'reason', label: t('common.reason'), sortable: true, sortValue: (row) => row.reason, render: (row) => row.reason || '-' },
      { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
      { key: 'createdAt', label: t('common.createdAt'), sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-') },
      {
        key: 'actions',
        label: t('common.actions'),
        render: (row) => (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => navigate(routePaths.managerParent.biosDetail(lang, row.bios_id))}>
              {t('managerParent.pages.biosBlacklist.history')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={row.status === 'removed'}
              onClick={() => {
                setSubmitError('')
                setEditingReasonFor(row)
                setForm({ bios_id: row.bios_id, reason: row.reason ?? '' })
                setFormOpen(true)
              }}
            >
              {t('managerParent.pages.biosBlacklist.editReason', { defaultValue: 'Edit reason' })}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={row.status === 'removed'} onClick={() => removeMutation.mutate(row.id)}>
              {t('managerParent.pages.biosBlacklist.remove')}
            </Button>
          </div>
        ),
      },
    ],
    [lang, locale, navigate, removeMutation, t],
  )

  const formErrors = useMemo(() => {
    const next: { bios_id?: string } = {}

    if (!form.bios_id.trim()) {
      next.bios_id = t('validation.required', { defaultValue: 'Field required' })
    }

    return next
  }, [form.bios_id, t])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('managerParent.pages.biosBlacklist.title')}
        description={t('managerParent.pages.biosBlacklist.description')}
        actions={
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
            {t('managerParent.pages.biosBlacklist.add')}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('managerParent.pages.biosBlacklist.searchPlaceholder')}
            className="min-w-[220px] flex-1"
          />
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

      <DataTable
        tableKey="manager_parent_bios_blacklist"
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
        onPageSizeChange={(size) => {
          setPerPage(size)
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
                ? t('managerParent.pages.biosBlacklist.editReasonTitle', { defaultValue: 'Edit blacklist reason' })
                : t('managerParent.pages.biosBlacklist.addTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingReasonFor
                ? t('managerParent.pages.biosBlacklist.editReasonDescription', { defaultValue: 'Update the reason stored for this blocked BIOS identifier.' })
                : t('managerParent.pages.biosBlacklist.formDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {submitError ? (
              <div aria-live="polite" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                {submitError}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="blacklist-bios-id">{t('managerParent.pages.biosBlacklist.biosId')}</Label>
              <Input
                id="blacklist-bios-id"
                value={form.bios_id}
                readOnly={editingReasonFor !== null}
                aria-invalid={Boolean(formErrors.bios_id)}
                aria-describedby={formErrors.bios_id ? 'blacklist-bios-id-error' : undefined}
                onChange={(event) => setForm((current) => ({ ...current, bios_id: event.target.value }))}
              />
              {formErrors.bios_id ? <p id="blacklist-bios-id-error" className="text-sm text-rose-600 dark:text-rose-400">{formErrors.bios_id}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="blacklist-reason">{t('common.reason')}</Label>
              <Textarea id="blacklist-reason" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
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
                  toast.error(formErrors.bios_id ?? t('managerParent.pages.biosBlacklist.validationRequired'))
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
