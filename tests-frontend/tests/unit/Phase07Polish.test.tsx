import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RouteErrorBoundary } from '@/components/shared/ErrorBoundary'
import { AppRouter } from '@/router'
import { useAuthStore } from '@/stores/authStore'
import { createTestQueryClient, fakeSuperAdmin, setLanguage } from './testUtils'

let shouldThrow = true

function ThrowingPage() {
  if (shouldThrow) {
    throw new Error('Phase 07 boundary test')
  }

  return <div>Recovered page</div>
}

beforeEach(() => {
  shouldThrow = true
})

test('unknown localized routes render the not found page', async () => {
  await setLanguage('en')
  useAuthStore.getState().clearSession()

  const queryClient = createTestQueryClient()

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/en/does-not-exist']}>
        <AppRouter />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  expect(await screen.findByText(/Page not found/i)).toBeInTheDocument()
})

test('route error boundary shows fallback UI and retries the page', async () => {
  await setLanguage('en')
  useAuthStore.getState().setSession('test-token', fakeSuperAdmin())
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  const user = userEvent.setup()

  render(
    <MemoryRouter initialEntries={['/en/super-admin/dashboard']}>
      <RouteErrorBoundary dashboardHref="/en/super-admin/dashboard">
        <ThrowingPage />
      </RouteErrorBoundary>
    </MemoryRouter>,
  )

  expect(await screen.findByText(/Something went wrong/i)).toBeInTheDocument()

  shouldThrow = false
  await user.click(screen.getByRole('button', { name: /Try Again/i }))

  expect(await screen.findByText(/Recovered page/i)).toBeInTheDocument()

  errorSpy.mockRestore()
})
