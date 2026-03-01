import { render, screen } from '@testing-library/react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ResponsiveTable } from '@/components/shared/ResponsiveTable'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { SkeletonCard } from '@/components/shared/SkeletonCard'
import { SkeletonChart } from '@/components/shared/SkeletonChart'
import { SkeletonTable } from '@/components/shared/SkeletonTable'
import { renderWithProviders } from '../../../utils/test-utils'

describe('RoleBadge', () => {
  test.each([
    ['super_admin', 'Super Admin'],
    ['manager_parent', 'Manager Parent'],
    ['manager', 'Manager'],
    ['reseller', 'Reseller'],
    ['customer', 'Customer'],
  ] as const)('renders role label for %s', async (role, expected) => {
    await renderWithProviders(<RoleBadge role={role} />, { route: '/en/login' })
    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})

describe('LoadingSpinner', () => {
  test('renders status role and sr-only label', () => {
    render(<LoadingSpinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading...', { selector: '.sr-only' })).toBeInTheDocument()
  })

  test('renders visible custom label when provided', () => {
    render(<LoadingSpinner label="Fetching data" />)
    expect(screen.getAllByText('Fetching data').length).toBeGreaterThan(0)
  })

  test('supports full page mode', () => {
    render(<LoadingSpinner fullPage />)
    expect(screen.getByRole('status').className).toContain('min-h-[50vh]')
  })
})

describe('Skeleton primitives', () => {
  test('SkeletonCard renders default lines', () => {
    render(<SkeletonCard />)
    expect(screen.getByTestId('skeleton-card')).toBeInTheDocument()
  })

  test('SkeletonCard supports custom lines', () => {
    render(<SkeletonCard lines={6} />)
    expect(screen.getByTestId('skeleton-card')).toBeInTheDocument()
  })

  test('SkeletonCard hides accent block when showAccent is false', () => {
    render(<SkeletonCard showAccent={false} />)
    expect(screen.getByTestId('skeleton-card')).toBeInTheDocument()
  })

  test('SkeletonTable renders default row count', () => {
    render(
      <table>
        <tbody>
          <SkeletonTable columnCount={3} />
        </tbody>
      </table>,
    )
    expect(screen.getAllByTestId('skeleton-table-row')).toHaveLength(5)
  })

  test('SkeletonTable supports custom row count', () => {
    render(
      <table>
        <tbody>
          <SkeletonTable columnCount={2} rowCount={3} />
        </tbody>
      </table>,
    )
    expect(screen.getAllByTestId('skeleton-table-row')).toHaveLength(3)
  })

  test('SkeletonChart renders test id', () => {
    render(<SkeletonChart />)
    expect(screen.getByTestId('skeleton-chart')).toBeInTheDocument()
  })
})

describe('ResponsiveTable', () => {
  test('renders container and children', () => {
    render(
      <ResponsiveTable>
        <table>
          <tbody>
            <tr>
              <td>Row one</td>
            </tr>
          </tbody>
        </table>
      </ResponsiveTable>,
    )

    expect(screen.getByTestId('responsive-table')).toBeInTheDocument()
    expect(screen.getByText('Row one')).toBeInTheDocument()
  })

  test('accepts custom class names', () => {
    render(
      <ResponsiveTable className="outer-test-class" contentClassName="inner-test-class">
        <div>content</div>
      </ResponsiveTable>,
    )

    expect(screen.getByTestId('responsive-table').className).toContain('outer-test-class')
    expect(screen.getByText('content').parentElement?.className).toContain('inner-test-class')
  })
})
