import { useState } from 'react'
import { ConnectionDialog } from '../connections/ConnectionDialog'
import { useConnections } from '../connections/store'
import type { ConnectionConfig } from '../lib/types'
import { useTabs } from '../tabs/store'
import { SchemaTree } from './SchemaTree'

export function Sidebar() {
  const { connections, activeId, status, error, setActive, connect, disconnect } = useConnections()
  const [dialog, setDialog] = useState<{ initial?: ConnectionConfig } | null>(null)
  const active = connections.find((c) => c.id === activeId)
  const activeStatus = activeId ? status[activeId] ?? 'disconnected' : 'disconnected'
  const schemas = useConnections((s) => s.schemas)
  const refreshSchema = useConnections((s) => s.refreshSchema)
  const openQuery = useTabs((s) => s.openQuery)
  const connected = activeStatus === 'connected' && active !== undefined && schemas[active.id] !== undefined

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <select aria-label="Connexion" value={activeId ?? ''} onChange={(e) => setActive(e.target.value || null)}>
          <option value="">— Choisir une connexion —</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="row">
          <button onClick={() => setDialog({})}>Nouvelle</button>
          {active && <button onClick={() => setDialog({ initial: active })}>Modifier</button>}
          {active && activeStatus !== 'connected' && (
            <button className="primary" disabled={activeStatus === 'connecting'} onClick={() => connect(active.id)}>
              {activeStatus === 'connecting' ? 'Connexion…' : 'Connecter'}
            </button>
          )}
          {active && activeStatus === 'connected' && <button onClick={() => disconnect(active.id)}>Déconnecter</button>}
        </div>
        {error && <p className="error">{error.message}</p>}
      </div>
      {active && connected && (
        <>
          <div className="row" style={{ padding: '6px 8px' }}>
            <button className="grow" onClick={() => openQuery(active.id)}>Nouvelle requête</button>
            <button title="Rafraîchir le schéma" onClick={() => refreshSchema(active.id)}>⟳</button>
          </div>
          <SchemaTree connId={active.id} schema={schemas[active.id]} />
        </>
      )}
      {dialog && <ConnectionDialog initial={dialog.initial} onClose={() => setDialog(null)} />}
    </aside>
  )
}
