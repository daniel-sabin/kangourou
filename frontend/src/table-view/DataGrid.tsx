import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type ReactNode, useEffect, useMemo, useRef } from 'react'
import type { Cell, Sort } from '../lib/types'

const ROW_HEIGHT = 28

interface Props {
  columns: string[]
  rows: Cell[][]
  renderCell?: (value: Cell, rowIndex: number, colIndex: number) => ReactNode
  renderFilter?: (colIndex: number) => ReactNode
  sort?: Sort
  sortable?: (colIndex: number) => boolean
  onSort?: (colIndex: number) => void
  onRowContextMenu?: (rowIndex: number, e: React.MouseEvent) => void
  onCellDoubleClick?: (rowIndex: number, colIndex: number) => void
  initialScrollTop?: number
  onScrollTopChange?: (top: number) => void
}

const defaultRender = (value: Cell) => (value === null ? <span className="null">NULL</span> : value)

export function DataGrid(props: Props) {
  const { columns, rows, renderCell = defaultRender, renderFilter, sort, sortable, onSort, onRowContextMenu, onCellDoubleClick, initialScrollTop, onScrollTopChange } = props
  const scrollRef = useRef<HTMLDivElement>(null)

  const defs = useMemo<ColumnDef<Cell[]>[]>(
    () => columns.map((name, i) => ({ id: `c${i}`, header: name, accessorFn: (row) => row[i], size: 160, minSize: 50 })),
    [columns],
  )
  const table = useReactTable({ data: rows, columns: defs, getCoreRowModel: getCoreRowModel(), columnResizeMode: 'onChange', enableColumnResizing: true })

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
    initialRect: { width: 1000, height: 600 },
  })

  const restored = useRef(false)
  useEffect(() => {
    if (!restored.current && rows.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = initialScrollTop ?? 0
      restored.current = true
    }
  }, [rows.length, initialScrollTop])

  const headers = table.getHeaderGroups()[0].headers
  const widths = headers.map((h) => h.getSize())
  const totalWidth = widths.reduce((a, b) => a + b, 0)

  return (
    <div className="grid" ref={scrollRef} onScroll={(e) => onScrollTopChange?.(e.currentTarget.scrollTop)}>
      <div className="grid-header" style={{ width: totalWidth }}>
        <div className="grid-row">
          {headers.map((h, i) => {
            const name = columns[i]
            const arrow = sort?.column === name ? (sort.desc ? ' ▼' : ' ▲') : ''
            const canSort = onSort && (sortable?.(i) ?? true)
            return (
              <div key={h.id} className="grid-cell" style={{ width: widths[i] }} onClick={() => canSort && onSort(i)} title={name}>
                {name + arrow}
                <div className="resizer" onMouseDown={h.getResizeHandler()} onClick={(e) => e.stopPropagation()} />
              </div>
            )
          })}
        </div>
        {renderFilter && (
          <div className="grid-row">
            {headers.map((h, i) => (
              <div key={h.id} className="grid-cell filter-cell" style={{ width: widths[i] }}>{renderFilter(i)}</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ height: virtualizer.getTotalSize(), width: totalWidth, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index]
          return (
            <div
              key={item.key}
              className="grid-row"
              style={{ position: 'absolute', top: 0, transform: `translateY(${item.start}px)` }}
              onContextMenu={(e) => onRowContextMenu?.(item.index, e)}
            >
              {row.map((value, c) => (
                <div key={c} className="grid-cell" style={{ width: widths[c] }} onDoubleClick={() => onCellDoubleClick?.(item.index, c)}>
                  {renderCell(value, item.index, c)}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
