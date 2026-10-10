import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { DataGrid } from './DataGrid'

test('renders headers, cells, and reports sort clicks', () => {
  const onSort = vi.fn()
  render(<DataGrid columns={['id', 'name']} rows={[['1', 'ann'], ['2', null]]} onSort={onSort} sort={{ column: 'id', desc: true }} />)
  expect(screen.getByText('ann')).toBeInTheDocument()
  expect(screen.getByText('NULL')).toBeInTheDocument()
  expect(screen.getByText('id ▼')).toBeInTheDocument()
  fireEvent.click(screen.getByText('name'))
  expect(onSort).toHaveBeenCalledWith(1)
})

test('uses renderCell and reports double click', () => {
  const onDouble = vi.fn()
  render(<DataGrid columns={['id']} rows={[['1']]} renderCell={(v) => <b>v:{v}</b>} onCellDoubleClick={onDouble} />)
  fireEvent.doubleClick(screen.getByText('v:1'))
  expect(onDouble).toHaveBeenCalledWith(0, 0)
})
