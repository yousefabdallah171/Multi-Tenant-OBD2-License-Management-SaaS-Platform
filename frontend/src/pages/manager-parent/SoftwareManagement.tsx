import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Grid2X2, List, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { programService, type ProgramPayload } from '@/services/program.service'
import type { ProgramSummary } from '@/types/manager-parent.types'

interface ProgramFormState {
  name: string
  description: string
  version: string
  download_link: string
  file_size: string
  system_requirements: string
  installation_guide_url: string
  trial_days: string
  base_price: string
  status: 'active' | 'inactive'
  icon: File | null
}

const EMPTY_FORM: ProgramFormState = {
  name: '',
  description: '',
  version: '1.0',
  download_link: '',
  file_size: '',
  system_requirements: '',
  installation_guide_url: '',
  trial_days: '0',
  base_price: '0',
  status: 'active',
  icon: null,
}

function isValidUrl(value: string) {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export function SoftwareManagementPage() {
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(12)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | ''>('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingProgram, setEditingProgram] = useState<ProgramSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProgramSummary | null>(null)
  const [form, setForm] = useState<ProgramFormState>(EMPTY_FORM)

  const programsQuery = useQuery({
    queryKey: ['manager-parent', 'programs', page, perPage, search, status],
    queryFn: () => programService.getAll({ page, per_page: perPage, search, status }),
  })

  const createMutation = useMutation({
    mutationFn: (payload: ProgramPayload) => programService.create(payload),
    onSuccess: () => {
      toast.success('Program created successfully.')
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'programs'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ProgramPayload> }) => programService.update(id, payload),
    onSuccess: () => {
      toast.success('Program updated successfully.')
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'programs'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => programService.delete(id),
    onSuccess: () => {
      toast.success('Program deleted successfully.')
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'programs'] })
    },
  })

  const columns: Array<DataTableColumn<ProgramSummary>> = [
    {
      key: 'program',
      label: 'Program',
      sortable: true,
      sortValue: (row) => row.name,
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.icon ? (
            <img src={row.icon} alt={row.name} className="h-10 w-10 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              {row.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium text-slate-950 dark:text-white">{row.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">v{row.version}</p>
          </div>
        </div>
      ),
    },
    { key: 'price', label: 'Base Price', sortable: true, sortValue: (row) => row.base_price, render: (row) => formatCurrency(row.base_price, 'USD', locale) },
    { key: 'status', label: 'Status', sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
    { key: 'licenses', label: 'Licenses Sold', sortable: true, sortValue: (row) => row.licenses_sold, render: (row) => row.licenses_sold },
    { key: 'createdAt', label: 'Created', sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-') },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteTarget(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  function openEdit(program: ProgramSummary) {
    setEditingProgram(program)
    setForm({
      name: program.name,
      description: program.description ?? '',
      version: program.version,
      download_link: program.download_link,
      file_size: program.file_size ?? '',
      system_requirements: program.system_requirements ?? '',
      installation_guide_url: program.installation_guide_url ?? '',
      trial_days: String(program.trial_days),
      base_price: String(program.base_price),
      status: program.status,
      icon: null,
    })
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingProgram(null)
    setForm(EMPTY_FORM)
  }

  function submitForm() {
    if (form.name.trim().length < 2) {
      toast.error('Program name must be at least 2 characters.')
      return
    }

    if (!isValidUrl(form.download_link)) {
      toast.error('Download link must be a valid URL.')
      return
    }

    if (form.installation_guide_url.trim() && !isValidUrl(form.installation_guide_url.trim())) {
      toast.error('Installation guide must be a valid URL.')
      return
    }

    const basePrice = Number(form.base_price)
    const trialDays = Number(form.trial_days)

    if (Number.isNaN(basePrice) || basePrice < 0 || Number.isNaN(trialDays) || trialDays < 0) {
      toast.error('Base price and trial days must be valid numbers.')
      return
    }

    const payload: ProgramPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      version: form.version.trim() || '1.0',
      download_link: form.download_link.trim(),
      file_size: form.file_size.trim() || null,
      system_requirements: form.system_requirements.trim() || null,
      installation_guide_url: form.installation_guide_url.trim() || null,
      trial_days: trialDays,
      base_price: basePrice,
      status: form.status,
      icon: form.icon,
    }

    if (editingProgram) {
      updateMutation.mutate({
        id: editingProgram.id,
        payload,
      })
      return
    }

    createMutation.mutate(payload)
  }

  const list = programsQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Software Management"
        description="Manage the tenant's programs, pricing defaults, versions, download links, and storefront visibility."
        actions={
          <>
            <Button type="button" variant={view === 'grid' ? 'default' : 'secondary'} onClick={() => setView('grid')}>
              <Grid2X2 className="me-2 h-4 w-4" />
              Grid
            </Button>
            <Button type="button" variant={view === 'table' ? 'default' : 'secondary'} onClick={() => setView('table')}>
              <List className="me-2 h-4 w-4" />
              Table
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditingProgram(null)
                setForm(EMPTY_FORM)
                setFormOpen(true)
              }}
            >
              <Plus className="me-2 h-4 w-4" />
              Add Program
            </Button>
          </>
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
            placeholder="Search programs"
            className="min-w-[220px] flex-1"
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as 'active' | 'inactive' | '')
              setPage(1)
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </CardContent>
      </Card>

      {view === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((program) => (
            <Card key={program.id}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {program.icon ? (
                      <img src={program.icon} alt={program.name} className="h-14 w-14 rounded-3xl object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-100 text-xl font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                        {program.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{program.name}</CardTitle>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Version {program.version}</p>
                    </div>
                  </div>
                  <StatusBadge status={program.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="min-h-12 text-sm text-slate-600 dark:text-slate-300">{program.description || 'No description provided.'}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Base Price</p>
                    <p className="mt-1 font-semibold">{formatCurrency(program.base_price, 'USD', locale)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Trial Days</p>
                    <p className="mt-1 font-semibold">{program.trial_days}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => openEdit(program)}>
                    Edit
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteTarget(program)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={list}
          rowKey={(row) => row.id}
          isLoading={programsQuery.isLoading}
          pagination={{
            page: programsQuery.data?.meta.current_page ?? 1,
            lastPage: programsQuery.data?.meta.last_page ?? 1,
            total: programsQuery.data?.meta.total ?? 0,
            perPage: programsQuery.data?.meta.per_page ?? perPage,
          }}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPerPage(size)
            setPage(1)
          }}
        />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingProgram ? 'Edit Program' : 'Add Program'}</DialogTitle>
            <DialogDescription>{editingProgram ? 'Update the selected program configuration.' : 'Create a new program that your team can activate for customers.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="program-name">Program Name</Label>
              <Input id="program-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-version">Version</Label>
              <Input id="program-version" value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="program-description">Description</Label>
              <Textarea id="program-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="program-download">Download Link</Label>
              <Input id="program-download" value={form.download_link} onChange={(event) => setForm((current) => ({ ...current, download_link: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-file-size">File Size</Label>
              <Input id="program-file-size" value={form.file_size} onChange={(event) => setForm((current) => ({ ...current, file_size: event.target.value }))} placeholder="e.g. 245 MB" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-guide">Installation Guide URL</Label>
              <Input id="program-guide" value={form.installation_guide_url} onChange={(event) => setForm((current) => ({ ...current, installation_guide_url: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="program-requirements">System Requirements</Label>
              <Textarea id="program-requirements" value={form.system_requirements} onChange={(event) => setForm((current) => ({ ...current, system_requirements: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-trial">Trial Days</Label>
              <Input id="program-trial" type="number" value={form.trial_days} onChange={(event) => setForm((current) => ({ ...current, trial_days: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-price">Base Price</Label>
              <Input id="program-price" type="number" step="0.01" value={form.base_price} onChange={(event) => setForm((current) => ({ ...current, base_price: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-icon">Icon Upload</Label>
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <Upload className="h-4 w-4" />
                <span>{form.icon ? form.icon.name : 'Choose image file'}</span>
                <input
                  id="program-icon"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    setForm((current) => ({ ...current, icon: file }))
                  }}
                />
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-status">Status</Label>
              <select
                id="program-status"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as 'active' | 'inactive' }))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="button" onClick={submitForm} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingProgram ? 'Save Changes' : 'Create Program'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title="Delete program?"
        description={deleteTarget ? `The program ${deleteTarget.name} will be removed from this tenant.` : undefined}
        confirmLabel="Delete"
        isDestructive
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id)
          }
        }}
      />
    </div>
  )
}
