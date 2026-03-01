import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { activateLicense } from '@/services/activation.service'

interface ActivationProgram {
  id: number
  name: string
  price_per_day: number
  has_external_api?: boolean
  external_software_id?: number | null
}

interface ActivateLicenseModalProps {
  open: boolean
  onClose: () => void
  program: ActivationProgram | null
  onSuccess?: () => void
}

const EMPTY_FORM = {
  customer_name: '',
  customer_email: '',
  bios_id: '',
  duration_value: '30',
  duration_unit: 'days' as 'minutes' | 'hours' | 'days',
  mode: 'duration' as 'duration' | 'end_date',
  end_date: '',
}

export function ActivateLicenseModal({ open, onClose, program, onSuccess }: ActivateLicenseModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState(EMPTY_FORM)

  const durationDays = useMemo(() => {
    if (form.mode === 'end_date') {
      if (!form.end_date) {
        return 0
      }

      const endDate = new Date(form.end_date).getTime()
      const now = Date.now()
      const diffMs = endDate - now
      if (diffMs <= 0) {
        return 0
      }

      return Math.ceil((diffMs / 86400000) * 1000) / 1000
    }

    const value = Number(form.duration_value)
    if (!Number.isFinite(value) || value <= 0) {
      return 0
    }

    if (form.duration_unit === 'minutes') {
      return value / 1440
    }

    if (form.duration_unit === 'hours') {
      return value / 24
    }

    return value
  }, [form.duration_unit, form.duration_value, form.end_date, form.mode])

  const totalPrice = useMemo(() => {
    if (!program || durationDays <= 0) {
      return 0
    }

    return Number((durationDays * program.price_per_day).toFixed(2))
  }, [durationDays, program])

  const activationMutation = useMutation({
    mutationFn: () => {
      if (!program) {
        throw new Error('Program is required')
      }

      return activateLicense({
        program_id: program.id,
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim(),
        bios_id: form.bios_id.trim(),
        duration_days: Number(durationDays.toFixed(3)),
        price: totalPrice,
      })
    },
    onSuccess: (data) => {
      toast.success(`${t('activate.successTitle')} - ${t('activate.successMessage', { key: data.license_key })}`)
      onSuccess?.()
      setForm(EMPTY_FORM)
      onClose()
    },
    onError: (error: unknown) => {
      const rawMessage =
        typeof error === 'object' && error !== null && 'response' in error
          ? ((error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data?.message
            ?? Object.values((error as { response?: { data?: { errors?: Record<string, string[]> } } }).response?.data?.errors ?? {})[0]?.[0]
            ?? t('activate.errorTitle'))
          : t('activate.errorTitle')

      const normalized = String(rawMessage).toLowerCase()
      let message = rawMessage

      if (normalized.includes('no external api configured') || normalized.includes('not configured for external activation')) {
        message = t('software.noApiWarning')
      } else if (normalized.includes('already exists for this bios')) {
        message = t('activate.biosAlreadyActive')
      } else if (normalized.includes('blacklisted')) {
        message = t('activate.biosBlacklisted')
      }

      toast.error(message)
    },
  })

  const isExternalConfigured = program?.has_external_api !== false

  function handleSubmit() {
    if (!program) {
      return
    }

    if (!isExternalConfigured) {
      toast.error(t('software.noApiWarning'))
      return
    }

    if (!form.customer_name.trim() || !form.customer_email.trim() || !form.bios_id.trim()) {
      toast.error(t('activate.errorTitle'))
      return
    }

    if (durationDays < 0.014) {
      toast.error(t('activate.errorTitle'))
      return
    }

    activationMutation.mutate()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setForm(EMPTY_FORM)
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('activate.title')}</DialogTitle>
        </DialogHeader>
        {program ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <span className="font-medium text-slate-900 dark:text-slate-100">{program.name}</span>
          </div>
        ) : null}
        {program && !isExternalConfigured ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {t('software.noApiWarning')}
          </div>
        ) : null}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="activate-customer-name">{t('activate.customerName')}</Label>
            <Input
              id="activate-customer-name"
              value={form.customer_name}
              onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activate-customer-email">{t('activate.customerEmail')}</Label>
            <Input
              id="activate-customer-email"
              type="email"
              value={form.customer_email}
              onChange={(event) => setForm((current) => ({ ...current, customer_email: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activate-bios-id">{t('activate.biosId')}</Label>
            <Input
              id="activate-bios-id"
              value={form.bios_id}
              onChange={(event) => setForm((current) => ({ ...current, bios_id: event.target.value }))}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('activate.biosIdHint')}</p>
          </div>
          <div className="space-y-2">
            <Label>{t('activate.duration')}</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={form.mode === 'duration' ? 'default' : 'outline'} onClick={() => setForm((current) => ({ ...current, mode: 'duration' }))}>
                {t('activate.durationMode')}
              </Button>
              <Button type="button" size="sm" variant={form.mode === 'end_date' ? 'default' : 'outline'} onClick={() => setForm((current) => ({ ...current, mode: 'end_date' }))}>
                {t('activate.endDateMode')}
              </Button>
            </div>
            {form.mode === 'duration' ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    id="activate-duration"
                    type="number"
                    min={0.01}
                    value={form.duration_value}
                    onChange={(event) => setForm((current) => ({ ...current, duration_value: event.target.value }))}
                  />
                  <select
                    value={form.duration_unit}
                    onChange={(event) => setForm((current) => ({ ...current, duration_unit: event.target.value as 'minutes' | 'hours' | 'days' }))}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="minutes">{t('activate.minutes')}</option>
                    <option value="hours">{t('activate.hours')}</option>
                    <option value="days">{t('activate.days')}</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '30 min', value: '30', unit: 'minutes' as const },
                    { label: '1 hr', value: '1', unit: 'hours' as const },
                    { label: '6 hr', value: '6', unit: 'hours' as const },
                    { label: '1 day', value: '1', unit: 'days' as const },
                    { label: '7 days', value: '7', unit: 'days' as const },
                    { label: '30 days', value: '30', unit: 'days' as const },
                    { label: '90 days', value: '90', unit: 'days' as const },
                  ].map((quick) => (
                    <Button
                      key={quick.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          mode: 'duration',
                          duration_value: quick.value,
                          duration_unit: quick.unit,
                        }))
                      }
                    >
                      {quick.label}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <Input
                type="datetime-local"
                value={form.end_date}
                onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="activate-price">{t('activate.price')}</Label>
            <Input id="activate-price" value={totalPrice.toFixed(2)} readOnly />
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('activate.priceAuto')}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setForm(EMPTY_FORM)
              onClose()
            }}
            disabled={activationMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={activationMutation.isPending || !program || !isExternalConfigured}>
            {activationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('activate.submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
