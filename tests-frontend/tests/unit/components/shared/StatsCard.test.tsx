import { render, screen } from '@testing-library/react'
import { StatsCard } from '@/components/shared/StatsCard'

function DummyIcon() {
  return <svg data-testid="dummy-icon" />
}

describe('StatsCard', () => {
  test('renders title value and icon', () => {
    render(<StatsCard title="Revenue" value="$1200" icon={DummyIcon as never} />)
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('$1200')).toBeInTheDocument()
    expect(screen.getByTestId('dummy-icon')).toBeInTheDocument()
  })

  test.each([1, 12, 50])('shows positive trend badge for %d', (trend) => {
    render(<StatsCard title="Growth" value="10" icon={DummyIcon as never} trend={trend} />)
    expect(screen.getByText(`${trend}%`)).toBeInTheDocument()
  })

  test.each([-1, -8, -25])('shows negative trend badge for %d', (trend) => {
    render(<StatsCard title="Drop" value="10" icon={DummyIcon as never} trend={trend} />)
    expect(screen.getByText(`${Math.abs(trend)}%`)).toBeInTheDocument()
  })

  test('hides trend when trend prop is missing', () => {
    render(<StatsCard title="No Trend" value="10" icon={DummyIcon as never} />)
    expect(screen.queryByText('%')).not.toBeInTheDocument()
  })

  test.each(['sky', 'emerald', 'amber', 'rose'] as const)('accepts %s color variant', (color) => {
    render(<StatsCard title="Color" value="10" icon={DummyIcon as never} color={color} />)
    expect(screen.getByText('Color')).toBeInTheDocument()
  })
})
