import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChartCard } from '@/components/charts/ChartCard'
import { StatusFilterCard } from '@/components/customers/StatusFilterCard'
import { LicenseStatusBadges } from '@/components/shared/LicenseStatusBadges'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { StatsCard } from '@/components/shared/StatsCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DashboardAppearanceOverrideProvider } from '@/hooks/useDashboardAppearance'
import {
  DASHBOARD_APPEARANCE_DEFAULTS,
  DASHBOARD_CUSTOM_FONT_OPTION_ID,
  DASHBOARD_FONT_OPTIONS,
  ensureDashboardFontLoaded,
  getDashboardAppearanceInlineVars,
  getDashboardFontOptionByFamily,
} from '@/lib/dashboard-appearance'
import type { DashboardAppearanceSettings, DashboardAppearanceSurfaceSettings } from '@/types/super-admin.types'

interface DashboardAppearanceSettingsPanelProps {
  value: DashboardAppearanceSettings
  onChange: (next: DashboardAppearanceSettings) => void
  onReset: () => void
}

const FONT_WEIGHT_OPTIONS: Array<DashboardAppearanceSettings['font_weights']['display']> = [400, 500, 600, 700, 800, 900]

const previewRows = [
  { name: 'Acme Tools', status: 'active', tenant: 'OBD2SW Main', reseller: 'Main Manager' },
  { name: 'Road Lab', status: 'pending', tenant: 'OBD2SW Main', reseller: 'North Team' },
] as const

