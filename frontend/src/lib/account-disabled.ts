import { ACCOUNT_DISABLED_STORAGE_KEY } from '@/lib/constants'

export type AccountDisabledReason =
  | 'account_inactive'
  | 'account_suspended'
  | 'tenant_inactive'
  | 'tenant_suspended'

export interface AccountDisabledState {
  reason: AccountDisabledReason
  message: string
}

const ACCOUNT_DISABLED_REASONS = new Set<AccountDisabledReason>([
  'account_inactive',
  'account_suspended',
  'tenant_inactive',
  'tenant_suspended',
])

export function isAccountDisabledReason(reason: unknown): reason is AccountDisabledReason {
  return typeof reason === 'string' && ACCOUNT_DISABLED_REASONS.has(reason as AccountDisabledReason)
}

export function extractAccountDisabledState(payload: unknown): AccountDisabledState | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const maybeReason = (payload as { reason?: unknown }).reason
  if (!isAccountDisabledReason(maybeReason)) {
    return null
  }

  const maybeMessage = (payload as { message?: unknown }).message

  return {
    reason: maybeReason,
    message: typeof maybeMessage === 'string' && maybeMessage.trim().length > 0
      ? maybeMessage
      : 'This account is currently unavailable.',
  }
}

export function storeAccountDisabledState(state: AccountDisabledState) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(ACCOUNT_DISABLED_STORAGE_KEY, JSON.stringify(state))
}

export function readAccountDisabledState(): AccountDisabledState | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(ACCOUNT_DISABLED_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as { reason?: unknown; message?: unknown }
    return extractAccountDisabledState(parsed)
  } catch {
    return null
  }
}

export function clearAccountDisabledState() {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(ACCOUNT_DISABLED_STORAGE_KEY)
}
