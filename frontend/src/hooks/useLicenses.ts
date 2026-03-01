import { useMutation, useQuery } from '@tanstack/react-query'
import { licenseService } from '@/services/license.service'
import type { ActivateLicenseData, LicenseFilters } from '@/types/manager-reseller.types'

export function useLicenses(filters: LicenseFilters = {}) {
  const licensesQuery = useQuery({
    queryKey: ['licenses', filters],
    queryFn: () => licenseService.getAll(filters),
  })

  const activateMutation = useMutation({
    mutationFn: (payload: ActivateLicenseData) => licenseService.activate(payload),
  })

  return {
    licensesQuery,
    activateMutation,
  }
}
