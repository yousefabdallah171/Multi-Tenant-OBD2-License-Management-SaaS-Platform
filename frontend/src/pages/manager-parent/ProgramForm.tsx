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
import { programService, type ProgramPayload } from '@/services/program.service'

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
  external_api_key: string
  external_software_id: string
  external_api_base_url: string
  external_logs_endpoint: string
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
  external_api_key: '',
  external_software_id: '',
  external_api_base_url: '',
  external_logs_endpoint: 'apilogs',
}

export function ProgramFormPage() {
  const { t } = useTranslation()
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const editingId = id ? Number(id) : null
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showApiKey, setShowApiKey] = useState(false)
  const [showApiBaseUrl, setShowApiBaseUrl] = useState(false)
  const [hasConfiguredApi, setHasConfiguredApi] = useState(false)

  const programQuery = useQuery({
    queryKey: ['manager-parent', 'program-form', editingId],
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
      version: program.version ?? '1.0',
      download_link: program.download_link,
      file_size: program.file_size ?? '',
      system_requirements: program.system_requirements ?? '',
      installation_guide_url: program.installation_guide_url ?? '',
      trial_days: String(program.trial_days ?? 0),
      base_price: String(program.base_price ?? 0),
      status: program.status,
      external_api_key: '',
      external_software_id: program.external_software_id ? String(program.external_software_id) : '',
      external_api_base_url: '',
      external_logs_endpoint: program.external_logs_endpoint || 'apilogs',
    })
  }, [programQuery.data])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!editingId && !form.external_api_base_url.trim()) {
        throw new Error(t('software.externalApiBaseUrlRequired'))
      }

      const trialDays = Number(form.trial_days)
      const basePrice = Number(form.base_price)
      const parsedExternalSoftwareId = form.external_software_id.trim() ? Number(form.external_software_id) : NaN

      const payload: ProgramPayload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        version: form.version.trim() || '1.0',
        download_link: form.download_link.trim(),
        file_size: form.file_size.trim() || null,
        system_requirements: form.system_requirements.trim() || null,
        installation_guide_url: form.installation_guide_url.trim() || null,
        trial_days: Number.isFinite(trialDays) ? trialDays : 0,
        base_price: Number.isFinite(basePrice) ? basePrice : 0,
        status: form.status,
        external_software_id: Number.isFinite(parsedExternalSoftwareId) && parsedExternalSoftwareId > 0 ? parsedExternalSoftwareId : null,
        external_logs_endpoint: form.external_logs_endpoint.trim() || 'apilogs',
      }

      if (form.external_api_key.trim()) {
        payload.external_api_key = form.external_api_key.trim()
      }

      if (form.external_api_base_url.trim()) {
        payload.external_api_base_url = form.external_api_base_url.trim()
      }

      if (editingId) {
        return programService.update(editingId, payload)
      }

      return programService.create(payload)
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t('common.tryAgain'))
    },
    onSuccess: () => {
      toast.success(editingId ? t('managerParent.pages.softwareManagement.updateSuccess') : t('managerParent.pages.softwareManagement.createSuccess'))
      navigate(routePaths.managerParent.softwareManagement(lang))
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={editingId ? t('managerParent.pages.softwareManagement.editProgram') : t('managerParent.pages.softwareManagement.addProgram')}
        description={editingId ? t('managerParent.pages.softwareManagement.editDescription') : t('managerParent.pages.softwareManagement.formDescription')}
        actions={(
          <Button type="button" variant="outline" onClick={() => navigate(routePaths.managerParent.softwareManagement(lang))}>
            {t('common.back')}
          </Button>
        )}
      />

      <Card>
        <CardContent className="grid gap-6 p-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label={t('managerParent.pages.softwareManagement.programName')}><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></Field>
            <Field label={t('managerParent.pages.softwareManagement.version')}><Input value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))} /></Field>
            <Field label={t('managerParent.pages.softwareManagement.programDescription')}><Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></Field>
            <Field label={t('managerParent.pages.softwareManagement.downloadLink')}><Input value={form.download_link} onChange={(event) => setForm((current) => ({ ...current, download_link: event.target.value }))} /></Field>
            <Field label={t('managerParent.pages.softwareManagement.fileSize')}><Input value={form.file_size} onChange={(event) => setForm((current) => ({ ...current, file_size: event.target.value }))} /></Field>
            <Field label={t('managerParent.pages.softwareManagement.systemRequirements')}><Textarea value={form.system_requirements} onChange={(event) => setForm((current) => ({ ...current, system_requirements: event.target.value }))} /></Field>
            <Field label={t('managerParent.pages.softwareManagement.installationGuideUrl')}><Input value={form.installation_guide_url} onChange={(event) => setForm((current) => ({ ...current, installation_guide_url: event.target.value }))} /></Field>
          </div>

          <div className="space-y-4">
            <Field label={t('managerParent.pages.softwareManagement.trialDays')}><Input type="number" min={0} value={form.trial_days} onChange={(event) => setForm((current) => ({ ...current, trial_days: event.target.value }))} /></Field>
            <Field label={t('managerParent.pages.softwareManagement.basePrice')}><Input type="number" min={0} step="0.01" value={form.base_price} onChange={(event) => setForm((current) => ({ ...current, base_price: event.target.value }))} /></Field>
            <Field label={t('common.status')}>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as 'active' | 'inactive' }))} className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                <option value="active">{t('common.active')}</option>
                <option value="inactive">{t('common.inactive')}</option>
              </select>
            </Field>
            <Field label={t('software.externalSoftwareId')}>
              <Input type="number" min={1} placeholder={t('software.externalSoftwareIdPlaceholder')} value={form.external_software_id} onChange={(event) => setForm((current) => ({ ...current, external_software_id: event.target.value }))} />
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('software.softwareIdUrlHint')}</p>
            </Field>
            <Field label={t('software.externalApiBaseUrl')}>
              <div className="flex gap-2">
                <Input
                  type={showApiBaseUrl ? 'url' : 'password'}
                  placeholder={editingId ? t('software.externalApiBaseUrlReplacePlaceholder') : t('software.externalApiBaseUrlPlaceholder')}
                  value={form.external_api_base_url}
                  onChange={(event) => setForm((current) => ({ ...current, external_api_base_url: event.target.value }))}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowApiBaseUrl((value) => !value)}>
                  {showApiBaseUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('software.apiBaseUrlHint')}</p>
            </Field>
            <Field label={t('software.externalLogsEndpoint')}>
              <Input
                placeholder={t('software.externalLogsEndpointPlaceholder')}
                value={form.external_logs_endpoint}
                onChange={(event) => setForm((current) => ({ ...current, external_logs_endpoint: event.target.value }))}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('software.logsEndpointHint')}</p>
            </Field>
            <Field label={t('software.externalApiKey')}>
              <div className="flex gap-2">
                <Input type={showApiKey ? 'text' : 'password'} maxLength={50} placeholder={editingId ? t('software.apiKeyReplacePlaceholder') : t('software.externalApiKeyPlaceholder')} value={form.external_api_key} onChange={(event) => setForm((current) => ({ ...current, external_api_key: event.target.value }))} />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowApiKey((value) => !value)}>
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('software.apiKeyHint')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('software.apiKeyUrlHint')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('software.addUserUrlExample')}</p>
              {editingId && hasConfiguredApi ? <p className="text-xs text-emerald-600 dark:text-emerald-300">{t('software.apiConfigured')}</p> : null}
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => navigate(routePaths.managerParent.softwareManagement(lang))}>
          {t('common.cancel')}
        </Button>
        <Button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : editingId ? t('managerParent.pages.softwareManagement.saveChanges') : t('managerParent.pages.softwareManagement.createProgram')}
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
