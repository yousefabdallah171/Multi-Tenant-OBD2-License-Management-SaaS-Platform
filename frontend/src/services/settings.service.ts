import { api } from '@/services/api'
import type { SystemSettings } from '@/types/super-admin.types'

export const settingsService = {
  async get() {
    const { data } = await api.get<{ data: SystemSettings }>('/super-admin/settings')
    return data
  },
  async update(payload: Partial<SystemSettings>) {
    const { data } = await api.put<{ data: SystemSettings; message: string }>('/super-admin/settings', payload)
    return data
  },
}
