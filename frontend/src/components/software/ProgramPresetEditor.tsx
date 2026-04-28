import { Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ALL_COUNTRIES } from '@/lib/countries'
import type { ProgramDurationPreset } from '@/types/manager-reseller.types'

export interface EditableProgramPresetCountryPrice {
  id?: number
  country_name: string
  price: string
  is_active: boolean
}

export interface EditableProgramPreset {
  id?: number
  label: string
  duration_days: number
  duration_value: string
  duration_unit: 'hours' | 'days' | 'months'
  price: string
  sort_order: number
  is_active: boolean
  country_prices: EditableProgramPresetCountryPrice[]
}

interface ProgramPresetEditorProps {
  presets: EditableProgramPreset[]
  onChange: (presets: EditableProgramPreset[]) => void
}

const DEFAULT_PRESETS: EditableProgramPreset[] = [
  { label: '2 Hours', duration_days: 2 / 24, duration_value: '2', duration_unit: 'hours', price: '60.00', sort_order: 1, is_active: true, country_prices: [] },
  { label: 'Day', duration_days: 1, duration_value: '1', duration_unit: 'days', price: '85.00', sort_order: 2, is_active: true, country_prices: [] },
  { label: 'Week', duration_days: 7, duration_value: '7', duration_unit: 'days', price: '150.00', sort_order: 3, is_active: true, country_prices: [] },
  { label: 'Month', duration_days: 30, duration_value: '1', duration_unit: 'months', price: '250.00', sort_order: 4, is_active: true, country_prices: [] },
]

function formatDurationValue(value: number) {
  if (Number.isInteger(value)) {
    return String(value)
  }

  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

function inferDurationUnit(durationDays: number): Pick<EditableProgramPreset, 'duration_value' | 'duration_unit'> {
  const hours = durationDays * 24
  if (hours < 24 && Math.abs(hours - Math.round(hours)) < 0.001) {
    return {
      duration_value: formatDurationValue(Math.round(hours)),
      duration_unit: 'hours',
    }
  }

  const months = durationDays / 30
  if (durationDays >= 30 && Math.abs(months - Math.round(months)) < 0.001) {
    return {
      duration_value: formatDurationValue(Math.round(months)),
      duration_unit: 'months',
    }
  }

  return {
    duration_value: formatDurationValue(durationDays),
    duration_unit: 'days',
  }
}

function convertDurationToDays(value: string, unit: EditableProgramPreset['duration_unit']) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0
  }

  if (unit === 'hours') {
    return numericValue / 24
  }

  if (unit === 'months') {
    return numericValue * 30
  }

  return numericValue
}

export function createDefaultEditablePresets(): EditableProgramPreset[] {
  return DEFAULT_PRESETS.map((preset) => ({ ...preset }))
}

export function mapProgramPresetsToEditable(presets?: ProgramDurationPreset[]): EditableProgramPreset[] {
  if (!presets || presets.length === 0) {
    return createDefaultEditablePresets()
  }

  return presets.map((preset, index) => ({
    id: preset.id,
    label: preset.label,
    duration_days: preset.duration_days,
    ...inferDurationUnit(preset.duration_days),
    price: preset.price.toFixed(2),
    sort_order: preset.sort_order || index + 1,
    is_active: preset.is_active,
    country_prices: (preset.country_prices ?? []).map((countryPrice) => ({
      id: countryPrice.id,
      country_name: countryPrice.country_name,
      price: Number(countryPrice.price).toFixed(2),
      is_active: Boolean(countryPrice.is_active),
    })),
  }))
}

