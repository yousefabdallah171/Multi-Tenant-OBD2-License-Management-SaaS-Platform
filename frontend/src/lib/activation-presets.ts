import type { TFunction } from 'i18next'

export type ActivationDurationUnit = 'minutes' | 'hours' | 'days'

export interface ActivationDurationPreset {
  label: string
  value: string
  unit: ActivationDurationUnit
}

export function getActivationDurationPresets(t: TFunction): ActivationDurationPreset[] {
  return [
    { label: t('activate.quickPreset30Min', { defaultValue: '30 min' }), value: '30', unit: 'minutes' },
    { label: t('activate.quickPreset1Hour', { defaultValue: '1 hr' }), value: '1', unit: 'hours' },
    { label: t('activate.quickPreset6Hours', { defaultValue: '6 hr' }), value: '6', unit: 'hours' },
    { label: t('activate.quickPreset1Day', { defaultValue: '1 day' }), value: '1', unit: 'days' },
    { label: t('activate.quickPreset7Days', { defaultValue: '7 days' }), value: '7', unit: 'days' },
    { label: t('activate.quickPreset30Days', { defaultValue: '30 days' }), value: '30', unit: 'days' },
    { label: t('activate.quickPreset90Days', { defaultValue: '90 days' }), value: '90', unit: 'days' },
  ]
}
