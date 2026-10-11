import type { ForeignKey, Table } from '../lib/types'
import { fkForColumn, fkTargetFilters, referencingFilters } from './fk'

const composite: ForeignKey = {
  name: 'shipments_item_fk', fromSchema: 'public', fromTable: 'shipments', fromColumns: ['line_no', 'order_id'],
  toSchema: 'public', toTable: 'order_items', toColumns: ['line', 'order'],
}
const simple: ForeignKey = {
  name: 'orders_user_fk', fromSchema: 'public', fromTable: 'orders', fromColumns: ['user_id'],
  toSchema: 'public', toTable: 'users', toColumns: ['id'],
}
const shipments = { foreignKeys: [composite] } as unknown as Table

test('fkForColumn finds composite members', () => {
  expect(fkForColumn(shipments, 'order_id')).toBe(composite)
  expect(fkForColumn(shipments, 'id')).toBeUndefined()
})

test('fkTargetFilters maps source values onto target columns in order', () => {
  expect(fkTargetFilters(composite, ['id', 'order_id', 'line_no'], ['9', '10', '2'])).toEqual([
    { column: 'line', op: 'eq', value: '2', value2: '' },
    { column: 'order', op: 'eq', value: '10', value2: '' },
  ])
})

test('returns null when any FK column is null', () => {
  expect(fkTargetFilters(composite, ['id', 'order_id', 'line_no'], ['9', '10', null])).toBeNull()
  expect(fkTargetFilters(simple, ['id', 'user_id'], ['1', null])).toBeNull()
})

test('returns null when an FK column is not in the result', () => {
  expect(fkTargetFilters(simple, ['id'], ['1'])).toBeNull()
})

test('referencingFilters filters the referencing table on this row values', () => {
  expect(referencingFilters(simple, ['id', 'name'], ['42', 'ann'])).toEqual([
    { column: 'user_id', op: 'eq', value: '42', value2: '' },
  ])
  expect(referencingFilters(simple, ['id'], [null])).toBeNull()
})
