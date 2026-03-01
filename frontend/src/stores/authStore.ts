import { create } from 'zustand'
import { AUTH_SESSION_STORAGE_KEY, AUTH_STORAGE_KEY } from '@/lib/constants'
import type { User } from '@/types/user.types'

interface AuthState {
  token: string | null
  user: User | null
  remember: boolean
  setSession: (token: string, user: User, remember?: boolean) => void
  setUser: (user: User | null) => void
  clearSession: () => void
}

function readStoredAuth(): Pick<AuthState, 'token' | 'user' | 'remember'> {
  if (typeof window === 'undefined') {
    return { token: null, user: null, remember: true }
  }

  try {
    const localRaw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    const sessionRaw = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)
    const raw = localRaw ?? sessionRaw

    if (!raw) {
      return { token: null, user: null, remember: true }
    }

    const parsed = JSON.parse(raw) as { token?: string | null; user?: User | null }

    return {
      token: parsed.token ?? null,
      user: parsed.user ?? null,
      remember: Boolean(localRaw),
    }
  } catch {
    return { token: null, user: null, remember: true }
  }
}

function persistAuth(token: string | null, user: User | null, remember = true) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY)

  if (!token || !user) {
    return
  }

  const payload = JSON.stringify({ token, user })

  if (remember) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, payload)
    return
  }

  window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, payload)
}

const initialState = readStoredAuth()

export const useAuthStore = create<AuthState>((set) => ({
  token: initialState.token,
  user: initialState.user,
  remember: initialState.remember,
  setSession: (token, user, remember = true) => {
    persistAuth(token, user, remember)
    set({ token, user, remember })
  },
  setUser: (user) => {
    set((state) => {
      persistAuth(state.token, user, state.remember)
      return { user }
    })
  },
  clearSession: () => {
    persistAuth(null, null, true)
    set({ token: null, user: null, remember: true })
  },
}))
