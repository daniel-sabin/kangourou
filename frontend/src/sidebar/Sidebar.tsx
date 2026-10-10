import { useState } from 'react'
import { ConnectionDialog } from '../connections/ConnectionDialog'
import { useConnections } from '../connections/store'
import type { ConnectionConfig } from '../lib/types'

export function Sidebar() {
  const { connections, activeId, status, error, setActive, connect, disconnect } = useConnections()
  const [dialog, setDialog] = useState<{ initial?: ConnectionConfig } | null>(null)
  const active = connections.find((c) => c.id === activeId)
  const activeStatus = activeId ? status[activeId] ?? 'disconnected' : 'disconnected'

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
      {dialog && <ConnectionDialog initial={dialog.initial} onClose={() => setDialog(null)} />}
    </aside>
  )
}
