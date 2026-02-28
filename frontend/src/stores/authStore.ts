import { create } from 'zustand'
import { AUTH_STORAGE_KEY } from '@/lib/constants'
import type { User } from '@/types/user.types'

interface AuthState {
  token: string | null
  user: User | null
  setSession: (token: string, user: User) => void
  setUser: (user: User | null) => void
  clearSession: () => void
}

function readStoredAuth(): Pick<AuthState, 'token' | 'user'> {
  if (typeof window === 'undefined') {
    return { token: null, user: null }
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)

    if (!raw) {
      return { token: null, user: null }
    }

    const parsed = JSON.parse(raw) as { token?: string | null; user?: User | null }

    return {
      token: parsed.token ?? null,
      user: parsed.user ?? null,
    }
  } catch {
    return { token: null, user: null }
  }
}

function persistAuth(token: string | null, user: User | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (!token || !user) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user }))
}

const initialState = readStoredAuth()

export const useAuthStore = create<AuthState>((set) => ({
  token: initialState.token,
  user: initialState.user,
  setSession: (token, user) => {
    persistAuth(token, user)
    set({ token, user })
  },
  setUser: (user) => {
    set((state) => {
      persistAuth(state.token, user)
      return { user }
    })
  },
  clearSession: () => {
    persistAuth(null, null)
    set({ token: null, user: null })
  },
}))
