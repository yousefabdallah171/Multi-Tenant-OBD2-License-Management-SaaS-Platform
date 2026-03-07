import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { resolveDisplayTimezone } from '@/lib/timezones'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(value: string | Date, locale = 'en-US', timeZone = resolveDisplayTimezone()) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value))
}

export function formatCurrency(value: number, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

export function hasFutureDate(value: string | Date | null | undefined) {
  if (!value) {
    return false
  }

  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) {
    return false
  }

  return parsed.getTime() > Date.now()
}

type SchedulableLicense = {
  status?: string | null
  is_scheduled?: boolean | null
  scheduled_at?: string | Date | null
  scheduled_failed_at?: string | Date | null
  scheduled_last_attempt_at?: string | Date | null
  scheduled_failure_message?: string | null
  activated_at?: string | Date | null
  start_at?: string | Date | null
  paused_at?: string | Date | null
  pause_remaining_minutes?: number | null
}

export function isScheduledLicense(value: SchedulableLicense | null | undefined) {
  if (!value) {
    return false
  }

  return value.status === 'pending' && Boolean(value.is_scheduled) && !value.scheduled_failed_at
}

export function isScheduledFailedLicense(value: SchedulableLicense | null | undefined) {
  if (!value) {
    return false
  }

  return value.status === 'pending' && Boolean(value.is_scheduled) && Boolean(value.scheduled_failed_at)
}

export function isPausedPendingLicense(value: SchedulableLicense | null | undefined) {
  if (!value) {
    return false
  }

  return value.status === 'pending'
    && !value.is_scheduled
    && Boolean(value.paused_at)
    && Number(value.pause_remaining_minutes ?? 0) > 0
}

export function isPlainPendingLicense(value: SchedulableLicense | null | undefined) {
  if (!value) {
    return false
  }

  return value.status === 'pending' && !isScheduledLicense(value) && !isPausedPendingLicense(value)
}

export function canReactivateLicense(value: SchedulableLicense | null | undefined) {
  if (!value?.status) {
    return false
  }

  return value.status === 'cancelled' || isPausedPendingLicense(value)
}

export function shouldRenewLicense(value: SchedulableLicense | null | undefined) {
  if (!value?.status) {
    return false
  }

  return value.status === 'expired' || isScheduledLicense(value) || isScheduledFailedLicense(value) || isPlainPendingLicense(value)
}

export function canRetryScheduledLicense(value: SchedulableLicense | null | undefined) {
  return isScheduledFailedLicense(value)
}

export function getLicenseDisplayStatus<T extends SchedulableLicense>(value: T | null | undefined) {
  if (!value?.status) {
    return 'pending' as const
  }

  if (isScheduledFailedLicense(value)) {
    return 'scheduled_failed' as const
  }

  if (isScheduledLicense(value)) {
    return 'scheduled' as const
  }

  return value.status as 'active' | 'expired' | 'suspended' | 'cancelled' | 'inactive' | 'pending'
}

export function getLicenseStartDate(value: SchedulableLicense | null | undefined) {
  return value?.start_at ?? value?.scheduled_at ?? value?.activated_at ?? null
}

export function formatDuration(durationDays: number) {
  const totalMinutes = Math.round(durationDays * 24 * 60)

  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`
  }

  const totalHours = totalMinutes / 60
  if (totalHours < 24) {
    const hours = Math.round(totalHours * 10) / 10
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }

  const days = Math.round((totalHours / 24) * 10) / 10
  return `${days} day${days === 1 ? '' : 's'}`
}

export function isLikelyBios(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) {
    return false
  }

  if (normalized.includes(' ')) {
    return false
  }

  const upper = normalized.toUpperCase()
  const alphaNumeric = upper.replace(/[^A-Z0-9]/g, '')
  if (alphaNumeric.length < 8) {
    return false
  }

  const hasSeparator = /[-_:]/.test(upper)
  const hasOnlyHardwareChars = /^[A-Z0-9-_:]+$/.test(upper)
  const digitCount = (upper.match(/\d/g) ?? []).length
  const letterCount = (upper.match(/[A-Z]/g) ?? []).length
  const hexLike = /^[A-F0-9-_:]+$/.test(upper) && digitCount >= 4
  const longHardwareId = alphaNumeric.length >= 12 && digitCount >= 5

  return hasOnlyHardwareChars && (
    hexLike
    || (hasSeparator && longHardwareId)
    || (alphaNumeric.length >= 15 && digitCount >= letterCount)
  )
}
