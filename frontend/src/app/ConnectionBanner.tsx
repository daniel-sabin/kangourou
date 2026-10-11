import { useConnections } from '../connections/store'

export function ConnectionBanner() {
  const { connections, status, connect } = useConnections()
  const lost = connections.filter((c) => status[c.id] === 'lost')
  if (lost.length === 0) return null
  return (
    <>
      {lost.map((c) => (
        <div key={c.id} className="banner" role="alert">
          Déconnecté de « {c.name} »
          <button onClick={() => connect(c.id)}>Reconnecter</button>
        </div>
      ))}
    </>
  )
}
