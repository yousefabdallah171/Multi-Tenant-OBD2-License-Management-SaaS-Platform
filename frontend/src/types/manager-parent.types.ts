import type { LogEntry, PaginationMeta } from '@/types/super-admin.types'
import type { ProgramDurationPreset } from '@/types/manager-reseller.types'

export interface ManagerParentDashboardStats {
  users: number
  programs: number
  licenses: number
  active_licenses: number
  revenue: number
  team_members: number
  resellers: number
  total_customers: number
  monthly_revenue: number
}

export interface ManagerParentDashboardPayload {
  stats: ManagerParentDashboardStats
  revenueChart: Array<{ month: string; revenue: number }>
  expiryForecast: Array<{ range: string; count: number }>
  teamPerformance: Array<{ id: number; name: string; role: string; activations: number; revenue: number; customers: number }>
  conflictRate: Array<{ month: string; count: number }>
}

export interface ChartPoint {
  month?: string
  range?: string
  name?: string
  label?: string
  date?: string
  program?: string
  reseller?: string
  country?: string
  revenue?: number
  count?: number
  activations?: number
  customers?: number
  percentage?: number
  additions?: number
  removals?: number
}

export interface TeamMemberSummary {
  id: number
  name: string
  username: string | null
  email: string
  phone: string | null
  role: 'manager' | 'reseller'
  status: 'active' | 'suspended' | 'inactive'
  username_locked: boolean
  customers_count: number
  active_licenses_count: number
  revenue: number
  can_delete: boolean
  created_at: string | null
}

export interface TeamMemberStats {
  customers: number
  active_licenses: number
  revenue: number
}

export interface TeamMemberDetail extends TeamMemberSummary {
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
  seller_log_history: Array<{
    id: number
    action: string
    description: string | null
    customer_id: number | null
    customer_name: string | null
    customer_email: string | null
    program_id: number | null
    program_name: string | null
    bios_id: string | null
    license_id: number | null
    license_status: string | null
    price: number | null
    ip_address: string | null
    created_at: string | null
  }>
}

export interface ProgramSummary {
  id: number
  name: string
  description: string | null
  version: string
  download_link: string
  file_size?: string | null
  system_requirements?: string | null
  installation_guide_url?: string | null
  trial_days: number
  base_price: number
  icon: string | null
  has_external_api: boolean
  external_software_id: number | null
  external_api_base_url: string | null
  external_logs_endpoint: string
  status: 'active' | 'inactive'
  licenses_sold: number
  active_licenses_count: number
  revenue: number
  created_at: string | null
  duration_presets?: ProgramDurationPreset[]
}

export interface ProgramLog {
  type: 'add' | 'delete' | 'login'
  username: string
  bios_id?: string
  timestamp: string
  ip?: string
  customer_id?: number | null
}

export interface ProgramLogUserOption {
  id: number
  name: string
  role: string
}

export interface ProgramUserLogEntry {
  id: number
  action: string
  actor: {
    id: number
    name: string
    role: string
  } | null
  license_id: number | null
  customer_id: number | null
  customer_name: string | null
  customer_username: string | null
  bios_id: string
  external_username: string
  program_id: number
  program_name: string
  price: number | null
  license_status: string | null
  created_at: string | null
}

export interface ProgramLogSummary {
  total_entries: number
  activations: number
  scheduled: number
  executed: number
  renewals: number
  deactivations: number
  failures: number
}

export interface ProgramStats {
  licenses_sold: number
  active_licenses: number
  expired_licenses: number
  revenue: number
}

export interface PricingRow {
  program_id: number
  program_name: string
  base_price: number
  reseller_price: number
  commission_rate: number
  margin: number
}

export interface PricingPayload {
  resellers: Array<{ id: number; name: string; email: string }>
  selected_reseller_id: number | null
  programs: PricingRow[]
}

