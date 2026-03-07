export type UserRole = 'super_admin' | 'manager_parent' | 'manager' | 'reseller' | 'customer'

export type UserStatus = 'active' | 'suspended' | 'inactive'

export interface Tenant {
  id: number
  name: string
  slug: string
  status: string
  settings?: Record<string, unknown> | null
}

export interface User {
  id: number
  tenant_id: number | null
  name: string
  username: string | null
  email: string
  phone: string | null
  timezone?: string | null
  role: UserRole
  status: UserStatus
  created_by: number | null
  username_locked: boolean
  tenant?: Tenant | null
}
