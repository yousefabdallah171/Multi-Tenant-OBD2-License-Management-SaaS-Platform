import { api } from '@/services/api'
import type { PaginatedResponse, TeamMemberDetail, TeamMemberStats, TeamMemberSummary } from '@/types/manager-parent.types'

export interface TeamListParams {
  page?: number
  per_page?: number
  role?: 'manager' | 'reseller' | ''
  status?: 'active' | 'suspended' | 'inactive' | ''
  search?: string
}

export interface TeamPayload {
  name: string
  email: string
  password?: string
  phone?: string | null
  role: 'reseller'
}

export const teamService = {
  async getAll(params: TeamListParams) {
    const { data } = await api.get<PaginatedResponse<TeamMemberSummary>>('/team', { params })
    return data
  },
  async create(payload: TeamPayload) {
    const { data } = await api.post<{ data: TeamMemberSummary }>('/team', payload)
    return data
  },
  async update(id: number, payload: Partial<Omit<TeamPayload, 'role' | 'password'>>) {
    const { data } = await api.put<{ data: TeamMemberSummary }>(`/team/${id}`, payload)
    return data
  },
  async delete(id: number) {
    const { data } = await api.delete<{ message: string }>(`/team/${id}`)
    return data
  },
  async updateStatus(id: number, status: 'active' | 'suspended' | 'inactive') {
    const { data } = await api.put<{ data: TeamMemberSummary }>(`/team/${id}/status`, { status })
    return data
  },
  async getStats(id: number) {
    const { data } = await api.get<{ data: TeamMemberStats }>(`/team/${id}/stats`)
    return data
  },
  async getOne(id: number) {
    const { data } = await api.get<{ data: TeamMemberDetail }>(`/team/${id}`)
    return data
  },
}
