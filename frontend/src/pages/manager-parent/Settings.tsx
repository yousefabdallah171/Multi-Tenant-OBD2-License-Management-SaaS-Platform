import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { PageHeader } from '@/components/manager-parent/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { managerParentService } from '@/services/manager-parent.service'
import type { TenantSettings } from '@/types/manager-parent.types'

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: ['manager-parent', 'settings'],
    queryFn: () => managerParentService.getSettings(),
  })
  const settings = settingsQuery.data ? settingsQuery.data.data : null

  if (settingsQuery.isLoading && !settings) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="Maintain tenant business information, onboarding defaults, and notification preferences." />
        <Card>
          <CardContent className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading settings...</CardContent>
        </Card>
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
            trial_days: 7,
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
  const [form, setForm] = useState<TenantSettings>(settings)

  const updateMutation = useMutation({
    mutationFn: () => managerParentService.updateSettings(form),
    onSuccess: () => {
      toast.success('Settings saved successfully.')
      onSaved()
    },
  })

  function saveSettings() {
    if (!form.business.company_name.trim()) {
      toast.error('Company name is required.')
      return
    }

    if (form.business.email && !isValidEmail(form.business.email)) {
      toast.error('Business email must be valid.')
      return
    }

    updateMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Maintain tenant business information, onboarding defaults, and notification preferences."
        actions={
          <Button type="button" onClick={saveSettings} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Business Info</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="settings-company">Company Name</Label>
              <Input id="settings-company" value={form.business.company_name} onChange={(event) => setForm((current) => ({ ...current, business: { ...current.business, company_name: event.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email">Email</Label>
              <Input id="settings-email" type="email" value={form.business.email ?? ''} onChange={(event) => setForm((current) => ({ ...current, business: { ...current.business, email: event.target.value || null } }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-phone">Phone</Label>
              <Input id="settings-phone" value={form.business.phone ?? ''} onChange={(event) => setForm((current) => ({ ...current, business: { ...current.business, phone: event.target.value || null } }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-address">Address</Label>
              <Input id="settings-address" value={form.business.address ?? ''} onChange={(event) => setForm((current) => ({ ...current, business: { ...current.business, address: event.target.value || null } }))} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Defaults</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="settings-trial">Default Trial Days</Label>
                <Input
                  id="settings-trial"
                  type="number"
                  value={form.defaults.trial_days}
                  onChange={(event) => setForm((current) => ({ ...current, defaults: { ...current.defaults, trial_days: Number(event.target.value) || 0 } }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-price">Default Pricing</Label>
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
              <CardTitle className="text-lg">Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.notifications.new_activations}
                  onChange={(event) => setForm((current) => ({ ...current, notifications: { ...current.notifications, new_activations: event.target.checked } }))}
                />
                <span>Email alerts for new activations</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.notifications.expiry_warnings}
                  onChange={(event) => setForm((current) => ({ ...current, notifications: { ...current.notifications, expiry_warnings: event.target.checked } }))}
                />
                <span>Email alerts for expiry warnings</span>
              </label>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
