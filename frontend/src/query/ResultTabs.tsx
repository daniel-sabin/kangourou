import { useState } from 'react'
import type { QueryResult } from '../lib/types'
import { DataGrid } from '../table-view/DataGrid'

export function ResultTabs({ results }: { results: QueryResult[] }) {
  const [active, setActive] = useState(Math.max(results.length - 1, 0))
  const current = results[Math.min(active, results.length - 1)]
  if (!current) return <div className="command-tag muted">Aucun résultat</div>
  return (
    <div className="results">
      {results.length > 1 && (
        <div className="subtabbar" role="tablist">
          {results.map((r, i) => (
            <div key={i} role="tab" aria-selected={i === active} className={`tab ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}>
              {r.hasRows ? `Résultat ${i + 1}` : r.commandTag}
            </div>
          ))}
        </div>
      )}
      {current.hasRows ? (
        <>
          <DataGrid key={active} columns={current.columns ?? []} rows={current.rows ?? []} />
          <div className="footer">
            {(current.rows ?? []).length} ligne(s)
            {current.truncated && <span className="error">· résultat tronqué à 10 000 lignes</span>}
          </div>
        </>
      ) : (
        <div className="command-tag">
          {current.commandTag} · {current.rowsAffected} ligne(s) affectée(s)
        </div>
      )}
    </div>
  )
}
