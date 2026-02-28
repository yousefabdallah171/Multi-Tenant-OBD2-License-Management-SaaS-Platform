export interface HealthResponse {
  status: string
  app: string
  timestamp: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface ApiMessageResponse {
  message: string
}

export interface DashboardStats {
  users: number
  programs: number
  licenses: number
  active_licenses: number
  revenue: number
  team_members?: number
  total_customers?: number
  monthly_revenue?: number
}
