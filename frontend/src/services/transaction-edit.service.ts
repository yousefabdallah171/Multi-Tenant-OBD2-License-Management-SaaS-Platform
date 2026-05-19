import { api } from '@/services/api'

export interface EditTransactionRequest {
  price?: number
  customer_id?: number
  activated_at?: string
  duration_days?: number
  program_id?: number
  reason?: string
}

export interface TransactionDetailsResponse {
  data: {
    transaction: {
      license_id: number
      activity_log_id: number
      tenant_id: number
      tenant_name: string
      reseller_id: number
      reseller_name: string
      customer_id: number | null
      customer_name: string | null
      customer_email: string | null
      bios_id: string
      program_id: number
      program_name: string
      price: number
      duration_days: number
      activated_at: string
      expires_at: string
      status: string
      created_at: string
      updated_at: string
    }
    edit_history: Array<{
      id: number
      super_admin_name: string
      super_admin_email: string
      action: string
      previous_values: Record<string, any>
      new_values: Record<string, any>
      reason: string | null
      diffs: Record<string, any>
      created_at: string
    }>
  }
}

export interface EditTransactionResponse {
  data: {
    license_id: number
    activity_log_id: number
    tenant_id: number
    tenant_name: string
    reseller_id: number
    reseller_name: string
    customer_id: number | null
    customer_name: string | null
    customer_email: string | null
    bios_id: string
    program_id: number
    program_name: string
    price: number
    duration_days: number
    activated_at: string
    expires_at: string
    status: string
    last_edited: {
      by: string
      at: string
      reason: string | null
    }
  }
  message: string
  affected: {
    licenses_updated: number
    activity_logs_updated: number
    caches_invalidated: number
    balances_recalculated: Array<{
      user_id: number
      user_name: string
      user_role: string
      total_revenue: number
    }>
    edit_id: number
  }
}

export interface TransactionHistoryResponse {
  data: Array<{
    id: number
    super_admin_id: number
    super_admin_name: string
    super_admin_email: string
    action: string
    previous_values: Record<string, any>
    new_values: Record<string, any>
    reason: string | null
    diffs: Record<string, any>
    created_at: string
  }>
  summary: {
    license_id: number
    activity_log_id?: number
    total_edits: number
  }
}

/**
 * Get transaction details with full edit history
 */
export async function getTransactionDetails(activityLogId: number): Promise<TransactionDetailsResponse['data']> {
  const { data } = await api.get<TransactionDetailsResponse>(
    `/super-admin/transactions/activity-logs/${activityLogId}/editable`
  )
  return data.data
}

/**
 * Edit a transaction (price, customer, date, program, duration)
 */
export async function editTransaction(
  activityLogId: number,
  payload: EditTransactionRequest
): Promise<EditTransactionResponse> {
  const { data } = await api.patch<EditTransactionResponse>(
    `/super-admin/transactions/activity-logs/${activityLogId}`,
    payload
  )
  return data
}

/**
 * Revert a transaction to its previous state
 */
export async function revertTransaction(
  activityLogId: number,
  reason?: string
): Promise<EditTransactionResponse> {
  const { data } = await api.post<EditTransactionResponse>(
    `/super-admin/transactions/activity-logs/${activityLogId}/revert`,
    { reason }
  )
  return data
}

/**
 * Get full transaction edit history
 */
export async function getTransactionHistory(
  activityLogId: number
): Promise<TransactionHistoryResponse['data']> {
  const { data } = await api.get<TransactionHistoryResponse>(
    `/super-admin/transactions/activity-logs/${activityLogId}/history`
  )
  return data.data
}
