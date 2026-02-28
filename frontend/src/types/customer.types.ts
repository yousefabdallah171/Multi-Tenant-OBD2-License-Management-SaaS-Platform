export type CustomerLicenseStatus = 'active' | 'expired' | 'suspended' | 'pending'

export interface CustomerDashboardLicense {
  id: number
  program_id: number
  program_name: string | null
  program_description: string | null
  program_version: string | null
  program_icon: string | null
  bios_id: string
  status: CustomerLicenseStatus
  activated_at: string | null
  expires_at: string | null
  days_remaining: number
  percentage_remaining: number
  download_link: string | null
  reseller_name: string | null
  reseller_email?: string | null
  can_download: boolean
}

export interface CustomerDashboardData {
  summary: {
    total_licenses: number
    active_licenses: number
    expired_licenses: number
  }
  licenses: CustomerDashboardLicense[]
}

export interface CustomerSoftwareItem {
  id: number
  license_id: number
  program_id: number
  name: string | null
  description: string | null
  version: string | null
  icon: string | null
  status: CustomerLicenseStatus
  download_link: string | null
  file_size?: string | null
  system_requirements?: string | null
  installation_guide_url?: string | null
  expires_at: string | null
  days_remaining: number
  can_download: boolean
}

export interface CustomerDownloadItem {
  id: number
  license_id: number
  program_id: number
  program_name: string | null
  version: string | null
  download_link: string | null
  file_size: string | null
  last_downloaded_at: string | null
  system_requirements: string | null
  installation_guide_url: string | null
  status: CustomerLicenseStatus
  days_remaining: number
  can_download: boolean
}
