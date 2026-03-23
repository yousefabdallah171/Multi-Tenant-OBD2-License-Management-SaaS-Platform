import { create } from 'zustand'
import { AUTH_SESSION_STORAGE_KEY, AUTH_STORAGE_KEY } from '@/lib/constants'
import type { User } from '@/types/user.types'

interface AuthState {
  user: User | null
  remember: boolean
  setSession: (user: User, remember?: boolean) => void
  setUser: (user: User | null) => void
  clearSession: () => void
}

function readStoredAuth(): Pick<AuthState, 'user' | 'remember'> {
  if (typeof window === 'undefined') {
    return { user: null, remember: true }
  }

  try {
    const localRaw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    const sessionRaw = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)
    const raw = localRaw ?? sessionRaw

    if (!raw) {
      return { user: null, remember: true }
    }

    const parsed = JSON.parse(raw) as { user?: User | null }

    return {
      user: parsed.user ?? null,
      remember: Boolean(localRaw),
    }
  } catch {
    return { user: null, remember: true }
  }
}

function persistAuth(user: User | null, remember = true) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY)

  if (!user) {
    return
  }

  const payload = JSON.stringify({ user })

  if (remember) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, payload)
    return
  }

  window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, payload)
}

const initialState = readStoredAuth()

export const useAuthStore = create<AuthState>((set) => ({
  user: initialState.user,
  remember: initialState.remember,
  setSession: (user, remember = true) => {
    persistAuth(user, remember)
    set({ user, remember })
  },
  setUser: (user) => {
    set((state) => {
      persistAuth(user, state.remember)
      return { user }
    })
  },
  clearSession: () => {
    persistAuth(null, true)
    set({ user: null, remember: true })
  },
}))
