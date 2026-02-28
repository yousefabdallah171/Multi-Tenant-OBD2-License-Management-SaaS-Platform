import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types/user.types'

const permissionsByRole: Record<UserRole, string[]> = {
  super_admin: ['*'],
  manager_parent: ['dashboard:view', 'users:view', 'licenses:view', 'balances:manage'],
  manager: ['dashboard:view', 'users:view', 'licenses:view'],
  reseller: ['dashboard:view', 'licenses:view', 'customers:view'],
  customer: ['dashboard:view', 'licenses:view:own'],
}

export function useHasPermission(permission: string) {
  const { user } = useAuth()
  const role = user?.role

  if (!role) {
    return false
  }

  const permissions = permissionsByRole[role]
  return permissions.includes('*') || permissions.includes(permission)
}
