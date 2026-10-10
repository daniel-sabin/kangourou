import { useMemo, useState } from 'react'
import type { Schema, Table } from '../lib/types'
import { useTabs } from '../tabs/store'

const KIND_LABEL: Record<Table['kind'], string> = { table: '', view: 'vue', materialized_view: 'mat. vue', foreign_table: 'externe' }

export function SchemaTree({ connId, schema }: { connId: string; schema: Schema }) {
  const openTable = useTabs((s) => s.openTable)
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const bySchema = new Map<string, Table[]>()
    for (const t of schema.tables) {
      if (q && !t.name.toLowerCase().includes(q)) continue
      bySchema.set(t.schema, [...(bySchema.get(t.schema) ?? []), t])
    }
    return [...bySchema.entries()].sort(([a], [b]) => (a === 'public' ? -1 : b === 'public' ? 1 : a.localeCompare(b)))
  }, [schema, query])

  return (
    <div className="schema-tree">
      <input type="search" placeholder="Rechercher une table" value={query} onChange={(e) => setQuery(e.target.value)} />
      {groups.map(([name, tables]) => (
        <div key={name}>
          <div className="schema-name">{name}</div>
          {tables.map((t) => (
            <button
              key={t.name}
              className="table-item"
              title={`${t.schema}.${t.name}`}
              onClick={(e) => openTable(connId, t.schema, t.name, { newView: e.metaKey || e.ctrlKey })}
            >
              {t.name}
              {KIND_LABEL[t.kind] && <span className="kind">{KIND_LABEL[t.kind]}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
