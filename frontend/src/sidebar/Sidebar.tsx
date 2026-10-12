import { useState } from 'react'
import { IconEdit, IconPlug, IconPlus, IconRefresh, IconTerminal } from '../brand/icons'
import { Logo } from '../brand/Logo'
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
      <div className="brand">
        <Logo size={30} />
        <div className="brand-name"><span>kangourou</span></div>
      </div>
      <div className="sidebar-header">
        <div className="conn-select">
          <span className={`status-dot ${active ? activeStatus : ''}`} />
          <select aria-label="Connexion" value={activeId ?? ''} onChange={(e) => setActive(e.target.value || null)}>
            <option value="">— Choisir une connexion —</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <button onClick={() => setDialog({})}><IconPlus size={13} />Nouvelle</button>
          {active && <button className="icon" title="Modifier la connexion" aria-label="Modifier" onClick={() => setDialog({ initial: active })}><IconEdit size={13} /></button>}
          {active && activeStatus !== 'connected' && (
            <button className="primary" disabled={activeStatus === 'connecting'} onClick={() => connect(active.id)}>
              <IconPlug size={13} />
              {activeStatus === 'connecting' ? 'Connexion…' : 'Connecter'}
            </button>
          )}
          {active && activeStatus === 'connected' && <button onClick={() => disconnect(active.id)}>Déconnecter</button>}
        </div>
        {error && <p className="error">{error.message}</p>}
      </div>
      {active && connected && (
        <>
          <div className="sidebar-actions">
            <button className="grow" onClick={() => openQuery(active.id)}><IconTerminal size={14} />Nouvelle requête</button>
            <button className="icon" title="Rafraîchir le schéma" aria-label="Rafraîchir le schéma" onClick={() => refreshSchema(active.id)}><IconRefresh /></button>
          </div>
          <SchemaTree connId={active.id} schema={schemas[active.id]} />
        </>
      )}
      {dialog && <ConnectionDialog initial={dialog.initial} onClose={() => setDialog(null)} />}
    </aside>
  )
}
