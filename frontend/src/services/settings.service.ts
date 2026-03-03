import { api } from '@/services/api'
import type { SystemSettings } from '@/types/super-admin.types'

const defaultSettings: SystemSettings = {
  general: {
    platform_name: '',
    default_trial_days: 7,
    maintenance_mode: false,
    server_timezone: 'UTC',
  },
  api: {
    url: '',
    key: '',
    timeout: 30,
    retries: 3,
  },
  notifications: {
    email_enabled: true,
    pusher_enabled: true,
  },
  security: {
    min_password_length: 8,
    session_timeout: 60,
  },
  widgets: {
    show_online_widget_to_resellers: false,
  },
}

function normalizeSettings(payload?: Partial<SystemSettings> | null): SystemSettings {
  return {
    general: { ...defaultSettings.general, ...(payload?.general ?? {}) },
    api: { ...defaultSettings.api, ...(payload?.api ?? {}) },
    notifications: { ...defaultSettings.notifications, ...(payload?.notifications ?? {}) },
    security: { ...defaultSettings.security, ...(payload?.security ?? {}) },
    widgets: { ...defaultSettings.widgets, ...(payload?.widgets ?? {}) },
  }
}

export const settingsService = {
  async get() {
    const { data } = await api.get<{ data: Partial<SystemSettings> | null }>('/super-admin/settings')
    return {
      ...data,
      data: normalizeSettings(data?.data),
    }
  },
  async update(payload: Partial<SystemSettings>) {
    const { data } = await api.put<{ data: SystemSettings; message: string }>('/super-admin/settings', payload)
    return data
  },
  async getOnlineWidgetSettings() {
    const { data } = await api.get<{ data: { show_online_widget_to_resellers: boolean } }>('/online-widget/settings')
    return data
  },
}
