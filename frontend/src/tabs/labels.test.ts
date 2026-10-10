import { groupLabel, viewLabel } from './labels'
import type { TableGroupTab, TableView } from './store'

const view = (filters: TableView['filters']): TableView => ({ id: 'v', filters, page: 0, scrollTop: 0 })

test('blank views are numbered', () => {
  expect(viewLabel(view([]), 0)).toBe('#1')
  expect(viewLabel(view([]), 2)).toBe('#3')
})

test('filtered views summarize their filters', () => {
  expect(viewLabel(view([{ column: 'id', op: 'eq', value: '42', value2: '' }]), 0)).toBe('id=42')
  expect(viewLabel(view([
    { column: 'role', op: 'eq', value: 'admin', value2: '' },
    { column: 'name', op: 'is_null', value: '', value2: '' },
  ]), 0)).toBe('role=admin, name est NULL')
  expect(viewLabel(view([{ column: 'at', op: 'between', value: '2026-01-01', value2: '2026-02-01' }]), 0)).toBe('at∈[2026-01-01,2026-02-01]')
})

test('long labels are truncated to 24 chars + ellipsis', () => {
  expect(viewLabel(view([{ column: 'description', op: 'contains', value: 'quelque chose de long', value2: '' }]), 0)).toBe('description~quelque chos…')
})

test('group label shows count and non-public schema', () => {
  const tab = { kind: 'table-group', schema: 'billing', table: 'invoices', views: [view([]), view([])] } as unknown as TableGroupTab
  expect(groupLabel(tab)).toBe('billing.invoices (2)')
  expect(groupLabel({ ...tab, schema: 'public', views: [view([])] })).toBe('invoices')
})
