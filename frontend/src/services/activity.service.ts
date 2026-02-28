import { api } from '@/services/api'
import type { ActivityEntry, PaginatedResponse } from '@/types/manager-parent.types'
import { downloadFile } from '@/utils/download'

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
