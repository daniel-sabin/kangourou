import type { Filter } from '../lib/types'
import type { TableGroupTab, TableView } from './store'

const MAX = 32

export function formatFilter(f: Filter): string {
  switch (f.op) {
    case 'eq': return `${f.column}=${f.value}`
    case 'neq': return `${f.column}≠${f.value}`
    case 'lt': return `${f.column}<${f.value}`
    case 'gt': return `${f.column}>${f.value}`
    case 'between': return `${f.column}∈[${f.value},${f.value2}]`
    case 'contains': return `${f.column}~${f.value}`
    case 'starts_with': return `${f.column}^${f.value}`
    case 'is_null': return `${f.column} est NULL`
    case 'is_not_null': return `${f.column} non NULL`
    case 'is_empty': return `${f.column} vide`
  }
}

export function viewLabel(view: TableView, index: number): string {
  if (view.filters.length === 0) return `#${index + 1}`
  const text = view.filters.map(formatFilter).join(', ')
  return text.length > MAX ? `${text.slice(0, MAX - 8)}…` : text
}

export function groupLabel(tab: TableGroupTab): string {
  const name = tab.schema === 'public' ? tab.table : `${tab.schema}.${tab.table}`
  return tab.views.length > 1 ? `${name} (${tab.views.length})` : name
}
