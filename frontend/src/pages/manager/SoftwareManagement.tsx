import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/utils'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'
import type { ManagerSoftwareProgram } from '@/types/manager-reseller.types'

interface ProgramFormState {
  name: string
  description: string
  version: string
  download_link: string
  file_size: string
  system_requirements: string
  installation_guide_url: string
  base_price: string
  icon: string
  external_api_key: string
  external_software_id: string
  active: boolean
}

interface ActivationFormState {
  username: string
  bios_id: string
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
  icon: '',
  external_api_key: '',
  external_software_id: '',
  active: true,
}

const EMPTY_ACTIVATION: ActivationFormState = {
  username: '',
  bios_id: '',
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
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(12)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | 'active' | 'inactive'>('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingProgram, setEditingProgram] = useState<ManagerSoftwareProgram | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ManagerSoftwareProgram | null>(null)
  const [activationTarget, setActivationTarget] = useState<ManagerSoftwareProgram | null>(null)
  const [form, setForm] = useState<ProgramFormState>(EMPTY_FORM)
  const [activationForm, setActivationForm] = useState<ActivationFormState>(EMPTY_ACTIVATION)
  const [showApiKey, setShowApiKey] = useState(false)

  const programsQuery = useQuery({
    queryKey: ['manager', 'software-management', page, perPage, search, status],
    queryFn: () => managerService.getSoftwarePrograms({ page, per_page: perPage, search, status }),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      managerService.createProgram({
        name: form.name.trim(),
        description: form.description.trim() || null,
        version: form.version.trim() || '1.0',
        download_link: form.download_link.trim(),
        file_size: form.file_size.trim() || null,
        system_requirements: form.system_requirements.trim() || null,
        installation_guide_url: form.installation_guide_url.trim() || null,
        base_price: Number(form.base_price),
        icon: form.icon.trim() || null,
        external_api_key: form.external_api_key.trim() || null,
        external_software_id: form.external_software_id.trim() ? Number(form.external_software_id) : null,
        active: form.active,
      }),
    onSuccess: () => {
      toast.success(t('manager.pages.softwareManagement.createSuccess'))
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ['manager', 'software-management'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) => managerService.updateProgram(id, payload),
    onSuccess: () => {
      toast.success(t('manager.pages.softwareManagement.updateSuccess'))
      closeForm()
      void queryClient.invalidateQueries({ queryKey: ['manager', 'software-management'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => managerService.deleteProgram(id),
    onSuccess: () => {
      toast.success(t('manager.pages.softwareManagement.deleteSuccess'))
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['manager', 'software-management'] })
    },
  })

  const activateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ActivationFormState }) => managerService.activateProgram(id, payload),
    onSuccess: () => {
      toast.success(t('manager.pages.softwareManagement.activateSuccess'))
      setActivationTarget(null)
      setActivationForm(EMPTY_ACTIVATION)
      void queryClient.invalidateQueries({ queryKey: ['manager', 'software-management'] })
    },
    onError: () => {
      toast.error(t('manager.pages.softwareManagement.activateError'))
    },
  })

  function closeForm() {
    setFormOpen(false)
    setEditingProgram(null)
    setForm(EMPTY_FORM)
  }

  function submitForm() {
    if (form.name.trim().length < 2) {
      toast.error(t('manager.pages.softwareManagement.nameValidation'))
      return
    }

    if (!isValidUrl(form.download_link.trim())) {
      toast.error(t('manager.pages.softwareManagement.downloadValidation'))
      return
    }

    if (form.installation_guide_url.trim() && !isValidUrl(form.installation_guide_url.trim())) {
      toast.error(t('manager.pages.softwareManagement.guideValidation'))
      return
    }

    if (form.icon.trim() && !isValidUrl(form.icon.trim())) {
      toast.error(t('manager.pages.softwareManagement.iconValidation'))
      return
    }

    const basePrice = Number(form.base_price)

    if (Number.isNaN(basePrice) || basePrice < 0) {
      toast.error(t('manager.pages.softwareManagement.numberValidation'))
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

    const payload: Record<string, unknown> & { external_api_key?: string } = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      version: form.version.trim() || '1.0',
      download_link: form.download_link.trim(),
      file_size: form.file_size.trim() || null,
      system_requirements: form.system_requirements.trim() || null,
      installation_guide_url: form.installation_guide_url.trim() || null,
      base_price: basePrice,
      icon: form.icon.trim() || null,
      external_software_id: form.external_software_id.trim() ? Number(form.external_software_id) : null,
      active: form.active,
    }

    if (form.external_api_key.trim()) {
      payload.external_api_key = form.external_api_key.trim()
    }

    if (editingProgram) {
      updateMutation.mutate({ id: editingProgram.id, payload })
      return
    }

    createMutation.mutate()
  }

  function handleStatusToggle(program: ManagerSoftwareProgram, nextValue: boolean) {
    if (nextValue) {
      setActivationTarget(program)
      return
    }

    updateMutation.mutate({
      id: program.id,
      payload: {
        status: 'inactive',
        active: false,
      },
    })
  }

  function submitActivation() {
    if (!activationTarget) {
      return
    }

    if (!activationForm.username.trim() || !activationForm.bios_id.trim()) {
      toast.error(t('manager.pages.softwareManagement.activationValidation'))
      return
    }

    activateMutation.mutate({
      id: activationTarget.id,
      payload: {
        username: activationForm.username.trim(),
        bios_id: activationForm.bios_id.trim(),
      },
    })
  }

  const programs = programsQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold">{t('manager.pages.softwareManagement.title')}</h2>
          <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('manager.pages.softwareManagement.description')}</p>
        </div>
        <Button type="button" onClick={() => navigate(routePaths.manager.programCreate(lang))}>
          <Plus className="me-2 h-4 w-4" />
          {t('manager.pages.softwareManagement.addProgram')}
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_220px]">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t('manager.pages.softwareManagement.searchPlaceholder')}
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as '' | 'active' | 'inactive')
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

      {programsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : null}

      {!programsQuery.isLoading && programs.length === 0 ? (
        <EmptyState title={t('manager.pages.softwareManagement.emptyTitle')} description={t('manager.pages.softwareManagement.emptyDescription')} />
      ) : null}

      {!programsQuery.isLoading && programs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((program) => (
            <Card key={program.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{program.name}</CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('manager.pages.softwareManagement.version')} {program.version}
                    </p>
                  </div>
                  <StatusBadge status={program.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="line-clamp-2 min-h-10 text-sm text-slate-600 dark:text-slate-300">{program.description || t('manager.pages.softwareManagement.noDescription')}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                    <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t('manager.pages.softwareManagement.price')}</p>
                    <p className="font-semibold">{formatCurrency(program.base_price, 'USD', locale)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                    <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t('software.externalSoftwareId')}</p>
                    <p className="font-semibold">{program.external_software_id ?? '-'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/40">
                    <p className="text-xs uppercase text-slate-500 dark:text-slate-400">{t('software.externalApiKey')}</p>
                    <p className={`font-semibold ${program.has_external_api ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>
                      {program.has_external_api ? t('software.apiConfigured') : t('software.apiNotConfigured')}
                    </p>
                  </div>
                </div>
                <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                  <span>{t('manager.pages.softwareManagement.activeToggle')}</span>
                  <input
                    type="checkbox"
                    checked={program.status === 'active'}
                    onChange={(event) => handleStatusToggle(program, event.target.checked)}
                    disabled={updateMutation.isPending || activateMutation.isPending}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`${routePaths.manager.customerCreate(lang)}?program_id=${program.id}`)}
                  >
                    {t('common.activate')}
                  </Button>
                  <Button type="button" size="sm" onClick={() => navigate(routePaths.manager.programEdit(lang, program.id))}>
                    {t('common.edit')}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setDeleteTarget(program)}>
                    {t('common.delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {programsQuery.data?.meta ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-500 dark:text-slate-400">
            <span>{t('common.totalCount', { count: programsQuery.data.meta.total })}</span>
            <div className="flex items-center gap-3">
              <select
                value={programsQuery.data.meta.per_page ?? perPage}
                onChange={(event) => {
                  setPerPage(Number(event.target.value))
                  setPage(1)
                }}
                className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {[12, 24, 36].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  {t('common.previous')}
                </Button>
                <span>
                  {programsQuery.data.meta.current_page} / {programsQuery.data.meta.last_page}
                </span>
                <Button type="button" variant="ghost" size="sm" disabled={page >= programsQuery.data.meta.last_page} onClick={() => setPage((current) => current + 1)}>
                  {t('common.next')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingProgram ? t('manager.pages.softwareManagement.editProgram') : t('manager.pages.softwareManagement.addProgram')}</DialogTitle>
            <DialogDescription>{editingProgram ? t('manager.pages.softwareManagement.editDescription') : t('manager.pages.softwareManagement.formDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="program-name">{t('manager.pages.softwareManagement.programName')}</Label>
              <Input id="program-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-version">{t('manager.pages.softwareManagement.version')}</Label>
              <Input id="program-version" value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="program-description">{t('manager.pages.softwareManagement.programDescription')}</Label>
              <Textarea id="program-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="program-download">{t('manager.pages.softwareManagement.downloadLink')}</Label>
              <Input id="program-download" type="url" value={form.download_link} onChange={(event) => setForm((current) => ({ ...current, download_link: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="program-price">{t('manager.pages.softwareManagement.price')}</Label>
              <Input id="program-price" type="number" step="0.01" value={form.base_price} onChange={(event) => setForm((current) => ({ ...current, base_price: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="program-icon">{t('manager.pages.softwareManagement.iconUrl')}</Label>
              <Input id="program-icon" type="url" value={form.icon} onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))} />
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
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeForm}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={submitForm} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? t('common.saving') : editingProgram ? t('manager.pages.softwareManagement.saveChanges') : t('manager.pages.softwareManagement.createProgram')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activationTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActivationTarget(null)
            setActivationForm(EMPTY_ACTIVATION)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('manager.pages.softwareManagement.activationTitle')}</DialogTitle>
            <DialogDescription>{t('manager.pages.softwareManagement.activationDescription', { name: activationTarget?.name ?? '' })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activation-username">{t('manager.pages.softwareManagement.customerUsername')}</Label>
              <Input id="activation-username" value={activationForm.username} onChange={(event) => setActivationForm((current) => ({ ...current, username: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activation-bios">{t('manager.pages.softwareManagement.customerBiosId')}</Label>
              <Input id="activation-bios" value={activationForm.bios_id} onChange={(event) => setActivationForm((current) => ({ ...current, bios_id: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setActivationTarget(null)
                setActivationForm(EMPTY_ACTIVATION)
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={submitActivation} disabled={activateMutation.isPending}>
              {activateMutation.isPending ? t('common.saving') : t('manager.pages.softwareManagement.registerNow')}
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
        title={t('manager.pages.softwareManagement.deleteProgramTitle')}
        description={deleteTarget ? t('manager.pages.softwareManagement.deleteProgramDescription', { name: deleteTarget.name }) : undefined}
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
