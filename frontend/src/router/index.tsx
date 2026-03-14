import { type ComponentType, Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AccessDeniedPage } from '@/pages/errors/AccessDenied'
import { AccountDisabledPage } from '@/pages/errors/AccountDisabled'
import { NotFoundPage } from '@/pages/errors/NotFound'
import { ServerErrorPage } from '@/pages/errors/ServerError'
import { DEFAULT_LANGUAGE } from '@/lib/constants'
import { GuestRoute, ProtectedRoute, RoleGuard } from '@/router/guards'
import { LanguageLayout } from '@/router/LanguageLayout'

function lazyNamed<TModule extends Record<string, unknown>>(
  loader: () => Promise<TModule>,
  exportName: keyof TModule,
) {
  return lazy(async () => {
    const module = await loader()
    return { default: module[exportName] as ComponentType }
  })
}

const LoginPage = lazyNamed(() => import('@/pages/auth/Login'), 'LoginPage')
const DashboardLayout = lazyNamed(() => import('@/components/layout/DashboardLayout'), 'DashboardLayout')
const ProtectedProviders = lazyNamed(() => import('@/router/ProtectedProviders'), 'ProtectedProviders')
const CustomerDashboardPage = lazyNamed(() => import('@/pages/customer/Dashboard'), 'DashboardPage')
const CustomerDownloadPage = lazyNamed(() => import('@/pages/customer/Download'), 'DownloadPage')
const CustomerSoftwarePage = lazyNamed(() => import('@/pages/customer/Software'), 'SoftwarePage')

const ManagerActivityPage = lazyNamed(() => import('@/pages/manager/Activity'), 'ActivityPage')
const ActivateLicensePageForManager = lazyNamed(() => import('@/pages/manager/ActivateLicense'), 'ActivateLicensePageForManager')
const ManagerBiosDetailsPage = lazyNamed(() => import('@/pages/manager/BiosDetails'), 'BiosDetailsPage')
const ManagerBiosChangeRequestsPage = lazyNamed(() => import('@/pages/manager/BiosChangeRequests'), 'BiosChangeRequestsPage')
const ManagerCustomersPage = lazyNamed(() => import('@/pages/manager/Customers'), 'CustomersPage')
const ManagerCreateCustomerPage = lazyNamed(() => import('@/pages/manager/CreateCustomer'), 'CreateCustomerPageForManager')
const ManagerCustomerDetailPage = lazyNamed(() => import('@/pages/manager/CustomerDetail'), 'CustomerDetailPage')
const ManagerResellerPaymentDetailPage = lazyNamed(() => import('@/pages/manager/ResellerPaymentDetail'), 'ResellerPaymentDetailPage')
const ManagerResellerPaymentsPage = lazyNamed(() => import('@/pages/manager/ResellerPayments'), 'ResellerPaymentsPage')
const ManagerRenewLicensePage = lazyNamed(() => import('@/pages/manager/RenewLicense'), 'RenewLicensePageForManager')
const ManagerDashboardPage = lazyNamed(() => import('@/pages/manager/Dashboard'), 'DashboardPage')
const ManagerProfilePage = lazyNamed(() => import('@/pages/manager/Profile'), 'ProfilePage')
const ManagerReportsPage = lazyNamed(() => import('@/pages/manager/Reports'), 'ReportsPage')
const ManagerResellerLogsPage = lazyNamed(() => import('@/pages/manager/ResellerLogs'), 'ResellerLogsPage')
const ManagerSoftwarePage = lazyNamed(() => import('@/pages/manager/Software'), 'SoftwarePage')
const ManagerSoftwareManagementPage = lazyNamed(() => import('@/pages/manager/SoftwareManagement'), 'SoftwareManagementPage')
const ManagerProgramFormPage = lazyNamed(() => import('@/pages/manager/ProgramForm'), 'ProgramFormPage')
const ManagerTeamPage = lazyNamed(() => import('@/pages/manager/Team'), 'TeamPage')
const ManagerTeamMemberDetailPage = lazyNamed(() => import('@/pages/manager/TeamMemberDetail'), 'TeamMemberDetailPage')

