import { Navigate, Route, Routes } from 'react-router-dom'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPassword'
import { LoginPage } from '@/pages/auth/Login'
import { AccessDeniedPage } from '@/pages/errors/AccessDenied'
import { NotFoundPage } from '@/pages/errors/NotFound'
import { ServerErrorPage } from '@/pages/errors/ServerError'
import { CustomerLayout } from '@/components/layout/CustomerLayout'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DashboardPage as CustomerDashboardPage } from '@/pages/customer/Dashboard'
import { DownloadPage as CustomerDownloadPage } from '@/pages/customer/Download'
import { SoftwarePage as CustomerSoftwarePage } from '@/pages/customer/Software'
import { ActivityPage as ManagerActivityPage } from '@/pages/manager/Activity'
import { CustomersPage as ManagerCustomersPage } from '@/pages/manager/Customers'
import { DashboardPage as ManagerDashboardPage } from '@/pages/manager/Dashboard'
import { ProfilePage as ManagerProfilePage } from '@/pages/manager/Profile'
import { ReportsPage as ManagerReportsPage } from '@/pages/manager/Reports'
import { SoftwarePage as ManagerSoftwarePage } from '@/pages/manager/Software'
import { TeamPage as ManagerTeamPage } from '@/pages/manager/Team'
import { UsernameManagementPage as ManagerUsernameManagementPage } from '@/pages/manager/UsernameManagement'
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
import { ActivityPage as ResellerActivityPage } from '@/pages/reseller/Activity'
import { CustomersPage as ResellerCustomersPage } from '@/pages/reseller/Customers'
import { DashboardPage as ResellerDashboardPage } from '@/pages/reseller/Dashboard'
import { LicensesPage as ResellerLicensesPage } from '@/pages/reseller/Licenses'
import { ProfilePage as ResellerProfilePage } from '@/pages/reseller/Profile'
import { ReportsPage as ResellerReportsPage } from '@/pages/reseller/Reports'
import { SoftwarePage as ResellerSoftwarePage } from '@/pages/reseller/Software'
import { GuestRoute, ProtectedRoute, RoleGuard } from '@/router/guards'
import { LanguageLayout } from '@/router/LanguageLayout'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/ar/login" replace />} />
      <Route path="/:lang" element={<LanguageLayout />}>
        <Route index element={<Navigate to="login" replace />} />
        <Route path="not-found" element={<NotFoundPage />} />
        <Route path="access-denied" element={<AccessDeniedPage />} />
        <Route path="server-error" element={<ServerErrorPage />} />
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
            <Route path="manager" element={<DashboardLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ManagerDashboardPage />} />
              <Route path="team" element={<ManagerTeamPage />} />
              <Route path="username-management" element={<ManagerUsernameManagementPage />} />
              <Route path="customers" element={<ManagerCustomersPage />} />
              <Route path="software" element={<ManagerSoftwarePage />} />
              <Route path="reports" element={<ManagerReportsPage />} />
              <Route path="activity" element={<ManagerActivityPage />} />
              <Route path="profile" element={<ManagerProfilePage />} />
            </Route>
          </Route>
          <Route element={<RoleGuard allowedRoles={['reseller']} />}>
            <Route path="reseller" element={<DashboardLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ResellerDashboardPage />} />
              <Route path="customers" element={<ResellerCustomersPage />} />
              <Route path="software" element={<ResellerSoftwarePage />} />
              <Route path="licenses" element={<ResellerLicensesPage />} />
              <Route path="reports" element={<ResellerReportsPage />} />
              <Route path="activity" element={<ResellerActivityPage />} />
              <Route path="profile" element={<ResellerProfilePage />} />
            </Route>
          </Route>
          <Route element={<RoleGuard allowedRoles={['customer']} />}>
            <Route path="customer" element={<CustomerLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<CustomerDashboardPage />} />
              <Route path="software" element={<CustomerSoftwarePage />} />
              <Route path="download" element={<CustomerDownloadPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/ar/not-found" replace />} />
    </Routes>
  )
}
