import { IconChevronLeft, IconChevronRight, IconRefresh } from '../brand/icons'

interface Props {
  page: number
  pageSize: number
  rowCount: number
  total: number
  totalIsEstimate: boolean
  hasMore: boolean
  loading: boolean
  onPage(page: number): void
  onReload(): void
}

function totalLabel(total: number, estimate: boolean) {
  if (total < 0) return '? lignes'
  return `${estimate ? '≈ ' : ''}${total.toLocaleString('fr-FR')} ligne${total > 1 ? 's' : ''}`
}

export function Pagination({ page, pageSize, rowCount, total, totalIsEstimate, hasMore, loading, onPage, onReload }: Props) {
  const from = rowCount === 0 ? 0 : page * pageSize + 1
  return (
    <div className="footer">
      <button className="icon" disabled={page === 0 || loading} onClick={() => onPage(page - 1)} aria-label="Page précédente"><IconChevronLeft /></button>
      <span className="page-num">Page {page + 1}</span>
      <button className="icon" disabled={!hasMore || loading} onClick={() => onPage(page + 1)} aria-label="Page suivante"><IconChevronRight /></button>
      <span className="muted">{from}–{page * pageSize + rowCount}</span>
      <span className="grow" />
      {loading && <span className="loading">Chargement…</span>}
      <span className="count">{totalLabel(total, totalIsEstimate)}</span>
      <button className="icon ghost" onClick={onReload} title="Recharger"><IconRefresh /></button>
    </div>
  )
}
