import { api } from '@/services/api'
import type { PaginatedResponse, ProgramStats, ProgramSummary } from '@/types/manager-parent.types'

export interface ProgramListParams {
  page?: number
  per_page?: number
  status?: 'active' | 'inactive' | ''
  search?: string
}

export interface ProgramPayload {
  name: string
  description?: string | null
  version?: string
  download_link: string
  file_size?: string | null
  system_requirements?: string | null
  installation_guide_url?: string | null
  trial_days?: number
  base_price: number
  icon?: File | string | null
  status?: 'active' | 'inactive'
}

function buildProgramPayload(payload: Partial<ProgramPayload>) {
  const formData = new FormData()

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    if (key === 'icon' && value instanceof File) {
      formData.append(key, value)
      continue
    }

    formData.append(key, String(value))
  }

  return formData
}

export const programService = {
  async getAll(params: ProgramListParams) {
    const { data } = await api.get<PaginatedResponse<ProgramSummary>>('/programs', { params })
    return data
  },
  async create(payload: ProgramPayload) {
    const { data } = await api.post<{ data: ProgramSummary }>('/programs', buildProgramPayload(payload), {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return data
  },
  async update(id: number, payload: Partial<ProgramPayload>) {
    const formData = buildProgramPayload(payload)
    formData.append('_method', 'PUT')

    const { data } = await api.post<{ data: ProgramSummary }>(`/programs/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return data
  },
  async delete(id: number) {
    const { data } = await api.delete<{ message: string }>(`/programs/${id}`)
    return data
  },
  async getStats(id: number) {
    const { data } = await api.get<{ data: ProgramStats }>(`/programs/${id}/stats`)
    return data
  },
}
