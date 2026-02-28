import { api } from '@/services/api'
import type { ActivityEntry, PaginatedResponse } from '@/types/manager-parent.types'

async function downloadFile(url: string, filename: string, params?: object) {
  const response = await api.get<Blob>(url, {
    params,
    responseType: 'blob',
  })

  const blobUrl = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(blobUrl)
}

export interface ActivityParams {
  page?: number
  per_page?: number
  user_id?: number | ''
  action?: string
  from?: string
  to?: string
}

export const activityService = {
  async getAll(params: ActivityParams) {
    const { data } = await api.get<PaginatedResponse<ActivityEntry>>('/activity', { params })
    return data
  },
  async export(params: ActivityParams) {
    await downloadFile('/activity/export', 'manager-parent-activity.csv', params)
  },
}
