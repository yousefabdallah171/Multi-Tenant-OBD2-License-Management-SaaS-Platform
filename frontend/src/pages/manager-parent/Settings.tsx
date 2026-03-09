import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { PageLoader } from '@/components/shared/PageLoader'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
          },
        }
      }
      onSaved={() => void queryClient.invalidateQueries({ queryKey: ['manager-parent', 'settings'] })}
    />
  )
}

function SettingsFormShell({ settings, onSaved }: { settings: TenantSettings; onSaved: () => void }) {
  const { t } = useTranslation()
  const [form, setForm] = useState<TenantSettings>(settings)

  const updateMutation = useMutation({
    mutationFn: () => managerParentService.updateSettings(form),
    onSuccess: () => {
      toast.success(t('managerParent.pages.settings.saveSuccess'))
      onSaved()
    },
  })

  function saveSettings() {
    if (!form.business.company_name.trim()) {
      toast.error(t('managerParent.pages.settings.companyNameRequired'))
      return
    }

    if (form.business.email && !isValidEmail(form.business.email)) {
      toast.error(t('managerParent.pages.settings.businessEmailInvalid'))
      return
    }

    updateMutation.mutate()
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
                  id="settings-price"
                  type="number"
                  step="0.01"
                  value={form.defaults.base_price}
                  onChange={(event) => setForm((current) => ({ ...current, defaults: { ...current.defaults, base_price: Number(event.target.value) || 0 } }))}
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
        </div>
      </div>
    </div>
  )
}
