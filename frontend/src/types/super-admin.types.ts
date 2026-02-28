export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number | null
  to: number | null
}

export interface SuperAdminDashboardStats {
  total_tenants: number
  total_revenue: number
  active_licenses: number
  total_users: number
  ip_country_map: Array<{ country: string; count: number }>
}

export interface TrendPoint {
  month: string
  key?: string
  revenue?: number
  activations?: number
  active?: number
  pending?: number
  users?: number
}

export interface TenantSummary {
  id: number
  name: string
  slug: string
  status: 'active' | 'suspended' | 'inactive'
  settings: Record<string, unknown> | null
  managers_count: number
  resellers_count: number
  customers_count: number
  active_licenses_count: number
  revenue: number
  created_at: string | null
}

export interface TenantStats {
  users: number
  resellers: number
  customers: number
  licenses: number
  active_licenses: number
  revenue: number
}

export interface ManagedUser {
  id: number
  name: string
  email: string
  username: string | null
  phone?: string | null
  role: 'super_admin' | 'manager_parent' | 'manager' | 'reseller' | 'customer'
  status: 'active' | 'suspended' | 'inactive'
  username_locked?: boolean
  tenant: { id: number; name: string; slug?: string; status?: string } | null
  created_at: string | null
}

export interface RoleCounts {
  super_admin: number
  manager_parent: number
  manager: number
  reseller: number
  customer: number
}

export interface ReportBarItem {
  tenant?: string
  reseller?: string
  program?: string
  revenue?: number
  activations?: number
  active?: number
  pending?: number
  users?: number
}

export interface LogEntry {
  id: number
  tenant: string | null
  user: string | null
  endpoint: string
  method: string
  status_code: number
  response_time_ms: number
  request_body?: Record<string, unknown> | null
  response_body?: Record<string, unknown> | null
  created_at: string | null
}

export interface ApiEndpointStatus {
  endpoint: string
  status: 'online' | 'offline' | 'degraded' | 'unknown'
  status_code?: number | null
  last_checked_at?: string | null
}

export interface ApiStatusSummary {
  status: 'online' | 'offline' | 'degraded'
  last_check_at: string
  response_time_ms: number
  uptime: {
    '24h': number
    '7d': number
    '30d': number
  }
  endpoints: ApiEndpointStatus[]
}

export interface BiosBlacklistEntry {
  id: number
  bios_id: string
  reason: string
  status: 'active' | 'removed'
  added_by: string | null
  created_at: string | null
}

export interface BiosHistoryEvent {
  id: string
  bios_id: string
  tenant_id: number | null
  tenant: string | null
  customer: string | null
  action: string
  status: string
  description: string
  occurred_at: string
}

export interface FinancialReportPayload {
  summary: {
    total_platform_revenue: number
    total_activations: number
    active_licenses: number
    avg_revenue_per_tenant: number
  }
  revenue_by_tenant: Array<{ tenant: string; revenue: number }>
  revenue_by_program: Array<{ program: string; revenue: number; activations: number }>
  monthly_revenue: Array<{ month: string; revenue: number }>
  reseller_balances: Array<{
    id: number | string
    reseller: string | null
    tenant: string | null
    total_revenue: number
    total_activations: number
    avg_price: number
    balance: number
  }>
}

export interface SystemSettings {
  general: {
    platform_name: string
    default_trial_days: number
    maintenance_mode: boolean
  }
  api: {
    url: string
    key: string
    timeout: number
    retries: number
  }
  notifications: {
    email_enabled: boolean
    pusher_enabled: boolean
  }
  security: {
    min_password_length: number
    session_timeout: number
  }
}
