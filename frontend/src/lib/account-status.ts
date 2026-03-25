export type AccountStatusDisplay = 'active' | 'deactive'
export type AccountStatusFilter = '' | 'active' | 'deactive'

export function normalizeAccountStatus(status?: string | null): AccountStatusDisplay {
  return status === 'active' ? 'active' : 'deactive'
}

export function toStoredAccountStatus(status: AccountStatusDisplay): 'active' | 'inactive' {
  return status === 'active' ? 'active' : 'inactive'
}
