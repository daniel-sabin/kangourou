import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, vi } from 'vitest'

vi.mock('../lib/api', () => ({ fetchRows: vi.fn(), cancelFetch: vi.fn() }))

import { useConnections } from '../connections/store'
import * as api from '../lib/api'
import type { Schema } from '../lib/types'
import { type TableGroupTab, useTabs } from '../tabs/store'
import { nextSort, TableViewPanel } from './TableViewPanel'

const schema: Schema = {
  tables: [
    {
      schema: 'public', name: 'orders', kind: 'table', primaryKey: ['id'], referencedBy: [],
      columns: [
        { name: 'id', type: 'integer', castType: 'integer', category: 'number', nullable: false, sortable: true, enumValues: null },
        { name: 'user_id', type: 'integer', castType: 'integer', category: 'number', nullable: true, sortable: true, enumValues: null },
      ],
      foreignKeys: [{ name: 'fk', fromSchema: 'public', fromTable: 'orders', fromColumns: ['user_id'], toSchema: 'public', toTable: 'users', toColumns: ['id'] }],
    },
  ],
}
const tabsInitial = useTabs.getState()
const connInitial = useConnections.getState()

beforeEach(() => {
  useTabs.setState(tabsInitial, true)
  useConnections.setState({ ...connInitial, schemas: { c1: schema }, status: { c1: 'connected' } }, true)
  vi.mocked(api.cancelFetch).mockResolvedValue(undefined)
  vi.mocked(api.fetchRows).mockResolvedValue({
    columns: ['id', 'user_id'], rows: [['10', '42'], ['11', null]], primaryKey: ['id'],
    total: 2, totalIsEstimate: false, hasMore: false, page: 0, pageSize: 200,
  })
})

const renderPanel = () => {
  useTabs.getState().openTable('c1', 'public', 'orders')
  const tab = useTabs.getState().tabs[0] as TableGroupTab
  render(<TableViewPanel tab={tab} view={tab.views[0]} />)
  return tab
}

test('fetches rows for the view', async () => {
  renderPanel()
  expect(await screen.findByText('10')).toBeInTheDocument()
  expect(api.fetchRows).toHaveBeenCalledWith('c1', expect.any(String), { schema: 'public', table: 'orders', filters: [], sort: undefined, page: 0 })
  expect(screen.getByText('2 lignes')).toBeInTheDocument()
})

test('clicking an FK value opens a filtered view on the target table', async () => {
  renderPanel()
  fireEvent.click(await screen.findByText('42'))
  const tabs = useTabs.getState().tabs
  expect(tabs).toHaveLength(2)
  expect(tabs[1]).toMatchObject({ table: 'users' })
  expect((tabs[1] as TableGroupTab).views[0].filters).toEqual([{ column: 'id', op: 'eq', value: '42', value2: '' }])
})

test('connection_lost marks the connection as lost', async () => {
  vi.mocked(api.fetchRows).mockRejectedValue({ code: 'kangourou.connection_lost', message: 'gone' })
  renderPanel()
  await waitFor(() => expect(useConnections.getState().status.c1).toBe('lost'))
})

test('nextSort cycles asc → desc → none and resets on another column', () => {
  expect(nextSort(undefined, 'a')).toEqual({ column: 'a', desc: false })
  expect(nextSort({ column: 'a', desc: false }, 'a')).toEqual({ column: 'a', desc: true })
  expect(nextSort({ column: 'a', desc: true }, 'a')).toBeUndefined()
  expect(nextSort({ column: 'a', desc: true }, 'b')).toEqual({ column: 'b', desc: false })
})

test('a superseded request is cancelled on the backend', async () => {
  const tab = renderPanel()
  await screen.findByText('10')
  const firstId = vi.mocked(api.fetchRows).mock.calls[0][1]
  act(() => useTabs.getState().updateView(tab.id, tab.views[0].id, { page: 1 }))
  const updated = useTabs.getState().tabs[0] as TableGroupTab
  cleanup()
  render(<TableViewPanel tab={updated} view={updated.views[0]} />)
  expect(api.cancelFetch).toHaveBeenCalledWith(firstId)
})
