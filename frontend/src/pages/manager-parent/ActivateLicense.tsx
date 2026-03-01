import { ActivateLicensePage } from '@/pages/shared/ActivateLicensePage'
import { routePaths } from '@/router/routes'

export function ActivateLicensePageForManagerParent() {
  return <ActivateLicensePage defaultBackPath={routePaths.managerParent.softwareManagement} />
}

