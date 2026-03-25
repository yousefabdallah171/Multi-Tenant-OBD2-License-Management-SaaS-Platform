import { api } from '@/services/api'

export interface ActivationPayload {
  program_id: number
  seller_id?: number
  customer_name: string
  client_name?: string
  customer_email?: string
  customer_phone?: string
  bios_id: string
  preset_id?: number
  duration_days?: number
  price?: number
  is_scheduled?: boolean
  scheduled_date_time?: string
  scheduled_timezone?: string
}

export interface ActivationResponse {
  message: string
  license_key: string
  customer_id: number
  expires_at: string
}

export async function activateLicense(payload: ActivationPayload): Promise<ActivationResponse> {
  const { data } = await api.post<ActivationResponse>('/licenses/activate', payload)
  return data
}
