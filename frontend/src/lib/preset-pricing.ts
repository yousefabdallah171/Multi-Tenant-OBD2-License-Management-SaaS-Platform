import type { ProgramDurationPreset } from '@/types/manager-reseller.types'

function normalizeCountryKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export interface ResolvedPresetPrice {
  effectivePrice: number
  source: 'country_override' | 'preset_default'
}

export function resolvePresetEffectivePrice(preset: ProgramDurationPreset | null | undefined, countryName: string | null | undefined): ResolvedPresetPrice {
  if (!preset) {
    return {
      effectivePrice: 0,
      source: 'preset_default',
    }
  }

  const countryKey = normalizeCountryKey(countryName)
  if (countryKey === '') {
    return {
      effectivePrice: Number(preset.price ?? 0),
      source: 'preset_default',
    }
  }

  const match = (preset.country_prices ?? []).find((countryPrice) => (
    Boolean(countryPrice.is_active) && normalizeCountryKey(countryPrice.country_name) === countryKey
  ))

  if (!match) {
    return {
      effectivePrice: Number(preset.price ?? 0),
      source: 'preset_default',
    }
  }

  return {
    effectivePrice: Number(match.price ?? preset.price ?? 0),
    source: 'country_override',
  }
}