export function ProgramPresetEditor({ presets, onChange }: ProgramPresetEditorProps) {
  const { t } = useTranslation()

  function updatePreset(index: number, patch: Partial<EditableProgramPreset>) {
    onChange(
      presets.map((preset, currentIndex) => (currentIndex === index ? { ...preset, ...patch } : preset)),
    )
  }

  function updatePresetDuration(index: number, value: string, unit: EditableProgramPreset['duration_unit']) {
    updatePreset(index, {
      duration_value: value,
      duration_unit: unit,
      duration_days: convertDurationToDays(value, unit),
    })
  }

  function addPreset() {
    onChange([
      ...presets,
      {
        label: '',
        duration_days: 1,
        duration_value: '1',
        duration_unit: 'days',
        price: '0.00',
        sort_order: presets.length + 1,
        is_active: true,
        country_prices: [],
      },
    ])
  }

  function removePreset(index: number) {
    onChange(
      presets
        .filter((_, currentIndex) => currentIndex !== index)
        .map((preset, currentIndex) => ({ ...preset, sort_order: currentIndex + 1 })),
    )
  }

  function addCountryPrice(presetIndex: number) {
    onChange(
      presets.map((preset, currentIndex) => (
        currentIndex === presetIndex
          ? {
            ...preset,
            country_prices: [
              ...preset.country_prices,
              {
                country_name: '',
                price: preset.price,
                is_active: true,
              },
            ],
          }
          : preset
      )),
    )
  }

  function updateCountryPrice(presetIndex: number, countryIndex: number, patch: Partial<EditableProgramPresetCountryPrice>) {
    onChange(
      presets.map((preset, currentIndex) => (
        currentIndex === presetIndex
          ? {
            ...preset,
            country_prices: preset.country_prices.map((countryPrice, currentCountryIndex) => (
              currentCountryIndex === countryIndex
                ? { ...countryPrice, ...patch }
                : countryPrice
            )),
          }
          : preset
      )),
    )
  }

  function removeCountryPrice(presetIndex: number, countryIndex: number) {
    onChange(
      presets.map((preset, currentIndex) => (
        currentIndex === presetIndex
          ? {
            ...preset,
            country_prices: preset.country_prices.filter((_, currentCountryIndex) => currentCountryIndex !== countryIndex),
          }
          : preset
      )),
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t('software.durationPresetsTitle', { defaultValue: 'Duration Presets (for Resellers)' })}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('software.durationPresetsHint', { defaultValue: 'Resellers will see these preset buttons instead of manual duration and price fields.' })}
        </p>
      </div>

      <div className="space-y-3">
        {presets.map((preset, index) => (
          <div key={`${preset.id ?? 'new'}-${index}`} className="space-y-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_120px_140px_120px_auto_auto]">
            <div className="space-y-2">
              <Label>{t('software.presetLabel', { defaultValue: 'Label' })}</Label>
              <Input
                value={preset.label}
                onChange={(event) => updatePreset(index, { label: event.target.value })}
                placeholder={t('software.presetLabelPlaceholder', { defaultValue: 'e.g. Week' })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.duration', { defaultValue: 'Duration' })}</Label>
              <Input
                type="number"
                min="0.0001"
                step="0.0001"
                value={preset.duration_value}
                onChange={(event) => updatePresetDuration(index, event.target.value, preset.duration_unit)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.unit', { defaultValue: 'Unit' })}</Label>
              <select
                value={preset.duration_unit}
                onChange={(event) => updatePresetDuration(index, preset.duration_value, event.target.value as EditableProgramPreset['duration_unit'])}
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="hours">{t('common.hours', { defaultValue: 'Hours' })}</option>
                <option value="days">{t('common.days', { defaultValue: 'Days' })}</option>
                <option value="months">{t('common.months', { defaultValue: 'Months' })}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('common.price')}</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={preset.price}
                onChange={(event) => updatePreset(index, { price: event.target.value })}
              />
            </div>
            <label className="flex items-end gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={preset.is_active}
                onChange={(event) => updatePreset(index, { is_active: event.target.checked })}
              />
              {t('common.active')}
            </label>
            <div className="flex items-end justify-end">
              <Button type="button" variant="ghost" size="icon" onClick={() => removePreset(index)} disabled={presets.length <= 1}>
                <Minus className="h-4 w-4" />
              </Button>
            </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <Label>{t('software.countryPricingTitle', { defaultValue: 'Country Pricing Overrides' })}</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => addCountryPrice(index)}>
                  <Plus className="me-2 h-4 w-4" />
                  {t('software.addCountryPricing', { defaultValue: 'Add Country Price' })}
                </Button>
              </div>
              {preset.country_prices.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('software.countryPricingHint', { defaultValue: 'Optional override prices by customer country. Default preset price is used when no country match exists.' })}
                </p>
              ) : (
                <div className="space-y-2">
                  {preset.country_prices.map((countryPrice, countryIndex) => (
                    <div key={`${countryPrice.id ?? 'new-country'}-${countryIndex}`} className="grid gap-2 md:grid-cols-[minmax(0,1.4fr)_120px_auto_auto]">
                      <select
                        value={countryPrice.country_name}
                        onChange={(event) => updateCountryPrice(index, countryIndex, { country_name: event.target.value })}
                        className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                      >
                        <option value="">{t('common.country', { defaultValue: 'Country' })}</option>
                        {ALL_COUNTRIES.map((country) => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={countryPrice.price}
                        onChange={(event) => updateCountryPrice(index, countryIndex, { price: event.target.value })}
                      />
                      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={countryPrice.is_active}
                          onChange={(event) => updateCountryPrice(index, countryIndex, { is_active: event.target.checked })}
                        />
                        {t('common.active')}
                      </label>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeCountryPrice(index, countryIndex)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addPreset}>
        <Plus className="me-2 h-4 w-4" />
        {t('software.addPreset', { defaultValue: 'Add Preset' })}
      </Button>
    </div>
  )
}
