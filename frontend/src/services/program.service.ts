import { api } from '@/services/api'
import type { PaginatedResponse, ProgramStats, ProgramSummary } from '@/types/manager-parent.types'
import type { ProgramDurationPreset } from '@/types/manager-reseller.types'

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
  external_api_key?: string | null
  external_software_id?: number | null
  external_api_base_url?: string | null
  external_logs_endpoint?: string | null
  status?: 'active' | 'inactive'
  presets?: Array<Partial<ProgramDurationPreset> & { label: string; duration_days: number; price: number }>
}

function buildProgramPayload(payload: Partial<ProgramPayload>, includeEmptyKeys: string[] = []) {
  const formData = new FormData()
  const includeEmpty = new Set(includeEmptyKeys)

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) {
      continue
    }

    if (value === null || value === '') {
      if (includeEmpty.has(key)) {
        formData.append(key, '')
      }
      continue
    }

    if (key === 'icon' && value instanceof File) {
      formData.append(key, value)
      continue
    }

    if (key === 'presets' && Array.isArray(value)) {
      value.forEach((preset, index) => {
        Object.entries(preset)
          .filter(([presetKey]) => ['id', 'label', 'duration_days', 'price', 'sort_order', 'is_active'].includes(presetKey))
          .forEach(([presetKey, presetValue]) => {
          if (presetValue === undefined || presetValue === null || presetValue === '') {
            return
          }

          formData.append(
            `presets[${index}][${presetKey}]`,
            typeof presetValue === 'boolean' ? (presetValue ? '1' : '0') : String(presetValue),
          )
          })
      })
      continue
    }

    formData.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
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
    const formData = buildProgramPayload(payload, [
      'file_size',
      'system_requirements',
      'installation_guide_url',
      'external_logs_endpoint',
    ])
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
  async getById(id: number) {
    const { data } = await api.get<{ data: ProgramSummary }>(`/programs/${id}`)
    return data
  },
}
