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

function formatTimezoneLabel(value: string) {
  const regionLabel = value === 'UTC' ? 'UTC' : value.replace(/_/g, ' ')
  return `${formatUtcOffset(value)} - ${regionLabel}`
}

export const COMMON_TIMEZONES: TimezoneOption[] = getSupportedTimezones()
  .map((value) => ({
    value,
    label: formatTimezoneLabel(value),
  }))
  .sort((left, right) => left.label.localeCompare(right.label))

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
