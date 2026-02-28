import { api } from '@/services/api'
import type { PricingHistoryEntry, PricingPayload } from '@/types/manager-parent.types'

export const pricingService = {
  async getAll(resellerId?: number | null) {
    const { data } = await api.get<{ data: PricingPayload }>('/pricing', {
      params: resellerId ? { reseller_id: resellerId } : undefined,
    })
    return data
  },
  async update(programId: number, payload: { reseller_id: number; reseller_price: number; commission_rate?: number }) {
    const { data } = await api.put<{ data: { program_id: number; reseller_id: number; reseller_price: number; commission_rate: number } }>(`/pricing/${programId}`, payload)
    return data
  },
  async bulk(payload: { reseller_ids: number[]; mode: 'fixed' | 'markup'; value: number; commission_rate?: number }) {
    const { data } = await api.post<{ message: string; updated: number }>('/pricing/bulk', payload)
    return data
  },
  async history(params?: { reseller_id?: number; program_id?: number; limit?: number }) {
    const { data } = await api.get<{ data: PricingHistoryEntry[] }>('/pricing/history', { params })
    return data
  },
}
