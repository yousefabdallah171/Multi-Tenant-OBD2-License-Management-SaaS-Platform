import { IMPERSONATION_AUTH_STORAGE_KEY, IMPERSONATION_STATE_STORAGE_KEY } from '@/lib/constants'
import type { User } from '@/types/user.types'

export interface ImpersonationActor {
  id: number
  name: string
  email: string
}

export interface ImpersonationTarget {
  id: number
  name: string
  email: string
  role: User['role']
}

export interface ImpersonationState {
  active: boolean
  token: string
  actor: ImpersonationActor
  target: ImpersonationTarget
  started_at: string
  expires_at: string
}

export function getImpersonationState(): ImpersonationState | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(IMPERSONATION_STATE_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as ImpersonationState
    if (!parsed?.active || !parsed?.token) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function setImpersonationState(state: ImpersonationState): void {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(IMPERSONATION_STATE_STORAGE_KEY, JSON.stringify(state))
}

export function clearImpersonationState(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(IMPERSONATION_STATE_STORAGE_KEY)
  window.sessionStorage.removeItem(IMPERSONATION_AUTH_STORAGE_KEY)
}

export function isImpersonationActive(): boolean {
  const state = getImpersonationState()
  if (!state) {
    return false
  }

  const expiresAt = Number(new Date(state.expires_at))
  if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
    clearImpersonationState()
    return false
  }

  return true
}

