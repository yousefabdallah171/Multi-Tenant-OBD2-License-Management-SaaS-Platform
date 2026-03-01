import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LockoutBanner } from '@/components/auth/LockoutBanner'
import { setLanguage } from '../../utils/test-utils'

function renderBanner(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('LockoutBanner', () => {
  test('does not render when account lock has null secondsRemaining', async () => {
    await setLanguage('en')
    const { container } = renderBanner(<LockoutBanner reason="account_locked" secondsRemaining={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('renders countdown and formats 60 seconds as 1:00', async () => {
    await setLanguage('en')
    renderBanner(<LockoutBanner reason="account_locked" secondsRemaining={60} />)
    expect(screen.getByText(/1:00/)).toBeInTheDocument()
  })

  test('countdown decrements every second and calls onExpired at 0', async () => {
    await setLanguage('en')
    jest.useFakeTimers()
    const onExpired = jest.fn()
    const { container } = renderBanner(<LockoutBanner reason="account_locked" secondsRemaining={2} onExpired={onExpired} />)

    expect(screen.getByText(/0:02/)).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(screen.getByText(/0:01/)).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(onExpired).toHaveBeenCalledTimes(1)
    expect(container).not.toBeEmptyDOMElement()
    jest.useRealTimers()
  })

  test('ip blocked banner shows support mailto link and no countdown', async () => {
    await setLanguage('en')
    renderBanner(<LockoutBanner reason="ip_blocked" unlocksAt={null} />)

    const supportLink = screen.getByRole('link')
    expect(supportLink).toHaveAttribute('href', 'mailto:support@obd2sw.com')
    expect(screen.queryByText(/\d+:\d{2}/)).not.toBeInTheDocument()
  })

  test('renders right-aligned text in rtl', async () => {
    await setLanguage('ar')
    const { container } = renderBanner(<LockoutBanner reason="account_locked" secondsRemaining={60} />)

    expect(container.firstChild).toHaveClass('text-right')
  })
})