const ManagerParentActivityPage = lazyNamed(() => import('@/pages/manager-parent/Activity'), 'ActivityPage')
const ActivateLicensePageForManagerParent = lazyNamed(() => import('@/pages/manager-parent/ActivateLicense'), 'ActivateLicensePageForManagerParent')
const ManagerParentApiStatusPage = lazyNamed(() => import('@/pages/manager-parent/ApiStatus'), 'ApiStatusPage')
const ManagerParentBiosBlacklistPage = lazyNamed(() => import('@/pages/manager-parent/BiosBlacklist'), 'BiosBlacklistPage')
const ManagerParentBiosChangeRequestsPage = lazyNamed(() => import('@/pages/manager-parent/BiosChangeRequests'), 'BiosChangeRequestsPage')
const ManagerParentBiosConflictsPage = lazyNamed(() => import('@/pages/manager-parent/BiosConflicts'), 'BiosConflictsPage')
const ManagerParentBiosDetailsPage = lazyNamed(() => import('@/pages/manager-parent/BiosDetails'), 'BiosDetailsPage')
const ManagerParentCustomersPage = lazyNamed(() => import('@/pages/manager-parent/Customers'), 'CustomersPage')
const ManagerParentCreateCustomerPage = lazyNamed(() => import('@/pages/manager-parent/CreateCustomer'), 'CreateCustomerPageForManagerParent')
const ManagerParentCustomerDetailPage = lazyNamed(() => import('@/pages/manager-parent/CustomerDetail'), 'CustomerDetailPage')
const ManagerParentResellerPaymentDetailPage = lazyNamed(() => import('@/pages/manager-parent/ResellerPaymentDetail'), 'ResellerPaymentDetailPage')
const ManagerParentResellerPaymentsPage = lazyNamed(() => import('@/pages/manager-parent/ResellerPayments'), 'ResellerPaymentsPage')
const ManagerParentRenewLicensePage = lazyNamed(() => import('@/pages/manager-parent/RenewLicense'), 'RenewLicensePageForManagerParent')
const ManagerParentDashboardPage = lazyNamed(() => import('@/pages/manager-parent/Dashboard'), 'DashboardPage')
const ManagerParentFinancialReportsPage = lazyNamed(() => import('@/pages/manager-parent/FinancialReports'), 'FinancialReportsPage')
const ManagerParentIpAnalyticsPage = lazyNamed(() => import('@/pages/manager-parent/IpAnalytics'), 'IpAnalyticsPage')
const ManagerParentProfilePage = lazyNamed(() => import('@/pages/manager-parent/Profile'), 'ProfilePage')
const ManagerParentProgramLogsPage = lazyNamed(() => import('@/pages/manager-parent/ProgramLogs'), 'ProgramLogsPage')
const ManagerParentResellerLogsPage = lazyNamed(() => import('@/pages/manager-parent/ResellerLogs'), 'ResellerLogsPage')
const ManagerParentSettingsPage = lazyNamed(() => import('@/pages/manager-parent/Settings'), 'SettingsPage')
const ManagerParentSoftwarePage = lazyNamed(() => import('@/pages/manager-parent/Software'), 'SoftwarePage')
const SoftwareManagementPage = lazyNamed(() => import('@/pages/manager-parent/SoftwareManagement'), 'SoftwareManagementPage')
const ManagerParentProgramFormPage = lazyNamed(() => import('@/pages/manager-parent/ProgramForm'), 'ProgramFormPage')
const TeamManagementPage = lazyNamed(() => import('@/pages/manager-parent/TeamManagement'), 'TeamManagementPage')
const TeamMemberDetailPage = lazyNamed(() => import('@/pages/manager-parent/TeamMemberDetail'), 'TeamMemberDetailPage')

