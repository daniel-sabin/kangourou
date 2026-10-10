import { beforeEach } from 'vitest'
import type { Filter } from '../lib/types'
import { type TableGroupTab, useTabs } from './store'

const initial = useTabs.getState()
beforeEach(() => useTabs.setState(initial, true))

const s = () => useTabs.getState()
const group = (i = 0) => s().tabs[i] as TableGroupTab
const eq = (column: string, value: string): Filter => ({ column, op: 'eq', value, value2: '' })

test('opening a table creates a group with one blank view', () => {
  s().openTable('c1', 'public', 'users')
  expect(s().tabs).toHaveLength(1)
  expect(group().kind).toBe('table-group')
  expect(group().views).toHaveLength(1)
  expect(group().views[0].filters).toEqual([])
  expect(s().activeTabId).toBe(group().id)
})

test('opening the same table again reuses the group; newView adds a view', () => {
  s().openTable('c1', 'public', 'users')
  s().openQuery('c1')
  s().openTable('c1', 'public', 'users')
  expect(s().tabs).toHaveLength(2)
  expect(s().activeTabId).toBe(group().id)
  s().openTable('c1', 'public', 'users', { newView: true })
  expect(group().views).toHaveLength(2)
  expect(group().activeViewId).toBe(group().views[1].id)
})

test('same table name on another connection or schema is a different group', () => {
  s().openTable('c1', 'public', 'users')
  s().openTable('c2', 'public', 'users')
  s().openTable('c1', 'billing', 'users')
  expect(s().tabs).toHaveLength(3)
})

test('openView adds a filtered view to the target group and records history', () => {
  s().openTable('c1', 'public', 'users')
  const firstView = group().views[0].id
  s().openView('c1', 'public', 'users', [eq('id', '42')])
  expect(group().views).toHaveLength(2)
  expect(group().views[1].filters).toEqual([eq('id', '42')])
  expect(group().activeViewId).toBe(group().views[1].id)
  expect(group().history).toEqual([firstView])
})

test('openView on a table not yet open creates the group with only that view', () => {
  s().openView('c1', 'public', 'orders', [eq('user_id', '1'), eq('tenant', '2')])
  expect(group().views).toHaveLength(1)
  expect(group().views[0].filters).toHaveLength(2)
  expect(group().history).toEqual([])
})

test('goBack returns to the previous view and skips closed ones', () => {
  s().openTable('c1', 'public', 'users')
  const v1 = group().views[0].id
  s().openView('c1', 'public', 'users', [eq('id', '1')])
  const v2 = group().activeViewId
  s().openView('c1', 'public', 'users', [eq('id', '2')])
  s().goBack(group().id)
  expect(group().activeViewId).toBe(v2)
  s().openView('c1', 'public', 'users', [eq('id', '3')])
  s().closeView(group().id, v2)
  s().goBack(group().id)
  expect(group().activeViewId).toBe(v1)
  s().goBack(group().id)
  expect(group().activeViewId).toBe(v1)
})

test('activateView pushes history only when switching', () => {
  s().openTable('c1', 'public', 'users')
  s().openTable('c1', 'public', 'users', { newView: true })
  const [v1, v2] = group().views.map((v) => v.id)
  s().activateView(group().id, v1)
  s().activateView(group().id, v1)
  expect(group().history).toEqual([v1, v2])
})

test('closing the last view closes the group and activates a neighbor', () => {
  s().openTable('c1', 'public', 'users')
  s().openTable('c1', 'public', 'orders')
  const orders = group(1)
  s().closeView(orders.id, orders.views[0].id)
  expect(s().tabs).toHaveLength(1)
  expect(s().activeTabId).toBe(group(0).id)
})

test('closing the active view activates the last remaining view', () => {
  s().openTable('c1', 'public', 'users')
  s().openTable('c1', 'public', 'users', { newView: true })
  s().openTable('c1', 'public', 'users', { newView: true })
  const [, , v3] = group().views.map((v) => v.id)
  s().closeView(group().id, v3)
  expect(group().activeViewId).toBe(group().views[1].id)
})

test('closeTab activates the previous tab, or null when empty', () => {
  s().openTable('c1', 'public', 'a')
  s().openTable('c1', 'public', 'b')
  s().openTable('c1', 'public', 'c')
  s().activateTab(group(1).id)
  s().closeTab(group(1).id)
  expect(s().activeTabId).toBe(group(0).id)
  s().closeTab(group(0).id)
  s().closeTab(group(0).id)
  expect(s().activeTabId).toBeNull()
})

test('updateView patches only the target view', () => {
  s().openTable('c1', 'public', 'users')
  s().openTable('c1', 'public', 'users', { newView: true })
  const [v1, v2] = group().views.map((v) => v.id)
  s().updateView(group().id, v2, { page: 3, sort: { column: 'id', desc: true } })
  expect(group().views.find((v) => v.id === v2)).toMatchObject({ page: 3, sort: { column: 'id', desc: true } })
  expect(group().views.find((v) => v.id === v1)?.page).toBe(0)
})

test('query tabs are numbered and never grouped', () => {
  s().openQuery('c1')
  s().openQuery('c1')
  expect(s().tabs.map((t) => (t.kind === 'query' ? t.title : ''))).toEqual(['Requête 1', 'Requête 2'])
  s().updateQuery(s().tabs[0].id, { sql: 'select 1' })
  expect(s().tabs[0]).toMatchObject({ sql: 'select 1' })
})
