import type { ProgramSummary } from '@/types/manager-parent.types'

export const mockPrograms: ProgramSummary[] = [
  {
    id: 8,
    name: 'Tool A',
    description: 'Program A',
    version: '1.0',
    download_link: 'https://example.com/tool-a.exe',
    trial_days: 7,
    base_price: 50,
    icon: null,
    status: 'active',
    licenses_sold: 10,
    active_licenses_count: 9,
    revenue: 500,
    has_external_api: true,
    external_software_id: 8,
    created_at: '2026-03-01T00:00:00Z',
  },
]
