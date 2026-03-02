import type { PaginatedResponse } from '@/types/manager-parent.types'

export type PeriodFilter = 'daily' | 'weekly' | 'monthly'
export type DurationUnit = 'days' | 'months' | 'years'

export interface DashboardSeriesPoint {
  month?: string
  reseller?: string
  count?: number
  revenue?: number
  activations?: number
}

export interface ManagerDashboardStats {
  team_resellers: number
  team_customers: number
  active_licenses: number
  team_revenue: number
  monthly_activations: number
}

export interface ManagerDashboardPayload {
  stats: ManagerDashboardStats
  activationsChart: DashboardSeriesPoint[]
  revenueChart: DashboardSeriesPoint[]
  recentActivity: RoleActivityEntry[]
}

export interface ResellerDashboardStats {
  customers: number
  active_licenses: number
  revenue: number
  monthly_activations: number
}

export interface RoleActivityEntry {
  id: number
  action: string
  description: string | null
  metadata: Record<string, unknown>
  ip_address?: string | null
  user?: {
    id: number
    name: string
  } | null
  created_at: string | null
}

export interface ManagerTeamReseller {
  id: number
  name: string
  email: string
  phone: string | null
  status: 'active' | 'suspended' | 'inactive'
  customers_count: number
  active_licenses_count: number
  revenue: number
  created_at: string | null
}

export interface ManagerTeamResellerDetail extends ManagerTeamReseller {
  recent_licenses: Array<{
    id: number
    customer: {
      id: number
      name: string
      email: string
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

export interface TeamManagedUser {
  id: number
  name: string
  username: string | null
  email: string
  role: 'reseller' | 'customer'
  status: 'active' | 'suspended' | 'inactive'
  username_locked: boolean
  created_at: string | null
}

export interface ManagerCustomerSummary {
  id: number
  name: string
  email: string | null
  phone?: string | null
  license_id?: number | null
  bios_id: string | null
  reseller: string | null
  reseller_id: number | null
  program: string | null
  status: string | null
  expiry: string | null
  license_count: number
}

export interface ManagerCustomerDetails extends ManagerCustomerSummary {
  username?: string | null
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
    status: string
    duration_days?: number
    price: number
    activated_at: string | null
    expires_at: string | null
  }>
  resellers_summary?: Array<{
    reseller_id: number | null
    reseller_name: string | null
    reseller_email: string | null
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

export interface ResellerCustomerSummary {
  id: number
  name: string
  email: string | null
  phone: string | null
  license_id: number | null
  bios_id: string | null
  program: string | null
  status: 'active' | 'expired' | 'suspended' | 'pending'
  price: number
  expiry: string | null
  license_count: number
}

export interface ResellerCustomerDetails extends ResellerCustomerSummary {
  licenses: Array<{
    id: number
    bios_id: string
    program: string | null
    status: string
    price: number
    activated_at: string | null
    expires_at: string | null
  }>
}

export interface LicenseSummary {
  id: number
  customer_id: number | null
  customer_name: string | null
  customer_email: string | null
  bios_id: string
  external_username?: string | null
  program: string | null
  program_id: number
  reseller_id?: number | null
  reseller_name?: string | null
  duration_days: number
  price: number
  activated_at: string | null
  expires_at: string | null
  status: 'active' | 'expired' | 'suspended' | 'pending'
}

export interface LicenseDetails extends LicenseSummary {
  customer: {
    id: number
    name: string
    email: string
    phone: string | null
  } | null
  program_version: string | null
  download_link: string | null
  activity: Array<{
    id: number
    action: string
    description: string | null
    created_at: string | null
  }>
}

export interface ActivateLicenseData {
  customer_name: string
  customer_email?: string
  customer_phone?: string
  bios_id: string
  program_id: number
  duration_days: number
  price: number
}

export interface RenewLicenseData {
  duration_days: number
  price: number
}

export interface ManagerTeamFilters {
  page?: number
  per_page?: number
  status?: 'active' | 'suspended' | 'inactive' | ''
  search?: string
}

export interface TeamManagedUserFilters {
  page?: number
  per_page?: number
  role?: 'reseller' | 'customer' | ''
  locked?: boolean | ''
  search?: string
}

export interface ManagerCustomerFilters {
  page?: number
  per_page?: number
  reseller_id?: number | ''
  program_id?: number | ''
  status?: string
  search?: string
}

export interface ResellerCustomerFilters {
  page?: number
  per_page?: number
  status?: string
  search?: string
}

export interface LicenseFilters {
  page?: number
  per_page?: number
  status?: string
  search?: string
}

export interface ReportRangeFilters {
  from?: string
  to?: string
}

export interface ResellerReportFilters extends ReportRangeFilters {
  period?: PeriodFilter
}

export interface RoleActivityFilters {
  page?: number
  per_page?: number
  action?: string
  user_id?: number | ''
  from?: string
  to?: string
}

export interface ManagerRevenueRow {
  reseller: string
  revenue: number
  activations: number
}

export interface ManagerActivationPoint {
  month: string
  count: number
}

export interface ManagerTopResellerRow {
  id: number | null
  reseller: string
  revenue: number
  activations: number
  customers: number
}

export interface ManagerSellerLogEntry {
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

export interface ManagerSellerLogSummary {
  total_entries: number
  activations: number
  renewals: number
  deactivations: number
  deletions: number
  revenue: number
}

export interface ResellerReportPoint {
  period: string
  revenue: number
  count: number
}

export interface TopProgramRow {
  program: string
  count: number
  revenue: number
}

export interface ResellerSoftwareProgram {
  id: number
  name: string
  version: string
  price_per_day: number
  is_active: boolean
  has_external_api?: boolean
  external_software_id?: number | null
}

export type PaginatedRoleActivity = PaginatedResponse<RoleActivityEntry>

export interface ManagerSoftwareProgram {
  id: number
  name: string
  description: string | null
  version: string
  download_link: string
  file_size: string | null
  system_requirements: string | null
  installation_guide_url: string | null
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
}

export interface ManagerSoftwareFilters {
  page?: number
  per_page?: number
  status?: '' | 'active' | 'inactive'
  search?: string
}

export interface CreateManagerSoftwareData {
  name: string
  download_link: string
  trial_days?: number
  base_price: number
  icon?: string | null
  description?: string | null
  version?: string
  file_size?: string | null
  system_requirements?: string | null
  installation_guide_url?: string | null
  external_api_key?: string | null
  external_software_id?: number | null
  external_api_base_url?: string | null
  external_logs_endpoint?: string | null
  active?: boolean
}

export interface UpdateManagerSoftwareData extends Partial<CreateManagerSoftwareData> {
  status?: 'active' | 'inactive'
}

export interface ActivateManagerSoftwareData {
  username: string
  bios_id: string
}
