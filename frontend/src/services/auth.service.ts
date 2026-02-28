import { api } from '@/services/api'
import type { ApiMessageResponse, LoginPayload } from '@/types/api.types'
import type { User } from '@/types/user.types'

export interface LoginResponse {
  token: string
  user: User
}

export interface MeResponse {
  user: User
}

export const authService = {
  async login(payload: LoginPayload) {
    const { data } = await api.post<LoginResponse>('/auth/login', payload)
    return data
  },
  async logout() {
    const { data } = await api.post<ApiMessageResponse>('/auth/logout')
    return data
  },
  async getMe() {
    const { data } = await api.get<MeResponse>('/auth/me')
    return data
  },
  async forgotPassword(email: string) {
    const { data } = await api.post<ApiMessageResponse>('/auth/forgot-password', { email })
    return data
  },
}
