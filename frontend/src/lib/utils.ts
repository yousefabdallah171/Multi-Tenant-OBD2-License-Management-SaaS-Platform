import { clsx, type ClassValue } from 'clsx'
import type { TFunction } from 'i18next'
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

export function formatActivityActionLabel(action: string, t?: TFunction) {
  if (!action) {
    return '-'
  }

  const normalized = action.toLowerCase()

  if (normalized.includes('license.activated') || normalized.includes('license.activate')) {
    return t ? t('common.activityActions.activation', { defaultValue: 'Activation' }) : 'Activation'
  }

  if (normalized.includes('license.deactivated') || normalized.includes('license.deactivate')) {
    return t ? t('common.activityActions.deactivation', { defaultValue: 'Deactivation' }) : 'Deactivation'
  }

  if (normalized.includes('license.renewed') || normalized.includes('license.renew')) {
    return t ? t('common.activityActions.renewal', { defaultValue: 'Renewal' }) : 'Renewal'
  }

  if (normalized.includes('license.scheduled_activation_executed')) {
    return t ? t('common.activityActions.scheduledExecuted', { defaultValue: 'Scheduled Activation Executed' }) : 'Scheduled Activation Executed'
  }

  if (normalized.includes('license.scheduled_activation_failed')) {
    return t ? t('common.activityActions.scheduledFailed', { defaultValue: 'Scheduled Activation Failed' }) : 'Scheduled Activation Failed'
  }

  if (normalized.includes('license.scheduled')) {
    return t ? t('common.activityActions.scheduled', { defaultValue: 'Scheduled Activation' }) : 'Scheduled Activation'
  }

  if (normalized.includes('customer.deleted')) {
    return t ? t('common.activityActions.customerDeleted', { defaultValue: 'Customer Deleted' }) : 'Customer Deleted'
  }

  if (normalized === 'delete' || normalized.endsWith('.delete')) {
    return t ? t('common.activityActions.delete', { defaultValue: 'Delete' }) : 'Delete'
  }

  if (normalized === 'update' || normalized.endsWith('.update')) {
    return t ? t('common.activityActions.update', { defaultValue: 'Update' }) : 'Update'
  }

  if (normalized === 'create' || normalized.endsWith('.create')) {
    return t ? t('common.activityActions.create', { defaultValue: 'Create' }) : 'Create'
  }

  if (normalized === 'add' || normalized.endsWith('.add')) {
    return t ? t('common.activityActions.add', { defaultValue: 'Add' }) : 'Add'
  }

  if (normalized === 'remove' || normalized.endsWith('.remove')) {
    return t ? t('common.activityActions.remove', { defaultValue: 'Remove' }) : 'Remove'
  }

  if (normalized === 'import' || normalized.endsWith('.import')) {
    return t ? t('common.activityActions.import', { defaultValue: 'Import' }) : 'Import'
  }

  if (normalized.includes('unblock email')) {
    return t ? t('common.activityActions.unblockEmail', { defaultValue: 'Unblock Email' }) : 'Unblock Email'
  }

  if (normalized.includes('team.create')) {
    return t ? t('common.activityActions.teamCreate', { defaultValue: 'Create Team Member' }) : 'Create Team Member'
  }

  if (normalized.includes('team.update')) {
    return t ? t('common.activityActions.teamUpdate', { defaultValue: 'Update Team Member' }) : 'Update Team Member'
  }

  if (normalized.includes('team.delete')) {
    return t ? t('common.activityActions.teamDelete', { defaultValue: 'Delete Team Member' }) : 'Delete Team Member'
  }

  if (normalized.includes('username.reset_password')) {
    return t ? t('common.activityActions.resetPassword', { defaultValue: 'Reset Password' }) : 'Reset Password'
  }

  if (normalized.includes('username.change')) {
    return t ? t('common.activityActions.changeUsername', { defaultValue: 'Change Username' }) : 'Change Username'
  }

  if (normalized.includes('username.unlock')) {
    return t ? t('common.activityActions.unlockUsername', { defaultValue: 'Unlock Username' }) : 'Unlock Username'
  }

  if (normalized.includes('auth.login')) {
    return t ? t('common.activityActions.login', { defaultValue: 'Login' }) : 'Login'
  }

  const fallback = action.includes('.') ? action.split('.').at(-1) ?? action : action

  return fallback
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatActivityDescription(description: string | null | undefined, locale = 'en-US') {
  if (!description) {
    return '-'
  }

  if (!locale.startsWith('ar')) {
    return description
  }

  const replacements: Array<[RegExp, string]> = [
    [/^Deleted admin account for (.+)\.$/i, 'تم حذف حساب المشرف {{value}}.'],
    [/^Updated admin account for (.+)\.$/i, 'تم تحديث حساب المشرف {{value}}.'],
    [/^Created admin account for (.+)\.$/i, 'تم إنشاء حساب المشرف {{value}}.'],
    [/^Activated (.+) for BIOS (.+)\.$/i, 'تم تفعيل {{value1}} لمعرّف BIOS {{value2}}.'],
    [/^Removed BIOS (.+) from blacklist\.$/i, 'تمت إزالة BIOS {{value}} من القائمة السوداء.'],
    [/^Added BIOS (.+) to blacklist\.$/i, 'تمت إضافة BIOS {{value}} إلى القائمة السوداء.'],
    [/^Unblocked account: (.+)$/i, 'تم إلغاء حظر الحساب: {{value}}'],
    [/^Imported BIOS blacklist CSV\.$/i, 'تم استيراد ملف CSV للقائمة السوداء لـ BIOS.'],
    [/^Scheduled activation executed for license (\d+)\.$/i, 'تم تنفيذ التفعيل المجدول للترخيص {{value}}.'],
    [/^Renewed license (\d+) for BIOS (.+)\.$/i, 'تم تجديد الترخيص {{value1}} لمعرّف BIOS {{value2}}.'],
  ]

  for (const [pattern, template] of replacements) {
    const match = description.match(pattern)
    if (!match) {
      continue
    }

    return template
      .replace('{{value}}', match[1] ?? '')
      .replace('{{value1}}', match[1] ?? '')
      .replace('{{value2}}', match[2] ?? '')
  }

  return description
}

export function formatReadableActivityDescription(description: string | null | undefined, locale = 'en-US') {
  if (!description) {
    return '-'
  }

  if (!locale.startsWith('ar')) {
    return description
  }

  const replacements: Array<[RegExp, string]> = [
    [/^Deleted admin account for (.+)\.$/i, 'تم حذف حساب المشرف {{value}}.'],
    [/^Updated admin account for (.+)\.$/i, 'تم تحديث حساب المشرف {{value}}.'],
    [/^Created admin account for (.+)\.$/i, 'تم إنشاء حساب المشرف {{value}}.'],
    [/^Activated (.+) E2E for BIOS (.+)\.$/i, 'تم تفعيل {{value1}} لمعرّف BIOS {{value2}}.'],
    [/^Activated (.+) for BIOS (.+)\.$/i, 'تم تفعيل {{value1}} لمعرّف BIOS {{value2}}.'],
    [/^Removed BIOS (.+) from blacklist\.$/i, 'تمت إزالة BIOS {{value}} من القائمة السوداء.'],
    [/^Added BIOS (.+) to blacklist\.$/i, 'تمت إضافة BIOS {{value}} إلى القائمة السوداء.'],
    [/^Unblocked account: (.+)$/i, 'تم إلغاء حظر الحساب: {{value}}'],
    [/^Imported BIOS blacklist CSV\.$/i, 'تم استيراد ملف CSV للقائمة السوداء لـ BIOS.'],
    [/^Scheduled activation executed for license (\d+)\.$/i, 'تم تنفيذ التفعيل المجدول للترخيص {{value}}.'],
    [/^Scheduled activation failed for license (\d+)\.$/i, 'فشل التفعيل المجدول للترخيص {{value}}.'],
    [/^Renewed license (\d+) for BIOS (.+)\.$/i, 'تم تجديد الترخيص {{value1}} لمعرّف BIOS {{value2}}.'],
  ]

  for (const [pattern, template] of replacements) {
    const match = description.match(pattern)
    if (!match) {
      continue
    }

    return template
      .replace('{{value}}', match[1] ?? '')
      .replace('{{value1}}', match[1] ?? '')
      .replace('{{value2}}', match[2] ?? '')
  }

  return description
}

export function isCustomerLicenseHistoryAction(action: string) {
  if (!action) {
    return false
  }

  const normalized = action.toLowerCase()
  return normalized.startsWith('customer.') || normalized.startsWith('license.')
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
  pause_reason?: string | null
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

  if (value.status === 'no_license') {
    return 'pending' as const
  }

  return value.status as 'active' | 'expired' | 'suspended' | 'cancelled' | 'inactive' | 'pending'
}

type ExplainedStatus = 'active' | 'expired' | 'pending' | 'cancelled' | 'scheduled' | 'scheduled_failed' | 'inactive'

export function getStatusMeaning(status: string, t: TFunction) {
  const meanings: Record<ExplainedStatus, string> = {
    active: t('common.statusMeaning.active', { defaultValue: 'Live and usable right now.' }),
    expired: t('common.statusMeaning.expired', { defaultValue: 'Time ended automatically.' }),
    pending: t('common.statusMeaning.pending', { defaultValue: 'Saved or created, but not active yet.' }),
    cancelled: t('common.statusMeaning.cancelled', { defaultValue: 'Stopped and removed from the software until renewed or reactivated.' }),
    scheduled: t('common.statusMeaning.scheduled', { defaultValue: 'Will activate automatically later.' }),
    scheduled_failed: t('common.statusMeaning.scheduledFailed', { defaultValue: 'Scheduled activation failed and needs a retry.' }),
    inactive: t('common.statusMeaning.inactive', { defaultValue: 'Not active and unavailable until re-enabled.' }),
  }

  return meanings[status as ExplainedStatus] ?? null
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

export function normalizePhoneInput(value: string) {
  const compact = value.replace(/\s+/g, '')
  if (compact === '') {
    return ''
  }

  const hasLeadingPlus = compact.startsWith('+')
  const digitsOnly = compact.replace(/\D+/g, '')

  return `${hasLeadingPlus ? '+' : ''}${digitsOnly}`
}

export function isValidPhoneNumber(value: string) {
  return /^\+?\d{6,20}$/.test(value.trim())
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
