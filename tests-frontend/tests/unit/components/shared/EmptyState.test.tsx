import { fireEvent, render, screen } from '@testing-library/react'
import { EmptyState } from '@/components/shared/EmptyState'

describe('EmptyState', () => {
  test('renders icon and message text', () => {
    render(<EmptyState title="No records" description="Try a different filter" />)
    expect(screen.getByText('No records')).toBeInTheDocument()
    expect(screen.getByText('Try a different filter')).toBeInTheDocument()
    expect(document.querySelector('svg')).not.toBeNull()
  })

  test('shows action button when action props are provided', () => {
    render(<EmptyState title="No data" actionLabel="Retry" onAction={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  test('calls action callback when action button is clicked', () => {
    const onAction = jest.fn()
    render(<EmptyState title="No data" actionLabel="Retry" onAction={onAction} />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})

