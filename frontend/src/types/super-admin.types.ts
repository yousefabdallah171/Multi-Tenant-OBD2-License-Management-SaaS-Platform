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
  month?: string
  key?: string
  date?: string
  label?: string
  count?: number
  revenue?: number
  activations?: number
  active?: number
  pending?: number
  users?: number
  additions?: number
  removals?: number
}

export interface TenantSummary {
  id: number
  name: string
  slug: string
  status: 'active' | 'suspended' | 'inactive'
  settings: Record<string, unknown> | null
  users_count: number
  managers_count: number
  resellers_count: number
  customers_count: number
  active_licenses_count: number
  revenue: number
  created_at: string | null
}

export interface TenantStats {
  users: number
  managers: number
  resellers: number
  customers: number
  licenses: number
  active_licenses: number
  revenue: number
  deleted_customers: number
}

export interface ManagedUser {
  id: number
  name: string
  email: string | null
  username: string | null
  phone?: string | null
  role: 'super_admin' | 'manager_parent' | 'manager' | 'reseller' | 'customer'
  status: 'active' | 'suspended' | 'inactive'
  username_locked?: boolean
  can_delete: boolean
  tenant: { id: number; name: string; slug?: string; status?: string } | null
  created_by?: { id: number; name: string; email: string | null; role?: 'manager_parent' | 'manager' | 'super_admin' | 'reseller' | 'customer' } | null
  created_at: string | null
}

export interface AssignableManager {
  id: number
  name: string
  email: string | null
  role: 'manager_parent' | 'manager'
}

export interface SuperAdminCustomerSummary {
  id: number
  tenant: { id: number; name: string; slug?: string; status?: string } | null
  name: string
  client_name?: string | null
  username?: string | null
  email: string | null
  phone?: string | null
  country_name?: string | null
  license_id?: number | null
  bios_id: string | null
  external_username?: string | null
  reseller: string | null
  reseller_role?: string | null
  reseller_id?: number | null
  duration_days?: number | null
  program: string | null
  status: string | null
  activated_at?: string | null
  start_at?: string | null
  expiry: string | null
  scheduled_at?: string | null
  scheduled_timezone?: string | null
  scheduled_last_attempt_at?: string | null
  scheduled_failed_at?: string | null
  scheduled_failure_message?: string | null
  is_scheduled?: boolean
  paused_at?: string | null
  pause_remaining_minutes?: number | null
  pause_reason?: string | null
  is_blacklisted?: boolean
  username_locked?: boolean
  license_count: number
  has_active_license?: boolean
}

export interface SuperAdminCustomerDetails extends SuperAdminCustomerSummary {
  created_by?: { id: number; name: string; email: string } | null
  created_at?: string | null
  licenses: Array<{
    id: number
    bios_id: string
    external_username?: string | null
    program: string | null
    reseller: string | null
    reseller_id?: number | null
    reseller_email?: string | null
    reseller_role?: string | null
    status: string
    duration_days?: number
    price: number
    activated_at: string | null
    start_at?: string | null
    expires_at: string | null
    scheduled_at?: string | null
    scheduled_timezone?: string | null
    scheduled_last_attempt_at?: string | null
    scheduled_failed_at?: string | null
    scheduled_failure_message?: string | null
    is_scheduled?: boolean
    paused_at?: string | null
    pause_remaining_minutes?: number | null
    pause_reason?: string | null
    is_blacklisted?: boolean
  }>
  resellers_summary?: Array<{
    reseller_id: number | null
    reseller_name: string | null
    reseller_email: string | null
    reseller_role?: string | null
    activations_count: number
    last_activation_at: string | null
  }>
  ip_logs?: Array<{
    id: number
    ip_address: string
    country: string | null
    country_code?: string | null
    city: string | null
    isp: string | null
    reputation_score: string
    action: string
    created_at: string | null
  }>
  activity?: Array<{
    id: number
    action: string
    description: string | null
    metadata: Record<string, unknown>
    ip_address: string | null
    created_at: string | null
  }>
}

