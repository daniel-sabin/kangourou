import { useCallback, useEffect, useRef, useState } from 'react'
import { useConnections } from '../connections/store'
import { fetchRows } from '../lib/api'
import { isConnectionLost } from '../lib/errors'
import type { AppError, BrowseResult, Filter, Sort } from '../lib/types'
import { type TableGroupTab, type TableView, useTabs } from '../tabs/store'
import { CellPopover } from './CellPopover'
import { DataGrid } from './DataGrid'
import { FilterCell } from './FilterCell'
import { fkForColumn, fkTargetFilters } from './fk'
import { FkCell } from './FkCell'
import { setColumnFilter } from './operators'
import { Pagination } from './Pagination'
import { ReferencedByMenu } from './ReferencedByMenu'

export function nextSort(current: Sort | undefined, column: string): Sort | undefined {
  if (current?.column !== column) return { column, desc: false }
  return current.desc ? undefined : { column, desc: true }
}

export function TableViewPanel({ tab, view }: { tab: TableGroupTab; view: TableView }) {
  const table = useConnections((s) => s.findTable(tab.connId, tab.schema, tab.table))
  const reloadToken = useConnections((s) => s.reloadTokens[tab.connId] ?? 0)
  const markLost = useConnections((s) => s.markLost)
  const { updateView, openView } = useTabs()

  const [result, setResult] = useState<BrowseResult | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [loading, setLoading] = useState(false)
  const [manualReload, setManualReload] = useState(0)
  const [menu, setMenu] = useState<{ row: number; x: number; y: number } | null>(null)
  const [popover, setPopover] = useState<{ row: number; col: number } | null>(null)
  const scrollTop = useRef(view.scrollTop)

  const requestKey = JSON.stringify([view.filters, view.sort, view.page])
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchRows(tab.connId, { schema: tab.schema, table: tab.table, filters: view.filters, sort: view.sort, page: view.page })
      .then((r) => {
        if (cancelled) return
        setResult(r)
        setError(null)
      })
      .catch((e: AppError) => {
        if (cancelled) return
        setError(e)
        if (isConnectionLost(e)) markLost(tab.connId)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // requestKey captures filters/sort/page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.connId, tab.schema, tab.table, requestKey, reloadToken, manualReload, markLost])

  useEffect(() => () => updateView(tab.id, view.id, { scrollTop: scrollTop.current }), [tab.id, view.id, updateView])

  const setFilters = useCallback(
    (filters: Filter[]) => updateView(tab.id, view.id, { filters, page: 0 }),
    [tab.id, view.id, updateView],
  )

  if (!table) return <div className="empty-state">Table introuvable : rafraîchissez le schéma.</div>

  const columns = result?.columns ?? table.columns.map((c) => c.name)
  const rows = result?.rows ?? []
  const invalidColumn = error?.code === 'kangourou.validation' ? error.column : undefined

  return (
    <div className="table-view">
      <DataGrid
        columns={columns}
        rows={rows}
        sort={view.sort}
        sortable={(i) => table.columns[i]?.sortable ?? false}
        onSort={(i) => updateView(tab.id, view.id, { sort: nextSort(view.sort, columns[i]), page: 0 })}
        renderFilter={(i) => {
          const column = table.columns[i]
          return (
            <FilterCell
              column={column}
              filter={view.filters.find((f) => f.column === column.name)}
              invalid={invalidColumn === column.name ? error?.message : undefined}
              onChange={(f) => setFilters(setColumnFilter(view.filters, column.name, f))}
            />
          )
        }}
        renderCell={(value, r, c) => {
          const fk = fkForColumn(table, columns[c])
          const filters = fk ? fkTargetFilters(fk, columns, rows[r]) : null
          return <FkCell value={value} onOpen={fk && filters ? () => openView(tab.connId, fk.toSchema, fk.toTable, filters) : undefined} />
        }}
        onRowContextMenu={(row, e) => {
          e.preventDefault()
          setMenu({ row, x: e.clientX, y: e.clientY })
        }}
        onCellDoubleClick={(row, col) => setPopover({ row, col })}
        initialScrollTop={view.scrollTop}
        onScrollTopChange={(top) => (scrollTop.current = top)}
      />
      {error && !invalidColumn && (
        <div className="status-error">
          {error.message}
          {error.detail && `\n${error.detail}`}
          {error.hint && `\nIndice : ${error.hint}`}
        </div>
      )}
      <Pagination
        page={view.page}
        pageSize={result?.pageSize ?? 200}
        rowCount={rows.length}
        total={result?.total ?? -1}
        totalIsEstimate={result?.totalIsEstimate ?? false}
        hasMore={result?.hasMore ?? false}
        loading={loading}
        onPage={(page) => updateView(tab.id, view.id, { page })}
        onReload={() => setManualReload((n) => n + 1)}
      />
      {menu && (
        <ReferencedByMenu connId={tab.connId} table={table} columns={columns} row={rows[menu.row]} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />
      )}
      {popover && (
        <CellPopover column={columns[popover.col]} value={rows[popover.row][popover.col]} onClose={() => setPopover(null)} />
      )}
    </div>
  )
}
