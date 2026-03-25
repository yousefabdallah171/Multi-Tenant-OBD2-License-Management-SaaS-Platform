export interface BiosOverview {
  bios_id: string
  original_bios_id: string
  username: string
  customer: { id: number; name: string; email: string | null; phone: string | null } | null
  reseller: { id: number; name: string; email: string | null; phone: string | null } | null
  status: string | null
  first_activation: string | null
  last_activity: string | null
  total_activations: number
  total_licenses: number
  avg_duration_days: number
  total_revenue: number
  avg_days_between_purchases: number
  latest_license: {
    id: number
    status: string | null
    price: number
    duration_days: number
    activated_at: string | null
    expires_at: string | null
    external_username: string | null
    program: { id: number; name: string } | null
    customer: { id: number; name: string; email: string | null; phone: string | null } | null
    reseller: { id: number; name: string; email: string | null; phone: string | null } | null
  } | null
  blacklist: BiosBlacklist | null
}

export interface BiosLicense {
  id: number
  program_id: number
  program?: { id: number; name: string } | null
  reseller?: { id: number; name: string; email: string | null; role?: string | null } | null
  duration_days: number
  price: number
  activated_at: string | null
  expires_at: string | null
  status: string
}

export interface BiosReseller {
  id: number | null
  name: string | null
  email: string | null
  activation_count: number
  total_revenue: number
  last_activity_at?: string | null
  programs_sold?: string[]
}

export interface BiosIp {
  ip_address: string | null
  timestamp: string | null
  country?: string | null
  city?: string | null
  isp?: string | null
  proxy?: boolean
  username?: string | null
  program_name?: string | null
}

export interface BiosActivity {
  id: number | string
  action: string
  description: string | null
  created_at: string | null
  reseller_name?: string | null
}

export interface BiosBlacklist {
  is_blacklisted: boolean
  reason: string | null
  blacklisted_by: number | null
  date: string | null
}