export interface ManagedUserDetail extends ManagedUser {
  customers_count: number
  active_licenses_count: number
  revenue: number
  recent_licenses: Array<{
    id: number
    customer: {
      id: number
      name: string
      email: string | null
    } | null
    program: string | null
    bios_id: string
    status: string
    price: number
    expires_at: string | null
  }>
  recent_activity: Array<{
    id: number
    action: string
    description: string | null
    metadata: Record<string, unknown>
    created_at: string | null
  }>
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
  tenant?: { id: number; name: string } | null
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

export interface BiosConflictItem {
  id: number
  bios_id: string
  tenant_name?: string | null
  conflict_type: string
  attempted_by_name: string | null
  program_name: string | null
  affected_customers: Array<{ id: number | null; name: string; username?: string | null }>
  status: 'open' | 'resolved'
  resolved: boolean
  created_at: string | null
  updated_at: string | null
}

export interface FinancialReportPayload {
  summary: {
    total_platform_revenue: number
    total_customers: number
    total_activations: number
    active_licenses: number
    avg_revenue_per_tenant: number
  }
  revenue_by_tenant: Array<{ tenant: string; revenue: number }>
  revenue_by_program: Array<{ program: string; revenue: number; activations: number }>
  revenue_breakdown: Array<Record<string, string | number>>
  revenue_breakdown_series: string[]
  monthly_revenue: Array<{ month: string; revenue: number }>
  reseller_balances: Array<{
    id: number | string
    reseller: string | null
    role?: string | null
    tenant: string | null
    total_revenue: number
    total_activations: number
    avg_price: number
  }>
}

export interface TenantBackupStats {
  customers: number
  licenses: number
  bios_change_requests: number
  bios_access_logs: number
  bios_conflicts: number
  activity_logs: number
  api_logs: number
  user_ip_logs: number
  reseller_commissions: number
  reseller_payments: number
  financial_reports: number
  user_balances: number
  [key: string]: number
}

export interface TenantBackup {
  id: number
  tenant_id: number
  label: string | null
  stats: TenantBackupStats
  created_by: { id: number; name: string; email: string } | null
  created_at: string | null
}

export interface SystemSettings {
  general: {
    platform_name: string
    default_trial_days: number
    maintenance_mode: boolean
    server_timezone: string
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
  widgets: {
    show_online_widget_to_resellers: boolean
  }
  appearance: {
    dashboard: DashboardAppearanceSettings
  }
}

export interface DashboardAppearanceSurfaceSettings {
  opacity_percent: number
  brightness_percent: number
}

export interface DashboardAppearanceSettings {
  font_family: string
  font_sizes: {
    display_px: number
    heading_px: number
    body_px: number
    label_px: number
    table_header_px: number
    table_cell_px: number
    helper_px: number
  }
  font_weights: {
    display: 400 | 500 | 600 | 700 | 800 | 900
    heading: 400 | 500 | 600 | 700 | 800 | 900
    body: 400 | 500 | 600 | 700 | 800 | 900
    label: 400 | 500 | 600 | 700 | 800 | 900
    table_header: 400 | 500 | 600 | 700 | 800 | 900
  }
  surfaces: {
    cards: DashboardAppearanceSurfaceSettings
    charts: DashboardAppearanceSurfaceSettings
    badges: DashboardAppearanceSurfaceSettings
  }
}

export interface LockedAccount {
  email: string
  attempt_count: number
  ip: string
  user_agent: string
  device: string
  seconds_remaining: number
  unlocks_at: number
  country_code: string | null
  country_name: string
  city: string
  isp: string
}

export interface BlockedIp {
  ip: string
  blocked_at: string
  email: string
  user_agent: string
  device: string
  country_code: string | null
  country_name: string
  city: string
  isp: string
}

export interface SecurityAuditLog {
  id: number
  action: 'security.unblock_email' | 'security.unblock_ip' | 'security.block_ip' | string
  description: string
  metadata: Record<string, unknown>
  admin: { id: number; name: string; email: string } | null
  admin_ip: string | null
  created_at: string | null
}

export interface SecurityLocksData {
  locked_accounts: LockedAccount[]
  blocked_ips: BlockedIp[]
}

export interface DeletedCustomer {
  id: number
  original_customer_id: number | null
  name: string
  email: string
  username: string | null
  phone: string | null
  tenant: { id: number; name: string } | null
  deleted_by: { id: number; name: string; email: string } | null
  deleted_at: string
  licenses_count: number
  revenue_total: number
}

export interface DeletedCustomerDetail extends DeletedCustomer {
  snapshot: {
    user: Record<string, unknown>
    licenses: Record<string, unknown>[]
    activity_log_ids: number[]
  }
}

export interface ImpersonationTargetSummary {
  id: number
  name: string
  email: string | null
  role: 'manager_parent' | 'manager' | 'reseller'
  status: 'active' | 'suspended' | 'inactive'
  tenant: { id: number; name: string } | null
  last_seen_at: string | null
}

export interface ImpersonationTargetListResponse {
  data: ImpersonationTargetSummary[]
  meta: PaginationMeta
}

export interface ImpersonationStartResponse {
  data: {
    token: string
    expires_at: string
    target: {
      id: number
      name: string
      email: string | null
      role: 'manager_parent' | 'manager' | 'reseller'
      tenant_id: number | null
    }
  }
}
