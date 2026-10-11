import type { Cell, Filter, ForeignKey, Table } from '../lib/types'

export function fkForColumn(table: Table, column: string): ForeignKey | undefined {
  return table.foreignKeys.find((fk) => fk.fromColumns.includes(column))
}

function mapValues(sourceColumns: string[], targetColumns: string[], columns: string[], row: Cell[]): Filter[] | null {
  const filters: Filter[] = []
  for (let i = 0; i < sourceColumns.length; i++) {
    const idx = columns.indexOf(sourceColumns[i])
    if (idx === -1) return null
    const value = row[idx]
    if (value === null || value === undefined) return null
    filters.push({ column: targetColumns[i], op: 'eq', value, value2: '' })
  }
  return filters
}

export function fkTargetFilters(fk: ForeignKey, columns: string[], row: Cell[]): Filter[] | null {
  return mapValues(fk.fromColumns, fk.toColumns, columns, row)
}

export function referencingFilters(ref: ForeignKey, columns: string[], row: Cell[]): Filter[] | null {
  return mapValues(ref.toColumns, ref.fromColumns, columns, row)
}
