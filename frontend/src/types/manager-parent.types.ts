import type { PaginationMeta } from '@/types/super-admin.types'

export interface ManagerParentDashboardStats {
  users: number
  programs: number
  licenses: number
  active_licenses: number
  revenue: number
  team_members: number
  total_customers: number
  monthly_revenue: number
}

export interface ChartPoint {
  month?: string
  range?: string
  name?: string
  label?: string
  program?: string
  reseller?: string
  country?: string
  revenue?: number
  count?: number
  activations?: number
  customers?: number
  percentage?: number
}

export interface TeamMemberSummary {
  id: number
  name: string
  email: string
  phone: string | null
  role: 'manager' | 'reseller'
  status: 'active' | 'suspended' | 'inactive'
  customers_count: number
  active_licenses_count: number
  revenue: number
  created_at: string | null
}

export interface TeamMemberStats {
  customers: number
  active_licenses: number
  revenue: number
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
  status: 'active' | 'inactive'
  licenses_sold: number
  active_licenses_count: number
  revenue: number
  created_at: string | null
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

export interface CustomerSummary {
  id: number
  name: string
  email: string
  bios_id: string | null
  reseller: string | null
  program: string | null
  status: string | null
  expiry: string | null
  license_count: number
}

export interface CustomerDetails extends CustomerSummary {
  licenses: Array<{
    id: number
    bios_id: string
    program: string | null
    reseller: string | null
    status: string
    price: number
    activated_at: string | null
    expires_at: string | null
  }>
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
  }
}

export interface BiosHistoryEntry {
  id: string
  bios_id: string
  customer: string | null
  reseller: string | null
  reseller_id: number | null
  action: string
  status: string
  description: string
  occurred_at: string | null
}

export interface IpAnalyticsEntry {
  id: number
  user: { id: number; name: string; email: string } | null
  ip_address: string
  country: string | null
  city: string | null
  isp: string | null
  reputation_score: 'low' | 'medium' | 'high'
  action: string
  created_at: string | null
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
    total_activations: number
    active_licenses: number
  }
  revenue_by_reseller: Array<{ reseller: string; revenue: number; activations: number }>
  revenue_by_program: Array<{ program: string; revenue: number; activations: number }>
  monthly_revenue: Array<{ month: string; revenue: number }>
  reseller_balances: Array<{
    id: number
    reseller: string
    total_revenue: number
    total_activations: number
    avg_price: number
    commission: number
  }>
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}
