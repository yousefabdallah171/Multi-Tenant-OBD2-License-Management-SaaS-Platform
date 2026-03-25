import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { PageLoader } from '@/components/shared/PageLoader'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { managerParentService } from '@/services/manager-parent.service'
import type { TenantSettings } from '@/types/manager-parent.types'

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function SettingsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: ['manager-parent', 'settings'],
    queryFn: () => managerParentService.getSettings(),
  })
  const settings = settingsQuery.data ? settingsQuery.data.data : null

  if (settingsQuery.isLoading && !settings) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('managerParent.pages.settings.title')} description={t('managerParent.pages.settings.description')} />
        <PageLoader title={t('managerParent.pages.settings.loadingTitle')} description={t('managerParent.pages.settings.loadingDescription')} />
      </div>
    )
  }

  return (
    <SettingsFormShell
      key={JSON.stringify(settings ?? {})}
      settings={
        settings ?? {
          business: {
            company_name: '',
            email: null,
            phone: null,
            address: null,
          },
          defaults: {
            trial_days: 0,
            base_price: 0,
          },
          notifications: {
            new_activations: true,
            expiry_warnings: true,
          },
          branding: {
            logo: null,
            primary_color: null,
          },
        }
      }
      onSaved={() => void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'settings'] })}
    />
  )
}

function SettingsFormShell({ settings, onSaved }: { settings: TenantSettings; onSaved: () => void }) {
  const { t } = useTranslation()
  const { user, setAuthenticatedUser } = useAuth()
  const [form, setForm] = useState<TenantSettings>(settings)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const basePriceInputRef = useRef<HTMLInputElement>(null)

  const updateMutation = useMutation({
    mutationFn: (payload: TenantSettings) => managerParentService.updateSettings(payload),
    onSuccess: (response) => {
      setForm(response.data)
      toast.success(t('managerParent.pages.settings.saveSuccess'))
      // Update auth store so branding reflects immediately
      if (user && user.tenant) {
        setAuthenticatedUser({ ...user, tenant: { ...user.tenant, settings: response.data as any } })
      }
      onSaved()
    },
  })

  const logoUploadMutation = useMutation({
    mutationFn: (file: File) => managerParentService.uploadLogo(file),
    onSuccess: (response) => {
      toast.success(t('managerParent.pages.settings.logoUploaded'))
      const newLogo = response.data.logo
      setForm((current) => ({ ...current, branding: { ...current.branding, logo: newLogo } }))
      // Update auth store immediately
      if (user && user.tenant) {
        setAuthenticatedUser({ ...user, tenant: { ...user.tenant, settings: { ...form, branding: { ...form.branding, logo: newLogo } } as any } })
      }
    },
    onError: (_error) => {
      toast.error(t('common.error'))
    },
  })

  function saveSettings() {
    const nextDefaults = {
      ...form.defaults,
      base_price: Number(basePriceInputRef.current?.value ?? form.defaults.base_price) || 0,
    }

    if (!form.business.company_name.trim()) {
      toast.error(t('managerParent.pages.settings.companyNameRequired'))
      return
    }

    if (form.business.email && !isValidEmail(form.business.email)) {
      toast.error(t('managerParent.pages.settings.businessEmailInvalid'))
      return
    }

    updateMutation.mutate({
      business: {
        ...form.business,
      },
      defaults: nextDefaults,
      notifications: {
        ...form.notifications,
      },
      branding: {
        ...form.branding,
      },
    })
  }

  function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      logoUploadMutation.mutate(file)
    }
  }

  function handleRemoveLogo() {
    const nextForm: TenantSettings = {
      business: {
        ...form.business,
      },
      defaults: {
        ...form.defaults,
      },
      notifications: {
        ...form.notifications,
      },
      branding: {
        ...form.branding,
        logo: null,
      },
    }

    setForm(nextForm)
    updateMutation.mutate(nextForm)
  }

  function updateBasePrice(value: string) {
    setForm((current) => ({
      ...current,
      defaults: {
        ...current.defaults,
        base_price: Number(value) || 0,
      },
    }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('managerParent.pages.settings.title')}
        description={t('managerParent.pages.settings.description')}
        actions={
          <Button type="button" onClick={saveSettings} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : null}
            {updateMutation.isPending ? t('common.saving') : t('managerParent.pages.settings.saveSettings')}
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('managerParent.pages.settings.businessInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="settings-company">{t('managerParent.pages.settings.companyName')}</Label>
              <Input id="settings-company" value={form.business.company_name} onChange={(event) => setForm((current) => ({ ...current, business: { ...current.business, company_name: event.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email">{t('common.email')}</Label>
              <Input id="settings-email" type="email" value={form.business.email ?? ''} onChange={(event) => setForm((current) => ({ ...current, business: { ...current.business, email: event.target.value || null } }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-phone">{t('common.phone')}</Label>
              <Input id="settings-phone" value={form.business.phone ?? ''} onChange={(event) => setForm((current) => ({ ...current, business: { ...current.business, phone: event.target.value || null } }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-address">{t('managerParent.pages.settings.address')}</Label>
              <Input id="settings-address" value={form.business.address ?? ''} onChange={(event) => setForm((current) => ({ ...current, business: { ...current.business, address: event.target.value || null } }))} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('managerParent.pages.settings.defaults')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="settings-price">{t('managerParent.pages.settings.defaultPricing')}</Label>
                <Input
                  ref={basePriceInputRef}
                  id="settings-price"
                  type="number"
                  step="0.01"
                  value={form.defaults.base_price}
                  onInput={(event) => updateBasePrice(event.currentTarget.value)}
                  onChange={(event) => updateBasePrice(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('managerParent.pages.settings.notifications')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.notifications.new_activations}
                  onChange={(event) => setForm((current) => ({ ...current, notifications: { ...current.notifications, new_activations: event.target.checked } }))}
                />
                <span>{t('managerParent.pages.settings.newActivationsAlerts')}</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.notifications.expiry_warnings}
                  onChange={(event) => setForm((current) => ({ ...current, notifications: { ...current.notifications, expiry_warnings: event.target.checked } }))}
                />
                <span>{t('managerParent.pages.settings.expiryWarningsAlerts')}</span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('managerParent.pages.settings.branding')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('managerParent.pages.settings.logo')}</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('managerParent.pages.settings.logoHint')}</p>
                {form.branding.logo ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40">
                      <img src={form.branding.logo} alt="Logo preview" className="h-8 w-auto object-contain" />
                      <span className="text-xs text-slate-600 dark:text-slate-300">{t('managerParent.pages.settings.logoPreview')}</span>
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        disabled={updateMutation.isPending}
                        className="ms-auto flex items-center justify-center rounded-lg hover:bg-slate-200 p-1 dark:hover:bg-slate-800"
                        aria-label={t('common.remove')}
                      >
                        <X className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      </button>
                    </div>
                  </div>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={logoUploadMutation.isPending}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploadMutation.isPending}
                >
                  {logoUploadMutation.isPending ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : null}
                  {t('managerParent.pages.settings.uploadLogo')}
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-primary-color">{t('managerParent.pages.settings.primaryColor')}</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('managerParent.pages.settings.primaryColorHint')}</p>
                <div className="flex items-center gap-2">
                  <input
                    id="settings-primary-color"
                    type="color"
                    value={form.branding.primary_color ?? '#0284c7'}
                    onChange={(event) => setForm((current) => ({ ...current, branding: { ...current.branding, primary_color: event.target.value } }))}
                    className="h-10 w-16 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700"
                  />
                  <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{form.branding.primary_color ?? '#0284c7'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
