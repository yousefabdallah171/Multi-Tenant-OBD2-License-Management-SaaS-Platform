import { render, screen, waitFor } from '@testing-library/react'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('boom')
  }

  return <div>safe child</div>
}

const copy = {
  title: 'Something went wrong',
  description: 'Please retry.',
  tryAgain: 'Try Again',
  goToDashboard: 'Go to dashboard',
  technicalDetails: 'Technical details',
}

describe('ErrorBoundary', () => {
  test('renders children when no error happens', () => {
    render(
      <ErrorBoundary copy={copy} dashboardHref="/en/dashboard">
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('safe child')).toBeInTheDocument()
  })

  test('shows fallback UI when child throws', () => {
    render(
      <ErrorBoundary copy={copy} dashboardHref="/en/dashboard">
        <Boom shouldThrow />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(copy.title)).toBeInTheDocument()
  })

  test('resetKey change clears error boundary state', async () => {
    const { rerender } = render(
      <ErrorBoundary copy={copy} dashboardHref="/en/dashboard" resetKey="a">
        <Boom shouldThrow />
      </ErrorBoundary>,
    )

    rerender(
      <ErrorBoundary copy={copy} dashboardHref="/en/dashboard" resetKey="b">
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    )

    await waitFor(() => {
      expect(screen.getByText('safe child')).toBeInTheDocument()
    })
  })

  test('logs errors via console.error', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary copy={copy} dashboardHref="/en/dashboard">
        <Boom shouldThrow />
      </ErrorBoundary>,
    )
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
