import { ActivateLicensePage } from '@/pages/shared/ActivateLicensePage'
import { routePaths } from '@/router/routes'

export function ActivateLicensePageForReseller() {
  return <ActivateLicensePage defaultBackPath={routePaths.reseller.software} />
}