const ApiStatusPage = lazyNamed(() => import('@/pages/super-admin/ApiStatus'), 'ApiStatusPage')
const BiosBlacklistPage = lazyNamed(() => import('@/pages/super-admin/BiosBlacklist'), 'BiosBlacklistPage')
const SuperAdminBiosConflictsPage = lazyNamed(() => import('@/pages/super-admin/BiosConflicts'), 'BiosConflictsPage')
const SuperAdminBiosDetailsPage = lazyNamed(() => import('@/pages/super-admin/BiosDetails'), 'BiosDetailsPage')
const SuperAdminCustomersPage = lazyNamed(() => import('@/pages/super-admin/Customers'), 'CustomersPage')
const SuperAdminCreateCustomerPage = lazyNamed(() => import('@/pages/super-admin/CreateCustomer'), 'CreateCustomerPage')
const SuperAdminCustomerDetailPage = lazyNamed(() => import('@/pages/super-admin/CustomerDetail'), 'CustomerDetailPage')
const SuperAdminRenewLicensePage = lazyNamed(() => import('@/pages/super-admin/RenewLicense'), 'RenewLicensePageForSuperAdmin')
const DashboardPage = lazyNamed(() => import('@/pages/super-admin/Dashboard'), 'DashboardPage')
const LogsPage = lazyNamed(() => import('@/pages/super-admin/Logs'), 'LogsPage')
const ReportsPage = lazyNamed(() => import('@/pages/super-admin/Reports'), 'ReportsPage')
const SettingsPage = lazyNamed(() => import('@/pages/super-admin/Settings'), 'SettingsPage')
const TenantsPage = lazyNamed(() => import('@/pages/super-admin/Tenants'), 'TenantsPage')
const UsersPage = lazyNamed(() => import('@/pages/super-admin/Users'), 'UsersPage')
const UserDetailPage = lazyNamed(() => import('@/pages/super-admin/UserDetail'), 'UserDetailPage')
const AdminManagementPage = lazyNamed(() => import('@/pages/super-admin/AdminManagement'), 'AdminManagementPage')
const SuperAdminProfilePage = lazyNamed(() => import('@/pages/super-admin/Profile'), 'ProfilePage')
const SecurityLocksPage = lazyNamed(() => import('@/pages/super-admin/SecurityLocks'), 'SecurityLocksPage')

const ResellerCustomersPage = lazyNamed(() => import('@/pages/reseller/Customers'), 'CustomersPage')
const ResellerCreateCustomerPage = lazyNamed(() => import('@/pages/reseller/CreateCustomer'), 'CreateCustomerPageForReseller')
const ResellerCustomerDetailPage = lazyNamed(() => import('@/pages/reseller/CustomerDetail'), 'CustomerDetailPage')
const ResellerRenewLicensePage = lazyNamed(() => import('@/pages/reseller/RenewLicense'), 'RenewLicensePageForReseller')
const ResellerDashboardPage = lazyNamed(() => import('@/pages/reseller/Dashboard'), 'DashboardPage')
const ActivateLicensePageForReseller = lazyNamed(() => import('@/pages/reseller/ActivateLicense'), 'ActivateLicensePageForReseller')
const ResellerActivationsPage = lazyNamed(() => import('@/pages/reseller/Activations'), 'ActivationsPage')
const ResellerPaymentStatusPage = lazyNamed(() => import('@/pages/reseller/PaymentStatus'), 'PaymentStatusPage')
const ResellerProfilePage = lazyNamed(() => import('@/pages/reseller/Profile'), 'ProfilePage')
const ResellerReportsPage = lazyNamed(() => import('@/pages/reseller/Reports'), 'ReportsPage')
const ResellerSoftwarePage = lazyNamed(() => import('@/pages/reseller/Software'), 'SoftwarePage')

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
      Loading...
    </div>
  )
}