function NumberField({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="dashboard-text-helper text-slate-500 dark:text-slate-400">{value}px</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-800"
        />
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-24"
        />
      </div>
      {hint ? <p className="dashboard-text-helper text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  )
}

function WeightField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: DashboardAppearanceSettings['font_weights']['display']
  onChange: (value: DashboardAppearanceSettings['font_weights']['display']) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as DashboardAppearanceSettings['font_weights']['display'])}
        className="dashboard-text-body h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
      >
        {FONT_WEIGHT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

function SurfaceControls({
  title,
  values,
  onChange,
  opacityLabel,
  brightnessLabel,
}: {
  title: string
  values: DashboardAppearanceSurfaceSettings
  onChange: (next: DashboardAppearanceSurfaceSettings) => void
  opacityLabel: string
  brightnessLabel: string
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label>{opacityLabel}</Label>
            <span className="dashboard-text-helper text-slate-500 dark:text-slate-400">{values.opacity_percent}%</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={35}
              max={100}
              value={values.opacity_percent}
              onChange={(event) => onChange({ ...values, opacity_percent: Number(event.target.value) })}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-800"
            />
            <Input
              type="number"
              min={35}
              max={100}
              value={values.opacity_percent}
              onChange={(event) => onChange({ ...values, opacity_percent: Number(event.target.value) })}
              className="w-24"
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label>{brightnessLabel}</Label>
            <span className="dashboard-text-helper text-slate-500 dark:text-slate-400">{values.brightness_percent}%</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={80}
              max={120}
              value={values.brightness_percent}
              onChange={(event) => onChange({ ...values, brightness_percent: Number(event.target.value) })}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-800"
            />
            <Input
              type="number"
              min={80}
              max={120}
              value={values.brightness_percent}
              onChange={(event) => onChange({ ...values, brightness_percent: Number(event.target.value) })}
              className="w-24"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardAppearanceSettingsPanel({
  value,
  onChange,
  onReset,
}: DashboardAppearanceSettingsPanelProps) {
  const { t } = useTranslation()
  const previewVars = useMemo(() => getDashboardAppearanceInlineVars(value), [value])
  const resolvedFontOptionId = getDashboardFontOptionByFamily(value.font_family)?.id ?? DASHBOARD_CUSTOM_FONT_OPTION_ID
  const [selectedFontOptionId, setSelectedFontOptionId] = useState(resolvedFontOptionId)

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    ensureDashboardFontLoaded(value.font_family, document)
  }, [value.font_family])

  useEffect(() => {
    setSelectedFontOptionId(resolvedFontOptionId)
  }, [resolvedFontOptionId])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-lg">{t('superAdmin.pages.settings.appearanceTitle', { defaultValue: 'Global Dashboard Appearance' })}</CardTitle>
            <p className="dashboard-text-body max-w-3xl text-slate-500 dark:text-slate-400">
              {t('superAdmin.pages.settings.appearanceDescription', {
                defaultValue: 'Control dashboard typography and color intensity across every authenticated role from one shared settings profile.',
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="dashboard-text-body inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            {t('superAdmin.pages.settings.resetAppearance', { defaultValue: 'Reset to Defaults' })}
          </button>
        </CardHeader>
        <CardContent className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="appearance-font-family">{t('superAdmin.pages.settings.fontFamily', { defaultValue: 'Font family' })}</Label>
              <select
                id="appearance-font-family"
                value={selectedFontOptionId}
                onChange={(event) => {
                  setSelectedFontOptionId(event.target.value)
                  const nextOption = DASHBOARD_FONT_OPTIONS.find((option) => option.id === event.target.value)
                  if (nextOption) {
                    onChange({ ...value, font_family: nextOption.fontFamily })
                  }
                }}
                className="dashboard-text-body h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {DASHBOARD_FONT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
                <option value={DASHBOARD_CUSTOM_FONT_OPTION_ID}>
                  {t('superAdmin.pages.settings.customFontOption', { defaultValue: 'Custom font stack' })}
                </option>
              </select>
              <p className="dashboard-text-helper text-slate-500 dark:text-slate-400">
                {t('superAdmin.pages.settings.fontPresetHint', {
                  defaultValue: 'Choose from free hosted font pairings. The selected font is cached locally and loaded on demand for faster dashboard reloads.',
                })}
              </p>
            </div>

            {selectedFontOptionId === DASHBOARD_CUSTOM_FONT_OPTION_ID ? (
              <div className="space-y-2">
                <Label htmlFor="appearance-font-family-custom">
                  {t('superAdmin.pages.settings.customFontFamily', { defaultValue: 'Custom font-family value' })}
                </Label>
                <Input
                  id="appearance-font-family-custom"
                  value={value.font_family}
                  onChange={(event) => onChange({ ...value, font_family: event.target.value })}
                  placeholder={`'Plus Jakarta Sans', ${DASHBOARD_APPEARANCE_DEFAULTS.font_family.split(',').slice(1).join(',').trim()}`}
                />
                <p className="dashboard-text-helper text-slate-500 dark:text-slate-400">
                  {t('superAdmin.pages.settings.fontFamilyHint', {
                    defaultValue: 'Enter any valid CSS font-family string. A safe fallback stack is added automatically when needed.',
                  })}
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              <NumberField
                id="appearance-display"
                label={t('superAdmin.pages.settings.fontDisplay', { defaultValue: 'Display size' })}
                value={value.font_sizes.display_px}
                min={16}
                max={56}
                onChange={(next) => onChange({ ...value, font_sizes: { ...value.font_sizes, display_px: next } })}
              />
              <NumberField
                id="appearance-heading"
                label={t('superAdmin.pages.settings.fontHeading', { defaultValue: 'Heading size' })}
                value={value.font_sizes.heading_px}
                min={10}
                max={48}
                onChange={(next) => onChange({ ...value, font_sizes: { ...value.font_sizes, heading_px: next } })}
              />
              <NumberField
                id="appearance-body"
                label={t('superAdmin.pages.settings.fontBody', { defaultValue: 'Body size' })}
                value={value.font_sizes.body_px}
                min={10}
                max={48}
                onChange={(next) => onChange({ ...value, font_sizes: { ...value.font_sizes, body_px: next } })}
              />
              <NumberField
                id="appearance-label"
                label={t('superAdmin.pages.settings.fontLabel', { defaultValue: 'Label size' })}
                value={value.font_sizes.label_px}
                min={10}
                max={48}
                onChange={(next) => onChange({ ...value, font_sizes: { ...value.font_sizes, label_px: next } })}
              />
              <NumberField
                id="appearance-table-header"
                label={t('superAdmin.pages.settings.fontTableHeader', { defaultValue: 'Table header size' })}
                value={value.font_sizes.table_header_px}
                min={10}
                max={48}
                onChange={(next) => onChange({ ...value, font_sizes: { ...value.font_sizes, table_header_px: next } })}
              />
              <NumberField
                id="appearance-table-cell"
                label={t('superAdmin.pages.settings.fontTableCell', { defaultValue: 'Table cell size' })}
                value={value.font_sizes.table_cell_px}
                min={10}
                max={48}
                onChange={(next) => onChange({ ...value, font_sizes: { ...value.font_sizes, table_cell_px: next } })}
              />
              <NumberField
                id="appearance-helper"
                label={t('superAdmin.pages.settings.fontHelper', { defaultValue: 'Helper size' })}
                value={value.font_sizes.helper_px}
                min={10}
                max={48}
                onChange={(next) => onChange({ ...value, font_sizes: { ...value.font_sizes, helper_px: next } })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <WeightField
                id="appearance-weight-display"
                label={t('superAdmin.pages.settings.weightDisplay', { defaultValue: 'Display weight' })}
                value={value.font_weights.display}
                onChange={(next) => onChange({ ...value, font_weights: { ...value.font_weights, display: next } })}
              />
              <WeightField
                id="appearance-weight-heading"
                label={t('superAdmin.pages.settings.weightHeading', { defaultValue: 'Heading weight' })}
                value={value.font_weights.heading}
                onChange={(next) => onChange({ ...value, font_weights: { ...value.font_weights, heading: next } })}
              />
              <WeightField
                id="appearance-weight-body"
                label={t('superAdmin.pages.settings.weightBody', { defaultValue: 'Body weight' })}
                value={value.font_weights.body}
                onChange={(next) => onChange({ ...value, font_weights: { ...value.font_weights, body: next } })}
              />
              <WeightField
                id="appearance-weight-label"
                label={t('superAdmin.pages.settings.weightLabel', { defaultValue: 'Label weight' })}
                value={value.font_weights.label}
                onChange={(next) => onChange({ ...value, font_weights: { ...value.font_weights, label: next } })}
              />
              <WeightField
                id="appearance-weight-table-header"
                label={t('superAdmin.pages.settings.weightTableHeader', { defaultValue: 'Table header weight' })}
                value={value.font_weights.table_header}
                onChange={(next) => onChange({ ...value, font_weights: { ...value.font_weights, table_header: next } })}
              />
            </div>
          </div>

          <DashboardAppearanceOverrideProvider appearance={value}>
            <div
              className="dashboard-app rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60"
              style={previewVars}
              data-testid="dashboard-appearance-preview"
            >
              <div className="mb-4 space-y-2">
                <p className="dashboard-text-label uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
                  {t('superAdmin.pages.settings.previewEyebrow', { defaultValue: 'Live preview' })}
                </p>
                <h3 className="dashboard-text-display text-slate-950 dark:text-white">
                  {t('superAdmin.pages.settings.previewTitle', { defaultValue: 'Dashboard typography and surfaces' })}
                </h3>
                <p className="dashboard-text-body max-w-2xl text-slate-500 dark:text-slate-400">
                  {t('superAdmin.pages.settings.previewDescription', {
                    defaultValue: 'This preview reflects the draft values before you save them for every dashboard role.',
                  })}
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <StatsCard
                  title={t('superAdmin.pages.settings.previewStats', { defaultValue: 'Total Revenue' })}
                  value="$18,420"
                  trend={12}
                  color="sky"
                />
                <StatusFilterCard
                  label={t('common.active')}
                  count={15}
                  color="emerald"
                  isActive
                />
              </div>

              <div className="mt-4">
                <ChartCard
                  title={t('superAdmin.pages.settings.previewChart', { defaultValue: 'Monthly Activations' })}
                  description={t('superAdmin.pages.settings.previewChartDescription', { defaultValue: 'Charts inherit the same shared appearance controls.' })}
                >
                  <div className="flex items-end gap-3 pt-4">
                    {[42, 66, 54, 82, 61].map((height, index) => (
                      <div key={index} className="flex flex-1 flex-col items-center gap-2">
                        <div
                          className="w-full rounded-t-xl bg-brand-500/70"
                          style={{ height }}
                        />
                        <span className="dashboard-text-helper text-slate-500 dark:text-slate-400">{['Jan', 'Feb', 'Mar', 'Apr', 'May'][index]}</span>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              </div>

              <Card className="mt-4">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">{t('superAdmin.pages.settings.previewBadges', { defaultValue: 'Badge samples' })}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3">
                  <RoleBadge role="super_admin" />
                  <RoleBadge role="manager_parent" />
                  <LicenseStatusBadges status="active" isNew />
                  <LicenseStatusBadges status="pending" isBlocked />
                </CardContent>
              </Card>

              <Card className="mt-4 overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">{t('superAdmin.pages.settings.previewTable', { defaultValue: 'Table sample' })}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                      <thead className="bg-slate-50 dark:bg-slate-950/70">
                        <tr>
                          <th className="dashboard-text-table-header px-4 py-3 text-start uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('common.name')}</th>
                          <th className="dashboard-text-table-header px-4 py-3 text-start uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('common.status')}</th>
                          <th className="dashboard-text-table-header px-4 py-3 text-start uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('common.reseller')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {previewRows.map((row) => (
                          <tr key={row.name}>
                            <td className="dashboard-text-table-cell px-4 py-3 text-slate-700 dark:text-slate-200">{row.name}</td>
                            <td className="dashboard-text-table-cell px-4 py-3"><LicenseStatusBadges status={row.status} /></td>
                            <td className="dashboard-text-table-cell px-4 py-3 text-slate-700 dark:text-slate-200">{row.reseller}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </DashboardAppearanceOverrideProvider>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <SurfaceControls
          title={t('superAdmin.pages.settings.cardsSurface', { defaultValue: 'Cards' })}
          opacityLabel={t('superAdmin.pages.settings.opacity', { defaultValue: 'Opacity' })}
          brightnessLabel={t('superAdmin.pages.settings.brightness', { defaultValue: 'Brightness' })}
          values={value.surfaces.cards}
          onChange={(next) => onChange({ ...value, surfaces: { ...value.surfaces, cards: next } })}
        />
        <SurfaceControls
          title={t('superAdmin.pages.settings.chartsSurface', { defaultValue: 'Charts' })}
          opacityLabel={t('superAdmin.pages.settings.opacity', { defaultValue: 'Opacity' })}
          brightnessLabel={t('superAdmin.pages.settings.brightness', { defaultValue: 'Brightness' })}
          values={value.surfaces.charts}
          onChange={(next) => onChange({ ...value, surfaces: { ...value.surfaces, charts: next } })}
        />
        <SurfaceControls
          title={t('superAdmin.pages.settings.badgesSurface', { defaultValue: 'Badges' })}
          opacityLabel={t('superAdmin.pages.settings.opacity', { defaultValue: 'Opacity' })}
          brightnessLabel={t('superAdmin.pages.settings.brightness', { defaultValue: 'Brightness' })}
          values={value.surfaces.badges}
          onChange={(next) => onChange({ ...value, surfaces: { ...value.surfaces, badges: next } })}
        />
      </div>
    </div>
  )
}
