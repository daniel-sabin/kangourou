import type { Category, Filter, FilterOp } from '../lib/types'

export const OPS_BY_CATEGORY: Record<Category, FilterOp[]> = {
  text: ['contains', 'eq', 'starts_with', 'is_null', 'is_not_null', 'is_empty'],
  number: ['eq', 'neq', 'lt', 'gt', 'between', 'is_null', 'is_not_null'],
  temporal: ['eq', 'neq', 'lt', 'gt', 'between', 'is_null', 'is_not_null'],
  boolean: ['eq', 'is_null', 'is_not_null'],
  enum: ['eq', 'is_null', 'is_not_null'],
  json: ['contains', 'is_null', 'is_not_null'],
  other: ['eq', 'is_null', 'is_not_null'],
}

export const NO_VALUE_OPS: FilterOp[] = ['is_null', 'is_not_null', 'is_empty']

export const OP_LABELS: Record<FilterOp, string> = {
  eq: '=', neq: '≠', lt: '<', gt: '>', between: 'entre', contains: '∋',
  starts_with: 'a…', is_null: 'NULL', is_not_null: '¬NULL', is_empty: "''",
}

export const OP_TITLES: Record<FilterOp, string> = {
  eq: 'égal', neq: 'différent', lt: 'inférieur', gt: 'supérieur', between: 'entre', contains: 'contient',
  starts_with: 'commence par', is_null: 'est NULL', is_not_null: "n'est pas NULL", is_empty: 'est vide',
}

export function defaultOp(category: Category): FilterOp {
  return category === 'text' || category === 'json' ? 'contains' : 'eq'
}

export function buildFilter(column: string, op: FilterOp, value: string, value2: string): Filter | null {
  if (NO_VALUE_OPS.includes(op)) return { column, op, value: '', value2: '' }
  if (value === '') return null
  if (op === 'between') return value2 === '' ? null : { column, op, value, value2 }
  return { column, op, value, value2: '' }
}

export function setColumnFilter(filters: Filter[], column: string, f: Filter | null): Filter[] {
  const i = filters.findIndex((x) => x.column === column)
  if (f === null) return filters.filter((x) => x.column !== column)
  if (i === -1) return [...filters, f]
  return filters.map((x, j) => (j === i ? f : x))
}
