import { api } from '@/services/api'
import type { UserRole } from '@/types/user.types'

export interface OnlineUser {
  masked_name: string
  role: UserRole
  last_seen_at?: string | null
}

export const onlineService = {
  async getOnlineUsers(path: '/online-users' | '/manager/online-users' | '/super-admin/online-users' | '/reseller/online-users') {
    const { data } = await api.get<{ data: OnlineUser[] }>(path)
    return data.data
  },
}

