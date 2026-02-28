import { Navigate, Route, Routes } from 'react-router-dom'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPassword'
import { LoginPage } from '@/pages/auth/Login'
import { RoleDashboard } from '@/pages/dashboard/RoleDashboard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ActivityPage as ManagerParentActivityPage } from '@/pages/manager-parent/Activity'
import { BiosBlacklistPage as ManagerParentBiosBlacklistPage } from '@/pages/manager-parent/BiosBlacklist'
import { BiosHistoryPage as ManagerParentBiosHistoryPage } from '@/pages/manager-parent/BiosHistory'
import { CustomersPage as ManagerParentCustomersPage } from '@/pages/manager-parent/Customers'
import { DashboardPage as ManagerParentDashboardPage } from '@/pages/manager-parent/Dashboard'
import { FinancialReportsPage as ManagerParentFinancialReportsPage } from '@/pages/manager-parent/FinancialReports'
import { IpAnalyticsPage as ManagerParentIpAnalyticsPage } from '@/pages/manager-parent/IpAnalytics'
import { ProfilePage as ManagerParentProfilePage } from '@/pages/manager-parent/Profile'
import { ReportsPage as ManagerParentReportsPage } from '@/pages/manager-parent/Reports'
import { ResellerPricingPage } from '@/pages/manager-parent/ResellerPricing'
import { SettingsPage as ManagerParentSettingsPage } from '@/pages/manager-parent/Settings'
import { SoftwareManagementPage } from '@/pages/manager-parent/SoftwareManagement'
import { TeamManagementPage } from '@/pages/manager-parent/TeamManagement'
import { UsernameManagementPage as ManagerParentUsernameManagementPage } from '@/pages/manager-parent/UsernameManagement'
import { AdminManagementPage } from '@/pages/super-admin/AdminManagement'
import { ApiStatusPage } from '@/pages/super-admin/ApiStatus'
import { BiosBlacklistPage } from '@/pages/super-admin/BiosBlacklist'
import { BiosHistoryPage } from '@/pages/super-admin/BiosHistory'
import { DashboardPage } from '@/pages/super-admin/Dashboard'
import { FinancialReportsPage } from '@/pages/super-admin/FinancialReports'
import { LogsPage } from '@/pages/super-admin/Logs'
import { ProfilePage } from '@/pages/super-admin/Profile'
import { ReportsPage } from '@/pages/super-admin/Reports'
import { SettingsPage } from '@/pages/super-admin/Settings'
import { TenantsPage } from '@/pages/super-admin/Tenants'
import { UsernameManagementPage } from '@/pages/super-admin/UsernameManagement'
import { UsersPage } from '@/pages/super-admin/Users'
import { GuestRoute, ProtectedRoute, RoleGuard } from '@/router/guards'
import { LanguageLayout, LanguageNotFound } from '@/router/LanguageLayout'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/ar/login" replace />} />
      <Route path="/:lang" element={<LanguageLayout />}>
        <Route index element={<Navigate to="login" replace />} />
        <Route element={<GuestRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<RoleGuard allowedRoles={['super_admin']} />}>
            <Route path="super-admin" element={<DashboardLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="tenants" element={<TenantsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="admin-management" element={<AdminManagementPage />} />
              <Route path="bios-blacklist" element={<BiosBlacklistPage />} />
              <Route path="bios-history" element={<BiosHistoryPage />} />
              <Route path="username-management" element={<UsernameManagementPage />} />
              <Route path="financial-reports" element={<FinancialReportsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="logs" element={<LogsPage />} />
              <Route path="api-status" element={<ApiStatusPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>
          <Route element={<RoleGuard allowedRoles={['manager_parent']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="dashboard" element={<ManagerParentDashboardPage />} />
              <Route path="team-management" element={<TeamManagementPage />} />
              <Route path="reseller-pricing" element={<ResellerPricingPage />} />
              <Route path="software-management" element={<SoftwareManagementPage />} />
              <Route path="bios-blacklist" element={<ManagerParentBiosBlacklistPage />} />
              <Route path="bios-history" element={<ManagerParentBiosHistoryPage />} />
              <Route path="ip-analytics" element={<ManagerParentIpAnalyticsPage />} />
              <Route path="username-management" element={<ManagerParentUsernameManagementPage />} />
              <Route path="financial-reports" element={<ManagerParentFinancialReportsPage />} />
              <Route path="reports" element={<ManagerParentReportsPage />} />
              <Route path="activity" element={<ManagerParentActivityPage />} />
              <Route path="customers" element={<ManagerParentCustomersPage />} />
              <Route path="settings" element={<ManagerParentSettingsPage />} />
              <Route path="profile" element={<ManagerParentProfilePage />} />
            </Route>
          </Route>
          <Route element={<RoleGuard allowedRoles={['manager']} />}>
            <Route path="manager" element={<RoleDashboard role="manager" />} />
          </Route>
          <Route element={<RoleGuard allowedRoles={['reseller']} />}>
            <Route path="reseller" element={<RoleDashboard role="reseller" />} />
          </Route>
          <Route element={<RoleGuard allowedRoles={['customer']} />}>
            <Route path="customer" element={<RoleDashboard role="customer" />} />
          </Route>
        </Route>
        <Route path="*" element={<LanguageNotFound />} />
      </Route>
      <Route path="*" element={<Navigate to="/ar/login" replace />} />
    </Routes>
  )
}
