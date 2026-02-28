import type { UserRole } from '@/types/user.types'
import { useAuth } from '@/hooks/useAuth'

export function useRoleGuard(allowedRoles: UserRole[]) {
  const { user } = useAuth()
  const role = user?.role ?? null

  return {
    role,
    isAllowed: role !== null && allowedRoles.includes(role),
  }
}
