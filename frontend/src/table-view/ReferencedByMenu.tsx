import { useEffect } from 'react'
import type { Cell, Table } from '../lib/types'
import { useTabs } from '../tabs/store'
import { referencingFilters } from './fk'

interface Props {
  connId: string
  table: Table
  columns: string[]
  row: Cell[]
  x: number
  y: number
  onClose(): void
}

export function ReferencedByMenu({ connId, table, columns, row, x, y, onClose }: Props) {
  const openView = useTabs((s) => s.openView)

  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      onClose()
    }
    window.addEventListener('keydown', close)
    window.addEventListener('mousedown', close)
    return () => {
      window.removeEventListener('keydown', close)
      window.removeEventListener('mousedown', close)
    }
  }, [onClose])

  return (
    <div className="menu" style={{ left: x, top: y }} onMouseDown={(e) => e.stopPropagation()} role="menu">
      <div className="menu-title">Référencé par</div>
      {table.referencedBy.length === 0 && <div className="menu-title">Aucune table ne référence celle-ci</div>}
      {table.referencedBy.map((ref) => {
        const filters = referencingFilters(ref, columns, row)
        const label = `${ref.fromSchema}.${ref.fromTable}.${ref.fromColumns.join(',')}`
        return (
          <button
            key={`${ref.fromSchema}.${ref.fromTable}.${ref.name}`}
            role="menuitem"
            disabled={!filters}
            onClick={() => {
              if (filters) openView(connId, ref.fromSchema, ref.fromTable, filters)
              onClose()
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
