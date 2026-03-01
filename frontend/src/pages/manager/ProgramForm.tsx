import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLanguage } from '@/hooks/useLanguage'
import { routePaths } from '@/router/routes'
import { managerService } from '@/services/manager.service'
import { programService } from '@/services/program.service'
import type { CreateManagerSoftwareData } from '@/types/manager-reseller.types'

interface FormState {
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
  icon: string
  external_api_key: string
  external_software_id: string
}

const EMPTY_FORM: FormState = {
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
  icon: '',
  external_api_key: '',
  external_software_id: '',
}

export function ProgramFormPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const editingId = id ? Number(id) : null
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasConfiguredApi, setHasConfiguredApi] = useState(false)

  const programQuery = useQuery({
    queryKey: ['manager', 'program-form', editingId],
    queryFn: () => programService.getById(editingId ?? 0),
    enabled: editingId !== null,
  })

  useEffect(() => {
    if (!programQuery.data?.data) {
      return
    }

    const program = programQuery.data.data
    setHasConfiguredApi(Boolean(program.has_external_api))
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
      icon: program.icon ?? '',
      external_api_key: '',
      external_software_id: program.external_software_id ? String(program.external_software_id) : '',
    })
  }, [programQuery.data])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: CreateManagerSoftwareData = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        version: form.version.trim() || '1.0',
        download_link: form.download_link.trim(),
        file_size: form.file_size.trim() || null,
        system_requirements: form.system_requirements.trim() || null,
        installation_guide_url: form.installation_guide_url.trim() || null,
        trial_days: Number(form.trial_days),
        base_price: Number(form.base_price),
        icon: form.icon.trim() || null,
        active: form.status === 'active',
        external_software_id: form.external_software_id.trim() ? Number(form.external_software_id) : null,
      }

      if (form.external_api_key.trim()) {
        payload.external_api_key = form.external_api_key.trim()
      }

      if (editingId) {
        return managerService.updateProgram(editingId, payload)
      }

      return managerService.createProgram(payload)
    },
    onSuccess: () => {
      toast.success(editingId ? t('manager.pages.softwareManagement.updateSuccess') : t('manager.pages.softwareManagement.createSuccess'))
      navigate(routePaths.manager.softwareManagement(lang))
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={editingId ? t('manager.pages.softwareManagement.editProgram') : t('manager.pages.softwareManagement.addProgram')}
        description={editingId ? t('manager.pages.softwareManagement.editDescription') : t('manager.pages.softwareManagement.formDescription')}
        actions={(
          <Button type="button" variant="outline" onClick={() => navigate(routePaths.manager.softwareManagement(lang))}>
            {t('common.back')}
          </Button>
        )}
      />

      <Card>
        <CardContent className="grid gap-6 p-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label={t('manager.pages.softwareManagement.programName')}><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
            <Field label={t('manager.pages.softwareManagement.version')}><Input value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))} /></Field>
            <Field label={t('manager.pages.softwareManagement.programDescription')}><Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
            <Field label={t('manager.pages.softwareManagement.downloadLink')}><Input value={form.download_link} onChange={(event) => setForm((current) => ({ ...current, download_link: event.target.value }))} /></Field>
            <Field label={t('manager.pages.softwareManagement.iconUrl')}><Input value={form.icon} onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))} /></Field>
            <Field label={t('manager.pages.softwareManagement.fileSize')}><Input value={form.file_size} onChange={(event) => setForm((current) => ({ ...current, file_size: event.target.value }))} /></Field>
            <Field label={t('manager.pages.softwareManagement.systemRequirements')}><Textarea value={form.system_requirements} onChange={(event) => setForm((current) => ({ ...current, system_requirements: event.target.value }))} /></Field>
          </div>

          <div className="space-y-4">
            <Field label={t('manager.pages.softwareManagement.trialDays')}><Input type="number" min={0} value={form.trial_days} onChange={(event) => setForm((current) => ({ ...current, trial_days: event.target.value }))} /></Field>
            <Field label={t('manager.pages.softwareManagement.price')}><Input type="number" min={0} step="0.01" value={form.base_price} onChange={(event) => setForm((current) => ({ ...current, base_price: event.target.value }))} /></Field>
            <Field label={t('common.status')}>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as 'active' | 'inactive' }))} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="active">{t('common.active')}</option>
                <option value="inactive">{t('common.inactive')}</option>
              </select>
            </Field>
            <Field label={t('software.externalSoftwareId')}>
              <Input type="number" min={1} placeholder="e.g. 8" value={form.external_software_id} onChange={(event) => setForm((current) => ({ ...current, external_software_id: event.target.value }))} />
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('software.softwareIdUrlHint')}</p>
            </Field>
            <Field label={t('software.externalApiKey')}>
              <div className="flex gap-2">
                <Input type={showApiKey ? 'text' : 'password'} maxLength={50} placeholder={editingId ? t('software.apiKeyReplacePlaceholder') : 'e.g. YOUR_EXTERNAL_API_KEY'} value={form.external_api_key} onChange={(event) => setForm((current) => ({ ...current, external_api_key: event.target.value }))} />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowApiKey((value) => !value)}>
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('software.apiKeyHint')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('software.apiKeyUrlHint')}</p>
              {editingId && hasConfiguredApi ? <p className="text-xs text-emerald-600 dark:text-emerald-300">{t('software.apiConfigured')}</p> : null}
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => navigate(routePaths.manager.softwareManagement(lang))}>
          {t('common.cancel')}
        </Button>
        <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : editingId ? t('manager.pages.softwareManagement.saveChanges') : t('manager.pages.softwareManagement.createProgram')}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
