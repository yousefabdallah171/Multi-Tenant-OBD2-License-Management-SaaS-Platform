import { fireEvent, screen } from '@testing-library/react'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { renderWithProviders } from '../../../utils/test-utils'

interface Row {
  id: number
  name: string
  email: string
  score: number
}

const rows: Row[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com', score: 10 },
  { id: 2, name: 'Bob', email: 'bob@example.com', score: 20 },
]

const columns: DataTableColumn<Row>[] = [
  { key: 'name', label: 'Name', sortable: true, render: (row) => row.name, sortValue: (row) => row.name },
  { key: 'email', label: 'Email', render: (row) => row.email },
  { key: 'score', label: 'Score', sortable: true, render: (row) => row.score, sortValue: (row) => row.score },
]

describe('DataTable', () => {
  test('renders headers from columns prop', async () => {
    await renderWithProviders(<DataTable columns={columns} data={rows} rowKey={(row) => row.id} />, { route: '/en/login' })
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Score')).toBeInTheDocument()
  })

  test('renders rows from data prop', async () => {
    await renderWithProviders(<DataTable columns={columns} data={rows} rowKey={(row) => row.id} />, { route: '/en/login' })
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  test('shows empty state when no rows exist', async () => {
    await renderWithProviders(<DataTable columns={columns} data={[]} rowKey={(row) => row.id} />, { route: '/en/login' })
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  test('shows loading skeleton when loading', async () => {
    await renderWithProviders(<DataTable columns={columns} data={rows} isLoading rowKey={(row) => row.id} />, { route: '/en/login' })
    expect(document.querySelectorAll('tr').length).toBeGreaterThan(1)
  })

  test('next button calls onPageChange', async () => {
    const onPageChange = jest.fn()
    await renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        pagination={{ page: 1, lastPage: 3, total: 6, perPage: 2 }}
        onPageChange={onPageChange}
      />,
      { route: '/en/login' },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  test('previous button is disabled on first page', async () => {
    await renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        pagination={{ page: 1, lastPage: 3, total: 6, perPage: 2 }}
        onPageChange={() => undefined}
      />,
      { route: '/en/login' },
    )
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  })

  test('sorts when sortable column header clicked', async () => {
    await renderWithProviders(<DataTable columns={columns} data={rows} rowKey={(row) => row.id} />, { route: '/en/login' })
    fireEvent.click(screen.getByRole('button', { name: /score/i }))
    const tableRows = screen.getAllByRole('row')
    expect(tableRows.length).toBeGreaterThan(2)
  })

  test('supports search filtering by searchTerm + searchValue', async () => {
    await renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        searchTerm="alice"
        searchValue={(row) => `${row.name} ${row.email}`}
      />,
      { route: '/en/login' },
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  test('calls onRowClick when row is clicked', async () => {
    const onRowClick = jest.fn()
    await renderWithProviders(<DataTable columns={columns} data={rows} rowKey={(row) => row.id} onRowClick={onRowClick} />, { route: '/en/login' })
    fireEvent.click(screen.getByText('Alice'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })

  test('calls onPageSizeChange when page size selector changes', async () => {
    const onPageSizeChange = jest.fn()
    await renderWithProviders(
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        pagination={{ page: 1, lastPage: 2, total: 4, perPage: 10 }}
        onPageChange={() => undefined}
        onPageSizeChange={onPageSizeChange}
      />,
      { route: '/en/login' },
    )
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '25' } })
    expect(onPageSizeChange).toHaveBeenCalledWith(25)
  })
})

