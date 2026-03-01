import { screen } from '@testing-library/react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { renderWithProviders } from '../../../utils/test-utils'

describe('StatusBadge', () => {
  test.each([
    ['active', 'Active'],
    ['suspended', 'Suspended'],
    ['inactive', 'Inactive'],
    ['expired', 'Expired'],
    ['pending', 'Pending'],
    ['removed', 'Removed'],
    ['online', 'Online'],
    ['offline', 'Offline'],
    ['degraded', 'Degraded'],
    ['unknown', 'Unknown'],
  ] as const)('renders %s label in english', async (status, label) => {
    await renderWithProviders(<StatusBadge status={status} />, { route: '/en/login' })
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  test('renders arabic text for active status', async () => {
    await renderWithProviders(<StatusBadge status="active" />, { route: '/ar/login' })
    expect(screen.getByText('نشط')).toBeInTheDocument()
  })
})

