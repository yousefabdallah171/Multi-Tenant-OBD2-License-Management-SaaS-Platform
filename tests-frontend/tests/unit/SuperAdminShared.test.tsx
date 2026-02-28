import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable'
import { RoleBadge } from '@/components/shared/RoleBadge'
import { StatsCard } from '@/components/shared/StatsCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { setLanguage } from './testUtils'

interface TestRow {
  id: number
  name: string
  count: number
}

const columns: Array<DataTableColumn<TestRow>> = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
    sortValue: (row) => row.name,
    render: (row) => row.name,
  },
  {
    key: 'count',
    label: 'Count',
    sortable: true,
    sortValue: (row) => row.count,
    render: (row) => row.count,
  },
]

function TestIcon() {
  return <svg data-testid="test-icon" />
}

beforeEach(async () => {
  await setLanguage('en')
})

test('StatsCard renders title and value', () => {
  render(<StatsCard title="Tenants" value={42} icon={TestIcon as never} />)

  expect(screen.getByText('Tenants')).toBeInTheDocument()
  expect(screen.getByText('42')).toBeInTheDocument()
})

test('StatsCard shows positive trend styling', () => {
  render(<StatsCard title="Revenue" value="$1200" icon={TestIcon as never} trend={12} />)

  const trend = screen.getByText('12%')

  expect(trend).toBeInTheDocument()
  expect(trend.closest('div')).toHaveClass('bg-emerald-100')
})

test('DataTable renders columns and rows', () => {
  render(<DataTable columns={columns} data={[{ id: 1, name: 'Beta', count: 5 }]} rowKey={(row) => row.id} />)

  expect(screen.getByText('Name')).toBeInTheDocument()
  expect(screen.getByText('Count')).toBeInTheDocument()
  expect(screen.getByText('Beta')).toBeInTheDocument()
  expect(screen.getByText('5')).toBeInTheDocument()
})

test('DataTable sorting toggles row order', async () => {
  const user = userEvent.setup()

  render(
    <DataTable
      columns={columns}
      data={[
        { id: 1, name: 'Zulu', count: 9 },
        { id: 2, name: 'Alpha', count: 1 },
      ]}
      rowKey={(row) => row.id}
    />,
  )

  await user.click(screen.getByRole('button', { name: /name/i }))

  const cells = screen.getAllByRole('cell')
  expect(cells[0]).toHaveTextContent('Alpha')
  expect(cells[2]).toHaveTextContent('Zulu')
})

test('DataTable pagination calls onPageChange', async () => {
  const user = userEvent.setup()
  const onPageChange = jest.fn()

  render(
    <DataTable
      columns={columns}
      data={[{ id: 1, name: 'Alpha', count: 1 }]}
      rowKey={(row) => row.id}
      pagination={{ page: 1, lastPage: 3, total: 21 }}
      onPageChange={onPageChange}
    />,
  )

  await user.click(screen.getByRole('button', { name: /next/i }))

  expect(onPageChange).toHaveBeenCalledWith(2)
})

test('DataTable page size selector calls onPageSizeChange', async () => {
  const user = userEvent.setup()
  const onPageSizeChange = jest.fn()

  render(
    <DataTable
      columns={columns}
      data={[{ id: 1, name: 'Alpha', count: 1 }]}
      rowKey={(row) => row.id}
      pagination={{ page: 1, lastPage: 3, total: 21, perPage: 10 }}
      onPageChange={jest.fn()}
      onPageSizeChange={onPageSizeChange}
    />,
  )

  await user.selectOptions(screen.getByRole('combobox', { name: /rows per page/i }), '25')

  expect(onPageSizeChange).toHaveBeenCalledWith(25)
})

test('DataTable shows empty state when no data exists', () => {
  render(<DataTable columns={columns} data={[]} rowKey={(row) => row.id} />)

  expect(screen.getByText(/no data available/i)).toBeInTheDocument()
})

test('DataTable search filters rows', () => {
  render(
    <DataTable
      columns={columns}
      data={[
        { id: 1, name: 'Alpha', count: 1 },
        { id: 2, name: 'Beta', count: 2 },
      ]}
      rowKey={(row) => row.id}
      searchTerm="beta"
      searchValue={(row) => row.name}
    />,
  )

  expect(screen.getByText('Beta')).toBeInTheDocument()
  expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
})

test('StatusBadge renders active styling', () => {
  render(<StatusBadge status="active" />)

  const badge = screen.getByText('active')

  expect(badge).toHaveClass('bg-emerald-100')
})

test('RoleBadge renders the role label', () => {
  render(<RoleBadge role="manager_parent" />)

  expect(screen.getByText('manager parent')).toBeInTheDocument()
})
