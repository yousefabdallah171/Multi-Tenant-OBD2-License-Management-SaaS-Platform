import { create } from 'zustand'
import { THEME_STORAGE_KEY } from '@/lib/constants'

export type ThemeMode = 'light' | 'dark'

interface ThemeState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

function readTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readTheme(),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    }

    set({ theme })
  },
  toggleTheme: () => {
    const nextTheme: ThemeMode = get().theme === 'dark' ? 'light' : 'dark'
    get().setTheme(nextTheme)
  },
}))