export function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to={`/${DEFAULT_LANGUAGE}/login`} replace />} />
        <Route path="/:lang" element={<LanguageLayout />}>
          <Route index element={<Navigate to="login" replace />} />
          <Route path="not-found" element={<NotFoundPage />} />
          <Route path="access-denied" element={<AccessDeniedPage />} />
          <Route path="account-disabled" element={<AccountDisabledPage />} />
          <Route path="server-error" element={<ServerErrorPage />} />
          <Route element={<GuestRoute />}>
            <Route path="login" element={<LoginPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<ProtectedProviders />}>
              <Route element={<RoleGuard allowedRoles={['super_admin']} />}>
                <Route path="super-admin" element={<DashboardLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="tenants" element={<TenantsPage />} />
                  <Route path="customers" element={<SuperAdminCustomersPage />} />
                  <Route path="customers/create" element={<SuperAdminCreateCustomerPage />} />
                  <Route path="customers/licenses/:id/renew" element={<SuperAdminRenewLicensePage />} />
                  <Route path="customers/:id" element={<SuperAdminCustomerDetailPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="users/:id" element={<UserDetailPage />} />
                  <Route path="admin-management" element={<AdminManagementPage />} />
                  <Route path="bios-blacklist" element={<BiosBlacklistPage />} />
                  <Route path="bios-history" element={<Navigate to="../bios-conflicts" replace />} />
                  <Route path="bios-details" element={<SuperAdminBiosDetailsPage />} />
                  <Route path="bios-details/:biosId" element={<SuperAdminBiosDetailsPage />} />
                  <Route path="bios-conflicts" element={<SuperAdminBiosConflictsPage />} />
                  <Route path="username-management" element={<Navigate to="../admin-management" replace />} />
                  <Route path="security-locks" element={<SecurityLocksPage />} />
                  <Route path="financial-reports" element={<Navigate to="../reports" replace />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="logs" element={<LogsPage />} />
                  <Route path="api-status" element={<ApiStatusPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="profile" element={<SuperAdminProfilePage />} />
                  <Route path="*" element={<Navigate to="dashboard" replace />} />
                </Route>
              </Route>
              <Route element={<RoleGuard allowedRoles={['manager_parent']} />}>
                <Route element={<DashboardLayout />}>
                  <Route path="dashboard" element={<ManagerParentDashboardPage />} />
                  <Route path="team-management" element={<TeamManagementPage />} />
                  <Route path="team-management/:id" element={<TeamMemberDetailPage />} />
                  <Route path="software" element={<ManagerParentSoftwarePage />} />
                  <Route path="software-management" element={<SoftwareManagementPage />} />
                  <Route path="software-management/create" element={<ManagerParentProgramFormPage />} />
                  <Route path="software-management/:id/edit" element={<ManagerParentProgramFormPage />} />
                  <Route path="software-management/:id/activate" element={<ActivateLicensePageForManagerParent />} />
                  <Route path="bios-blacklist" element={<ManagerParentBiosBlacklistPage />} />
                  <Route path="bios-history" element={<Navigate to="../bios-conflicts" replace />} />
                  <Route path="bios-details" element={<ManagerParentBiosDetailsPage />} />
                  <Route path="bios-details/:biosId" element={<ManagerParentBiosDetailsPage />} />
                  <Route path="bios-change-requests" element={<ManagerParentBiosChangeRequestsPage />} />
                  <Route path="reseller-payments" element={<ManagerParentResellerPaymentsPage />} />
                  <Route path="reseller-payments/:resellerId" element={<ManagerParentResellerPaymentDetailPage />} />
                  <Route path="bios-conflicts" element={<ManagerParentBiosConflictsPage />} />
                  <Route path="ip-analytics" element={<ManagerParentIpAnalyticsPage />} />
                  <Route path="logs" element={<Navigate to="../activity" replace />} />
                  <Route path="program-logs" element={<ManagerParentProgramLogsPage />} />
                  <Route path="reseller-logs" element={<ManagerParentResellerLogsPage />} />
                  <Route path="api-status" element={<ManagerParentApiStatusPage />} />
                  <Route path="username-management" element={<Navigate to="../team-management" replace />} />
                  <Route path="financial-reports" element={<Navigate to="../reports" replace />} />
                  <Route path="reports" element={<ManagerParentFinancialReportsPage />} />
                  <Route path="activity" element={<ManagerParentActivityPage />} />
                  <Route path="customers" element={<ManagerParentCustomersPage />} />
                  <Route path="customers/create" element={<ManagerParentCreateCustomerPage />} />
                  <Route path="customers/licenses/:id/renew" element={<ManagerParentRenewLicensePage />} />
                  <Route path="licenses" element={<Navigate to="../customers" replace />} />
                  <Route path="customers/:id" element={<ManagerParentCustomerDetailPage />} />
                  <Route path="settings" element={<ManagerParentSettingsPage />} />
                  <Route path="profile" element={<ManagerParentProfilePage />} />
                </Route>
              </Route>
              <Route element={<RoleGuard allowedRoles={['manager']} />}>
                <Route path="manager" element={<DashboardLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<ManagerDashboardPage />} />
                  <Route path="team" element={<ManagerTeamPage />} />
                  <Route path="team/:id" element={<ManagerTeamMemberDetailPage />} />
                  <Route path="username-management" element={<Navigate to="../team" replace />} />
                  <Route path="customers" element={<ManagerCustomersPage />} />
                  <Route path="customers/create" element={<ManagerCreateCustomerPage />} />
                  <Route path="customers/licenses/:id/renew" element={<ManagerRenewLicensePage />} />
                  <Route path="customers/:id" element={<ManagerCustomerDetailPage />} />
                  <Route path="licenses" element={<Navigate to="../customers" replace />} />
                  <Route path="software" element={<ManagerSoftwarePage />} />
                  <Route path="software/:id/activate" element={<ActivateLicensePageForManager />} />
                  <Route path="software-management" element={<ManagerSoftwareManagementPage />} />
                  <Route path="software-management/create" element={<ManagerProgramFormPage />} />
                  <Route path="software-management/:id/edit" element={<ManagerProgramFormPage />} />
                  <Route path="bios-details" element={<ManagerBiosDetailsPage />} />
                  <Route path="bios-details/:biosId" element={<ManagerBiosDetailsPage />} />
                  <Route path="bios-change-requests" element={<ManagerBiosChangeRequestsPage />} />
                  <Route path="reseller-payments" element={<ManagerResellerPaymentsPage />} />
                  <Route path="reseller-payments/:resellerId" element={<ManagerResellerPaymentDetailPage />} />
                  <Route path="reports" element={<ManagerReportsPage />} />
                  <Route path="activity" element={<ManagerActivityPage />} />
                  <Route path="reseller-logs" element={<ManagerResellerLogsPage />} />
                  <Route path="profile" element={<ManagerProfilePage />} />
                </Route>
              </Route>
              <Route element={<RoleGuard allowedRoles={['reseller']} />}>
                <Route path="reseller" element={<DashboardLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<ResellerDashboardPage />} />
                  <Route path="customers" element={<ResellerCustomersPage />} />
                  <Route path="customers/create" element={<ResellerCreateCustomerPage />} />
                  <Route path="customers/licenses/:id/renew" element={<ResellerRenewLicensePage />} />
                  <Route path="customers/:id" element={<ResellerCustomerDetailPage />} />
                  <Route path="licenses" element={<Navigate to="../customers" replace />} />
                  <Route path="activations" element={<ResellerActivationsPage />} />
                  <Route path="software" element={<ResellerSoftwarePage />} />
                  <Route path="software/:id/activate" element={<ActivateLicensePageForReseller />} />
                  <Route path="payment-status" element={<ResellerPaymentStatusPage />} />
                  <Route path="reports" element={<ResellerReportsPage />} />
                  <Route path="profile" element={<ResellerProfilePage />} />
                  <Route path="*" element={<Navigate to="dashboard" replace />} />
                </Route>
              </Route>
              <Route element={<RoleGuard allowedRoles={['customer']} />}>
                <Route path="customer" element={<DashboardLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<CustomerDashboardPage />} />
                  <Route path="software" element={<CustomerSoftwarePage />} />
                  <Route path="download" element={<CustomerDownloadPage />} />
                  <Route path="*" element={<Navigate to="dashboard" replace />} />
                </Route>
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="*" element={<Navigate to={`/${DEFAULT_LANGUAGE}/not-found`} replace />} />
      </Routes>
    </Suspense>
  )
}