export interface PricingHistoryEntry {
  id: number
  reseller: string | null
  program: string | null
  old_price: number | null
  new_price: number
  commission_rate: number
  change_type: 'single' | 'bulk'
  changed_by: string | null
  created_at: string | null
}

export interface ActivityEntry {
  id: number
  action: string
  description: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  user: { id: number; name: string } | null
  created_at: string | null
}

export interface SellerLogEntry {
  id: number
  action: string
  description: string | null
  ip_address: string | null
  seller: { id: number | null; name: string | null; role: string | null } | null
  customer_id: number | null
  customer_name: string | null
  program_id: number | null
  program_name: string | null
  bios_id: string | null
  license_id: number | null
  license_status: string | null
  price: number | null
  metadata: Record<string, unknown>
  created_at: string | null
}

export interface SellerLogSummary {
  total_entries: number
  activations: number
  renewals: number
  deactivations: number
  deletions: number
  revenue: number
}

export interface CustomerSummary {
  id: number
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
  bios_active_elsewhere?: boolean
  username_locked?: boolean
  license_count: number
  has_active_license?: boolean
}

export interface CustomerDetails extends CustomerSummary {
  username?: string | null
  external_username?: string | null
  phone?: string | null
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

export interface CustomerLicenseHistoryEntry {
  id: number
  program_name: string | null
  reseller_id: number | null
  reseller_name: string | null
  reseller_email?: string | null
  reseller_role?: string | null
  bios_id: string
  external_username?: string | null
  activated_at: string | null
  start_at?: string | null
  expires_at: string | null
  duration_days: number
  price: number
  status: string
  is_blacklisted?: boolean
  paused_at?: string | null
  pause_reason?: string | null
}

export interface ManagerParentBiosChangeRequest {
  id: number
  license_id: number
  customer_id: number | null
  customer_name: string | null
  program_name: string | null
  old_bios_id: string
  new_bios_id: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  reseller_id: number | null
  reseller_name: string | null
  reseller_email: string | null
  reseller_role?: string | null
  reviewer_id?: number | null
  reviewer_name?: string | null
  reviewer_notes?: string | null
  reviewed_at?: string | null
  created_at: string | null
}

export interface TenantSettings {
  business: {
    company_name: string
    email: string | null
    phone: string | null
    address: string | null
  }
  defaults: {
    trial_days: number
    base_price: number
  }
  notifications: {
    new_activations: boolean
    expiry_warnings: boolean
  }
  branding: {
    logo: string | null
    primary_color: string | null
  }
}

export interface BiosHistoryEntry {
  id: string
  bios_id: string
  customer: string | null
  customer_id?: number | null
  external_username?: string | null
  reseller: string | null
  reseller_id: number | null
  reseller_role?: string | null
  action: string
  status: string
  description: string
  occurred_at: string | null
}

export interface BiosChangeAuditEntry {
  id: string
  type: 'request' | 'direct_change'
  reseller_id: number | null
  reseller_name: string | null
  manager_id: number | null
  manager_name: string | null
  old_bios_id: string
  new_bios_id: string
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed'
  reason: string | null
  reviewer_notes: string | null
  customer_name: string | null
  program_name: string | null
  license_id: number | null
  occurred_at: string | null
}

export interface BiosChangeAuditSummary {
  total_requests: number
  approved: number
  rejected: number
  pending: number
  direct_changes: number
}

export interface BiosChangeAuditParams {
  page?: number
  per_page?: number
  manager_id?: number | undefined
  reseller_id?: number | undefined
  type?: 'request' | 'direct_change' | undefined
  status?: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed' | undefined
  from?: string
  to?: string
}

export interface IpAnalyticsEntry {
  username: string
  raw_username?: string
  raw_timestamp?: string | null
  external_username?: string | null
  bios_id: string | null
  customer_id: number | null
  customer_name?: string | null
  customer_username?: string | null
  reseller_id?: number | null
  reseller_name?: string | null
  license_id?: number | null
  program_id?: number | null
  program_name?: string | null
  external_software_id?: number | null
  ip_address: string
  timestamp: string
  parsed_at?: string | null
  country: string
  country_code: string
  city: string
  isp: string
  proxy: boolean
  hosting: boolean
}

export interface IpAnalyticsStats {
  countries: Array<{ country: string; count: number }>
  suspicious: Array<{
    id: number
    ip_address: string
    country: string | null
    user_id: number | null
    created_at: string | null
  }>
}

export interface UsernameManagedUser {
  id: number
  name: string
  username: string | null
  email: string
  role: string
  status: string
  username_locked: boolean
  created_at: string | null
}

export interface FinancialReportData {
  summary: {
    total_revenue: number
    granted_value: number
    total_activations: number
    total_customers: number
    active_customers: number
    active_licenses: number
  }
  revenue_by_reseller: Array<{ id: number; reseller: string; email?: string | null; role?: string | null; revenue: number; activations: number }>
  revenue_by_program: Array<{ program: string; revenue: number; activations: number }>
  monthly_revenue: Array<{ month: string; revenue: number }>
  reseller_balances: Array<{
    id: number
    reseller: string
    email?: string | null
    role?: string | null
    total_revenue: number
    total_activations: number
    avg_price: number
    still_not_paid: number
  }>
}

export interface SellerScopeParams {
  manager_parent_id?: number | ''
  manager_id?: number | ''
  reseller_id?: number | ''
  scope_name?: string
  scope_role?: 'manager_parent' | 'manager' | 'reseller' | ''
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface LogFilters {
  page?: number
  per_page?: number
  endpoint?: string
  method?: string
  status_group?: string
  status_from?: number | ''
  status_to?: number | ''
  from?: string
  to?: string
}

export type ManagerParentLogEntry = LogEntry

export interface ManagerParentApiStatus {
  status: 'online' | 'offline' | 'degraded'
  response_time_ms: number
  last_checked: string
  external_url: string | null
  status_code?: number
  message?: string | null
  program_id?: number | null
  program_name?: string | null
  software_id?: number | null
}

export interface ApiStatusHistoryPoint {
  time: string
  response_time_ms: number
  success_rate: number
}

export interface BiosConflictItem {
  id: number
  bios_id: string
  conflict_type: string
  attempted_by_name: string | null
  reseller_name?: string | null
  program_name: string | null
  affected_customers: Array<{ id: number | null; name: string; username?: string | null }>
  status: 'open' | 'resolved'
  resolved: boolean
  created_at: string | null
  updated_at: string | null
}

export interface BiosConflictFilters {
  page?: number
  per_page?: number
  status?: '' | 'open' | 'resolved'
  conflict_type?: string
  from?: string
  to?: string
}

export interface NetworkTenantRootNode {
  id: number
  name: string
  role: 'tenant'
  total_revenue: number
  balance: number
  manager_parents_count: number
  managers_count: number
  resellers_count: number
  total_customers: number
}

export interface NetworkManagerParentNode {
  id: number
  name: string
  email: string
  role: 'manager_parent'
  status: string
  revenue: number
  balance: number
  managers_count: number
  resellers_count: number
  customers_count: number
  is_current: boolean
}

export interface NetworkManagerNode {
  id: number
  name: string
  email: string
  role: 'manager'
  status: string
  manager_parent_id: number | null
  revenue: number
  resellers_count: number
  customers_count: number
  activations_count: number
}

export interface NetworkResellerNode {
  id: number
  name: string
  email: string
  role: 'reseller'
  status: string
  manager_id: number | null
  manager_parent_id: number | null
  revenue: number
  activations_count: number
  customers_count: number
}

export interface NetworkDiagramPayload {
  root: NetworkTenantRootNode
  manager_parents: NetworkManagerParentNode[]
  managers: NetworkManagerNode[]
  resellers: NetworkResellerNode[]
}
