import { useAuthStore } from '@/stores/authStore'

export interface TimezoneOption {
  label: string
  value: string
}

export interface ResolveTimezoneOptions {
  preferred?: string | null
  userTimezone?: string | null
  browserTimezone?: string | null
  serverTimezone?: string | null
}

type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const FALLBACK_TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
]

const SERVER_TIMEZONE_STORAGE_KEY = 'app_server_timezone'

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getPartsFormatter(timeZone: string) {
  const cached = partsFormatterCache.get(timeZone)
  if (cached) {
    return cached
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  partsFormatterCache.set(timeZone, formatter)
  return formatter
}

function toMinuteStamp(parts: DateParts) {
  return Math.round(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) / 60000)
}

function parseDateTimeLocalInput(value: string): DateParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) {
    return null
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  }
}

function unique(values: string[]) {
  return [...new Set(values)]
}

function readStoredServerTimezone(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const value = window.localStorage.getItem(SERVER_TIMEZONE_STORAGE_KEY)
    return isValidIanaTimezone(value) ? value : null
  } catch {
    return null
  }
}

export function persistServerTimezone(timezone: string | null | undefined) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (isValidIanaTimezone(timezone)) {
      window.localStorage.setItem(SERVER_TIMEZONE_STORAGE_KEY, timezone)
      return
    }

    window.localStorage.removeItem(SERVER_TIMEZONE_STORAGE_KEY)
  } catch {
    // Ignore storage write failures; timezone resolution has other fallbacks.
  }
}

export function isValidIanaTimezone(value: string | null | undefined): value is string {
  if (!value) {
    return false
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return true
  } catch {
    return false
  }
}

function getSupportedTimezones() {
  const intlWithSupportedValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[]
  }

  const dynamic = typeof intlWithSupportedValues.supportedValuesOf === 'function'
    ? intlWithSupportedValues.supportedValuesOf('timeZone')
    : []

  return unique(['UTC', ...dynamic, ...FALLBACK_TIMEZONES]).filter((value) => isValidIanaTimezone(value))
}

function formatUtcOffset(value: string) {
  const now = new Date()
  const utcParts = getZonedDateParts(now, 'UTC')
  const targetParts = getZonedDateParts(now, value)

  if (!utcParts || !targetParts) {
    return 'UTC+00:00'
  }

  const diffMinutes = toMinuteStamp(targetParts) - toMinuteStamp(utcParts)
  const sign = diffMinutes >= 0 ? '+' : '-'
  const absoluteMinutes = Math.abs(diffMinutes)
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0')
  const minutes = String(absoluteMinutes % 60).padStart(2, '0')

  return `UTC${sign}${hours}:${minutes}`
}

const PREFERRED_TIMEZONE_BY_OFFSET: Record<string, string> = {
  'UTC-12:00': 'Etc/GMT+12',
  'UTC-11:00': 'Pacific/Pago_Pago',
  'UTC-10:00': 'Pacific/Honolulu',
  'UTC-09:30': 'Pacific/Marquesas',
  'UTC-09:00': 'Pacific/Gambier',
  'UTC-08:00': 'Pacific/Pitcairn',
  'UTC-07:00': 'America/Phoenix',
  'UTC-06:00': 'America/Belize',
  'UTC-05:00': 'America/Bogota',
  'UTC-04:00': 'America/La_Paz',
  'UTC-03:00': 'America/Argentina/Buenos_Aires',
  'UTC-02:30': 'America/St_Johns',
  'UTC-02:00': 'Atlantic/South_Georgia',
  'UTC-01:00': 'Atlantic/Cape_Verde',
  'UTC+00:00': 'UTC',
  'UTC+01:00': 'Africa/Lagos',
  'UTC+02:00': 'Africa/Johannesburg',
  'UTC+03:00': 'Asia/Riyadh',
  'UTC+03:30': 'Asia/Tehran',
  'UTC+04:00': 'Asia/Dubai',
  'UTC+04:30': 'Asia/Kabul',
  'UTC+05:00': 'Asia/Karachi',
  'UTC+05:30': 'Asia/Kolkata',
  'UTC+05:45': 'Asia/Katmandu',
  'UTC+06:00': 'Asia/Dhaka',
  'UTC+06:30': 'Asia/Rangoon',
  'UTC+07:00': 'Asia/Bangkok',
  'UTC+08:00': 'Asia/Singapore',
  'UTC+08:45': 'Australia/Eucla',
  'UTC+09:00': 'Asia/Tokyo',
  'UTC+09:30': 'Australia/Darwin',
  'UTC+10:00': 'Australia/Brisbane',
  'UTC+10:30': 'Australia/Adelaide',
  'UTC+11:00': 'Pacific/Noumea',
  'UTC+12:00': 'Pacific/Tarawa',
  'UTC+13:00': 'Pacific/Tongatapu',
  'UTC+13:45': 'Pacific/Chatham',
  'UTC+14:00': 'Pacific/Kiritimati',
}

