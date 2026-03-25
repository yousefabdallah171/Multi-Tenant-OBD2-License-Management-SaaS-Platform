import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Grid2X2, List, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
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
import { routePaths } from '@/router/routes'
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
  base_price: string
  external_api_key: string
  external_software_id: string
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
  base_price: '0',
  external_api_key: '',
  external_software_id: '',
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
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { lang } = useLanguage()
  const navigate = useNavigate()
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
  const [showApiKey, setShowApiKey] = useState(false)

  const programsQuery = useQuery({
    queryKey: ['manager-parent', 'programs', page, perPage, search, status],
    queryFn: () => programService.getAll({ page, per_page: perPage, search, status }),
  })

  const createMutation = useMutation({
    mutationFn: (payload: ProgramPayload) => programService.create(payload),
    onSuccess: () => {
      toast.success(t('managerParent.pages.softwareManagement.createSuccess'))
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'programs'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ProgramPayload> }) => programService.update(id, payload),
    onSuccess: () => {
      toast.success(t('managerParent.pages.softwareManagement.updateSuccess'))
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'programs'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => programService.delete(id),
    onSuccess: () => {
      toast.success(t('managerParent.pages.softwareManagement.deleteSuccess'))
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'programs'] })
    },
  })

  const columns: Array<DataTableColumn<ProgramSummary>> = [
    {
      key: 'program',
      label: t('common.program'),
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
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('managerParent.pages.softwareManagement.version')} {row.version}</p>
          </div>
        </div>
      ),
    },
    { key: 'price', label: t('managerParent.pages.softwareManagement.basePrice'), sortable: true, sortValue: (row) => row.base_price, render: (row) => formatCurrency(row.base_price, 'USD', locale) },
    { key: 'status', label: t('common.status'), sortable: true, sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
    { key: 'licenses', label: t('managerParent.pages.softwareManagement.licensesSold'), sortable: true, sortValue: (row) => row.licenses_sold, render: (row) => row.licenses_sold },
    { key: 'createdAt', label: t('common.createdAt'), sortable: true, sortValue: (row) => row.created_at ?? '', render: (row) => (row.created_at ? formatDate(row.created_at, locale) : '-') },
    {
      key: 'actions',
      label: t('common.actions'),
      render: (row) => (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => navigate(`${routePaths.managerParent.customerCreate(lang)}?program_id=${row.id}`)}
          >
            {t('common.activate')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => navigate(routePaths.managerParent.programEdit(lang, row.id))}>
            {t('common.edit')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteTarget(row)}>
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ]

  function closeForm() {
    setFormOpen(false)
    setEditingProgram(null)
    setForm(EMPTY_FORM)
  }

  function submitForm() {
    if (form.name.trim().length < 2) {
      toast.error(t('managerParent.pages.softwareManagement.nameValidation'))
      return
    }

    if (!isValidUrl(form.download_link)) {
      toast.error(t('managerParent.pages.softwareManagement.downloadValidation'))
      return
    }

    if (form.installation_guide_url.trim() && !isValidUrl(form.installation_guide_url.trim())) {
      toast.error(t('managerParent.pages.softwareManagement.installationGuideValidation'))
      return
    }

    const basePrice = Number(form.base_price)

    if (Number.isNaN(basePrice) || basePrice < 0) {
      toast.error(t('managerParent.pages.softwareManagement.numberValidation'))
      return
    }

    if (!editingProgram && !form.external_api_key.trim()) {
      toast.error(t('software.externalApiKeyRequired'))
      return
    }

    if (!editingProgram && !form.external_software_id.trim()) {
      toast.error(t('software.externalSoftwareIdRequired'))
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
      base_price: basePrice,
      external_software_id: form.external_software_id.trim() ? Number(form.external_software_id) : null,
      status: form.status,
      icon: form.icon,
    }

    if (form.external_api_key.trim()) {
      payload.external_api_key = form.external_api_key.trim()
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
        title={t('managerParent.pages.softwareManagement.title')}
        description={t('managerParent.pages.softwareManagement.description')}
        actions={
          <>
            <Button type="button" variant={view === 'grid' ? 'default' : 'secondary'} onClick={() => setView('grid')}>
              <Grid2X2 className="me-2 h-4 w-4" />
              {t('managerParent.pages.softwareManagement.grid')}
            </Button>
            <Button type="button" variant={view === 'table' ? 'default' : 'secondary'} onClick={() => setView('table')}>
              <List className="me-2 h-4 w-4" />
              {t('managerParent.pages.softwareManagement.table')}
            </Button>
            <Button type="button" onClick={() => navigate(routePaths.managerParent.programCreate(lang))}>
              <Plus className="me-2 h-4 w-4" />
              {t('managerParent.pages.softwareManagement.addProgram')}
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
            placeholder={t('managerParent.pages.softwareManagement.searchPlaceholder')}
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
            <option value="">{t('common.allStatuses')}</option>
            <option value="active">{t('common.active')}</option>
            <option value="inactive">{t('common.inactive')}</option>
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
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('managerParent.pages.softwareManagement.version')} {program.version}</p>
                    </div>
                  </div>
                  <StatusBadge status={program.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="min-h-12 text-sm text-slate-600 dark:text-slate-300">{program.description || t('managerParent.pages.softwareManagement.noDescription')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('managerParent.pages.softwareManagement.basePrice')}</p>
                    <p className="mt-1 font-semibold">{formatCurrency(program.base_price, 'USD', locale)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('software.externalSoftwareId')}</p>
                    <p className="mt-1 font-semibold">{program.external_software_id ?? '-'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('software.externalApiKey')}</p>
                    <p className={`mt-1 font-semibold ${program.has_external_api ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
                      {program.has_external_api ? t('software.apiConfigured') : t('software.apiNotConfigured')}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`${routePaths.managerParent.customerCreate(lang)}?program_id=${program.id}`)}
                  >
                    {t('common.activate')}
                  </Button>
                  <Button type="button" size="sm" onClick={() => navigate(routePaths.managerParent.programEdit(lang, program.id))}>
                    {t('common.edit')}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setDeleteTarget(program)}>
                    {t('common.delete')}
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
            <DialogTitle>{editingProgram ? t('managerParent.pages.softwareManagement.editProgram') : t('managerParent.pages.softwareManagement.addProgram')}</DialogTitle>
            <DialogDescription>{editingProgram ? t('managerParent.pages.softwareManagement.editDescription') : t('managerParent.pages.softwareManagement.formDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="program-name">{t('managerParent.pages.softwareManagement.programName')}</Label>
              <Input id="program-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-version">{t('managerParent.pages.softwareManagement.version')}</Label>
              <Input id="program-version" value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="program-description">{t('managerParent.pages.softwareManagement.programDescription')}</Label>
              <Textarea id="program-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="program-download">{t('managerParent.pages.softwareManagement.downloadLink')}</Label>
              <Input id="program-download" value={form.download_link} onChange={(event) => setForm((current) => ({ ...current, download_link: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-file-size">{t('managerParent.pages.softwareManagement.fileSize')}</Label>
              <Input id="program-file-size" value={form.file_size} onChange={(event) => setForm((current) => ({ ...current, file_size: event.target.value }))} placeholder={t('managerParent.pages.softwareManagement.fileSizePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-guide">{t('managerParent.pages.softwareManagement.installationGuideUrl')}</Label>
              <Input id="program-guide" value={form.installation_guide_url} onChange={(event) => setForm((current) => ({ ...current, installation_guide_url: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="program-requirements">{t('managerParent.pages.softwareManagement.systemRequirements')}</Label>
              <Textarea id="program-requirements" value={form.system_requirements} onChange={(event) => setForm((current) => ({ ...current, system_requirements: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-price">{t('managerParent.pages.softwareManagement.basePrice')}</Label>
              <Input id="program-price" type="number" step="0.01" value={form.base_price} onChange={(event) => setForm((current) => ({ ...current, base_price: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-external-id">{t('software.externalSoftwareId')}</Label>
              <Input
                id="program-external-id"
                type="number"
                min={1}
                value={form.external_software_id}
                placeholder="e.g. 8"
                onChange={(event) => setForm((current) => ({ ...current, external_software_id: event.target.value }))}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('software.softwareIdUrlHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-api-key">{t('software.externalApiKey')}</Label>
              <div className="flex gap-2">
                <Input
                  id="program-api-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={form.external_api_key}
                  maxLength={50}
                  placeholder={editingProgram?.has_external_api ? 'Leave blank to keep current key (••••••••••••••)' : 'e.g. YOUR_EXTERNAL_API_KEY'}
                  onChange={(event) => setForm((current) => ({ ...current, external_api_key: event.target.value }))}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowApiKey((value) => !value)}>
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('software.apiKeyHint')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('software.apiKeyUrlHint')}</p>
              {editingProgram?.has_external_api ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-300">{t('software.apiConfigured')}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-icon">{t('managerParent.pages.softwareManagement.iconUpload')}</Label>
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <Upload className="h-4 w-4" />
                <span>{form.icon ? form.icon.name : t('managerParent.pages.softwareManagement.chooseImageFile')}</span>
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
              <Label htmlFor="program-status">{t('common.status')}</Label>
              <select
                id="program-status"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as 'active' | 'inactive' }))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="active">{t('common.active')}</option>
                <option value="inactive">{t('common.inactive')}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeForm}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={submitForm} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? t('common.saving') : editingProgram ? t('managerParent.pages.softwareManagement.saveChanges') : t('managerParent.pages.softwareManagement.createProgram')}
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
        title={t('managerParent.pages.softwareManagement.deleteProgramTitle')}
        description={deleteTarget ? t('managerParent.pages.softwareManagement.deleteProgramDescription', { name: deleteTarget.name }) : undefined}
        confirmLabel={t('common.delete')}
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
