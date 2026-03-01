import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ExportButtons } from '@/components/shared/ExportButtons'

describe('ExportButtons', () => {
  test('renders csv and pdf buttons', () => {
    render(<ExportButtons onExportCsv={() => undefined} onExportPdf={() => undefined} />)
    expect(screen.getByRole('button', { name: 'CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument()
  })

  test('calls onExportCsv when csv button is clicked', async () => {
    const onCsv = jest.fn().mockResolvedValue(undefined)
    render(<ExportButtons onExportCsv={onCsv} onExportPdf={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    await waitFor(() => expect(onCsv).toHaveBeenCalledTimes(1))
  })

  test('calls onExportPdf when pdf button is clicked', async () => {
    const onPdf = jest.fn().mockResolvedValue(undefined)
    render(<ExportButtons onExportCsv={() => undefined} onExportPdf={onPdf} />)

    fireEvent.click(screen.getByRole('button', { name: 'PDF' }))
    await waitFor(() => expect(onPdf).toHaveBeenCalledTimes(1))
  })

  test('disables both buttons when isExporting is true', () => {
    render(<ExportButtons onExportCsv={() => undefined} onExportPdf={() => undefined} isExporting />)
    expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'PDF' })).toBeDisabled()
  })
})

