export interface BiosOverview {
  bios_id: string
  original_bios_id: string
  username: string
  customer: { id: number; name: string; email: string | null } | null
  reseller: { id: number; name: string; email: string | null } | null
  status: string | null
  first_activation: string | null
  last_activity: string | null
  total_activations: number
  total_licenses: number
  avg_days_between_purchases: number
  blacklist: BiosBlacklist | null
}

export interface BiosLicense {
  id: number
  program_id: number
  program?: { id: number; name: string } | null
  reseller?: { id: number; name: string; email: string | null } | null
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
}

export interface BiosIp {
  ip_address: string | null
  action?: string
  created_at: string | null
}

export interface BiosActivity {
  id: number | string
  action: string
  description: string | null
  created_at: string | null
}

export interface BiosBlacklist {
  is_blacklisted: boolean
  reason: string | null
  blacklisted_by: number | null
  date: string | null
}

