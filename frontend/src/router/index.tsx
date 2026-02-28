import { Navigate, Route, Routes } from 'react-router-dom'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPassword'
import { LoginPage } from '@/pages/auth/Login'
import { RoleDashboard } from '@/pages/dashboard/RoleDashboard'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
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
            <Route path="dashboard" element={<RoleDashboard role="manager_parent" />} />
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
