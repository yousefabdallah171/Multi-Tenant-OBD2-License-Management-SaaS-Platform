import { api } from '@/services/api'

export interface ActivationPayload {
  program_id: number
  customer_name: string
  customer_email?: string
  customer_phone?: string
  bios_id: string
  duration_days: number
  price: number
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