function parseUtcOffsetLabel(label: string) {
  const match = label.match(/^UTC([+-])(\d{2}):(\d{2})$/)
  if (!match) {
    return 0
  }

  const sign = match[1] === '+' ? 1 : -1
  return sign * (Number(match[2]) * 60 + Number(match[3]))
}

export function formatTimezoneLabel(value: string | null | undefined) {
  return isValidIanaTimezone(value) ? formatUtcOffset(value) : 'UTC'
}

export function normalizeTimezoneOptionValue(value: string | null | undefined) {
  if (!isValidIanaTimezone(value)) {
    return 'UTC'
  }

  const offsetLabel = formatUtcOffset(value)
  const preferred = PREFERRED_TIMEZONE_BY_OFFSET[offsetLabel]

  if (preferred && isValidIanaTimezone(preferred)) {
    return preferred
  }

  return value
}

const groupedTimezones = new Map<string, string[]>()

for (const value of getSupportedTimezones()) {
  const offsetLabel = formatUtcOffset(value)
  const current = groupedTimezones.get(offsetLabel) ?? []
  current.push(value)
  groupedTimezones.set(offsetLabel, current)
}

export const COMMON_TIMEZONES: TimezoneOption[] = [...groupedTimezones.entries()]
  .map(([offsetLabel, values]) => {
    const preferred = PREFERRED_TIMEZONE_BY_OFFSET[offsetLabel]
    const selected = preferred && values.includes(preferred) ? preferred : values.sort()[0]

    return {
      value: selected,
      label: offsetLabel,
    }
  })
  .sort((left, right) => parseUtcOffsetLabel(left.label) - parseUtcOffsetLabel(right.label))

export function readBrowserTimezone(): string | null {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
    return null
  }

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return isValidIanaTimezone(browserTimezone) ? browserTimezone : null
}

export function resolveBrowserTimezone(): string {
  return readBrowserTimezone() ?? 'UTC'
}

function normalizeResolveTimezoneOptions(optionsOrPreferred?: string | null | ResolveTimezoneOptions): ResolveTimezoneOptions {
  if (typeof optionsOrPreferred === 'string' || optionsOrPreferred == null) {
    return { preferred: optionsOrPreferred ?? null }
  }

  return optionsOrPreferred
}

export function resolveDisplayTimezone(optionsOrPreferred?: string | null | ResolveTimezoneOptions): string {
  const options = normalizeResolveTimezoneOptions(optionsOrPreferred)

  if (isValidIanaTimezone(options.preferred)) {
    return options.preferred
  }

  const storedTimezone = options.userTimezone ?? useAuthStore.getState().user?.timezone
  if (isValidIanaTimezone(storedTimezone)) {
    return storedTimezone
  }

  const browserTimezone = options.browserTimezone ?? readBrowserTimezone()
  if (isValidIanaTimezone(browserTimezone)) {
    return browserTimezone
  }

  const serverTimezone = options.serverTimezone ?? readStoredServerTimezone()
  if (isValidIanaTimezone(serverTimezone)) {
    return serverTimezone
  }

  return 'UTC'
}

export function getZonedDateParts(value: Date | string, timeZone: string): DateParts | null {
  const date = typeof value === 'string' ? new Date(value) : value
  if (!Number.isFinite(date.getTime()) || !isValidIanaTimezone(timeZone)) {
    return null
  }

  const formatter = getPartsFormatter(timeZone)
  const parts = formatter.formatToParts(date)

  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value)

  if ([year, month, day, hour, minute].some((part) => !Number.isFinite(part))) {
    return null
  }

  return { year, month, day, hour, minute }
}

export function formatDateTimeLocalInTimezone(value: Date | string, timeZone: string) {
  const parts = getZonedDateParts(value, timeZone)
  if (!parts) {
    return ''
  }

  const month = String(parts.month).padStart(2, '0')
  const day = String(parts.day).padStart(2, '0')
  const hour = String(parts.hour).padStart(2, '0')
  const minute = String(parts.minute).padStart(2, '0')

  return `${parts.year}-${month}-${day}T${hour}:${minute}`
}

export function zonedDateTimeInputToUtcDate(value: string, timeZone: string) {
  const desired = parseDateTimeLocalInput(value)
  if (!desired || !isValidIanaTimezone(timeZone)) {
    return null
  }

  let utcMs = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute)

  for (let index = 0; index < 4; index += 1) {
    const actual = getZonedDateParts(new Date(utcMs), timeZone)
    if (!actual) {
      return null
    }

    const diffMinutes = toMinuteStamp(desired) - toMinuteStamp(actual)
    if (diffMinutes === 0) {
      break
    }

    utcMs += diffMinutes * 60000
  }

  const resolved = new Date(utcMs)
  return Number.isFinite(resolved.getTime()) ? resolved : null
}
