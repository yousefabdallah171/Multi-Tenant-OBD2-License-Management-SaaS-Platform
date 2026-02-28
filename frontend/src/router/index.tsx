import { Navigate, Route, Routes } from 'react-router-dom'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPassword'
import { LoginPage } from '@/pages/auth/Login'
import { RoleDashboard } from '@/pages/dashboard/RoleDashboard'
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
            <Route path="super-admin" element={<RoleDashboard role="super_admin" />} />
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
