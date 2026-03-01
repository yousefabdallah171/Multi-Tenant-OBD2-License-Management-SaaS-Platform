import { ActivateLicensePage } from '@/pages/shared/ActivateLicensePage'
import { routePaths } from '@/router/routes'

export function ActivateLicensePageForManager() {
  return <ActivateLicensePage defaultBackPath={routePaths.manager.software} />
}

