import { api } from '@/services/api'
import type { ApiMessageResponse } from '@/types/api.types'
import type { User } from '@/types/user.types'

export const profileService = {
  async updateProfile(payload: Pick<User, 'name' | 'email' | 'phone' | 'timezone'>) {
    const { data } = await api.put<{ message: string; user: User }>('/auth/profile', payload)
    return data
  },
  async updatePassword(payload: { current_password: string; password: string; password_confirmation: string }) {
    const { data } = await api.put<ApiMessageResponse>('/auth/password', payload)
    return data
  },
}
