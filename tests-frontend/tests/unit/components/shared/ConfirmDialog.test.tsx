import { fireEvent, render, screen } from '@testing-library/react'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

describe('ConfirmDialog', () => {
  test('renders when open is true', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Confirm action"
        description="Are you sure?"
        confirmLabel="Confirm"
        onConfirm={() => undefined}
      />,
    )

    expect(screen.getByText('Confirm action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  test('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = jest.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Confirm action"
        confirmLabel="Confirm"
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  test('cancel button closes without calling onConfirm', () => {
    const onConfirm = jest.fn()
    const onOpenChange = jest.fn()

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Confirm action"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  test('supports custom cancel label', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Confirm action"
        confirmLabel="Confirm"
        cancelLabel="Close"
        onConfirm={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
