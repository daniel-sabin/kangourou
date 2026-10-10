import { useState } from 'react'
import { testConnection } from '../lib/api'
import type { AppError, ConnectionConfig, SSLMode } from '../lib/types'
import { useConnections } from './store'

const empty: ConnectionConfig = {
  id: '', name: '', host: 'localhost', port: 5432, user: 'postgres', database: 'postgres',
  sslMode: 'require', statementTimeoutSeconds: 30,
}

interface Props {
  initial?: ConnectionConfig
  onClose(): void
}

export function ConnectionDialog({ initial, onClose }: Props) {
  const { save, remove } = useConnections()
  const [config, setConfig] = useState<ConnectionConfig>(initial ?? empty)
  const [password, setPassword] = useState('')
  const [passwordChanged, setPasswordChanged] = useState(!initial)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const editing = Boolean(initial)

  const input = () => ({ config, password, passwordChanged })
  const field = <K extends keyof ConnectionConfig>(key: K, value: ConnectionConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }))

  const onTest = async () => {
    setStatus(null)
    try {
      await testConnection(input())
      setStatus({ ok: true, text: 'Connexion réussie' })
    } catch (e) {
      setStatus({ ok: false, text: (e as AppError).message })
    }
  }

  const onSave = async () => {
    try {
      await save(input())
      onClose()
    } catch (e) {
      setError(e as AppError)
    }
  }

  const onDelete = async () => {
    if (initial && window.confirm(`Supprimer la connexion « ${initial.name} » ?`)) {
      await remove(initial.id)
      onClose()
    }
  }

  const invalid = (name: string) => (error?.column === name ? 'invalid' : undefined)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Connexion">
        <h2>{editing ? 'Modifier la connexion' : 'Nouvelle connexion'}</h2>
        <label>Nom<input className={invalid('name')} value={config.name} onChange={(e) => field('name', e.target.value)} /></label>
        <div className="row">
          <label className="grow">Hôte<input className={invalid('host')} value={config.host} onChange={(e) => field('host', e.target.value)} /></label>
          <label>Port<input className={invalid('port')} type="number" value={config.port} onChange={(e) => field('port', Number(e.target.value))} /></label>
        </div>
        <label>Utilisateur<input className={invalid('user')} value={config.user} onChange={(e) => field('user', e.target.value)} /></label>
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            placeholder={editing && !passwordChanged ? '(inchangé)' : ''}
            onChange={(e) => {
              setPassword(e.target.value)
              setPasswordChanged(true)
            }}
          />
        </label>
        <label>Base<input className={invalid('database')} value={config.database} onChange={(e) => field('database', e.target.value)} /></label>
        <div className="row">
          <label className="grow">
            SSL
            <select value={config.sslMode} onChange={(e) => field('sslMode', e.target.value as SSLMode)}>
              <option value="disable">disable</option>
              <option value="require">require</option>
              <option value="verify-full">verify-full</option>
            </select>
          </label>
          <label>
            Timeout (s)
            <input type="number" min={1} value={config.statementTimeoutSeconds} onChange={(e) => field('statementTimeoutSeconds', Number(e.target.value))} />
          </label>
        </div>
        {status && <p className={status.ok ? 'ok' : 'error'}>{status.text}</p>}
        {error && <p className="error">{error.message}</p>}
        <div className="actions">
          {editing && <button className="danger" onClick={onDelete}>Supprimer</button>}
          <span className="grow" />
          <button onClick={onTest}>Tester</button>
          <button onClick={onClose}>Annuler</button>
          <button className="primary" onClick={onSave}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}
