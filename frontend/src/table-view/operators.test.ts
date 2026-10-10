import { buildFilter, defaultOp, OPS_BY_CATEGORY, setColumnFilter } from './operators'

test('operator sets mirror the Go backend', () => {
  expect(OPS_BY_CATEGORY.text).toEqual(['contains', 'eq', 'starts_with', 'is_null', 'is_not_null', 'is_empty'])
  expect(OPS_BY_CATEGORY.number).toEqual(['eq', 'neq', 'lt', 'gt', 'between', 'is_null', 'is_not_null'])
  expect(OPS_BY_CATEGORY.temporal).toEqual(OPS_BY_CATEGORY.number)
  expect(OPS_BY_CATEGORY.boolean).toEqual(['eq', 'is_null', 'is_not_null'])
  expect(OPS_BY_CATEGORY.enum).toEqual(['eq', 'is_null', 'is_not_null'])
  expect(OPS_BY_CATEGORY.json).toEqual(['contains', 'is_null', 'is_not_null'])
  expect(OPS_BY_CATEGORY.other).toEqual(['eq', 'is_null', 'is_not_null'])
})

test('default operator', () => {
  expect(defaultOp('text')).toBe('contains')
  expect(defaultOp('json')).toBe('contains')
  expect(defaultOp('number')).toBe('eq')
})

test('buildFilter drops empty values but keeps no-value operators', () => {
  expect(buildFilter('a', 'eq', '', '')).toBeNull()
  expect(buildFilter('a', 'between', '1', '')).toBeNull()
  expect(buildFilter('a', 'is_null', 'ignored', '')).toEqual({ column: 'a', op: 'is_null', value: '', value2: '' })
  expect(buildFilter('a', 'contains', ' x ', '')).toEqual({ column: 'a', op: 'contains', value: ' x ', value2: '' })
  expect(buildFilter('a', 'eq', '1', 'stale')).toEqual({ column: 'a', op: 'eq', value: '1', value2: '' })
})

test('setColumnFilter keeps one filter per column and preserves order', () => {
  const a = { column: 'a', op: 'eq' as const, value: '1', value2: '' }
  const b = { column: 'b', op: 'eq' as const, value: '2', value2: '' }
  expect(setColumnFilter([a, b], 'a', { ...a, value: '9' })).toEqual([{ ...a, value: '9' }, b])
  expect(setColumnFilter([a, b], 'a', null)).toEqual([b])
  expect(setColumnFilter([a], 'b', b)).toEqual([a, b])
})
