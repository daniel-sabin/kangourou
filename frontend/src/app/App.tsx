import { useEffect } from 'react'
import { useConnections } from '../connections/store'
import { Sidebar } from '../sidebar/Sidebar'
import { ConnectionBanner } from './ConnectionBanner'

export default function App() {
  const load = useConnections((s) => s.load)
  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <ConnectionBanner />
      </main>
    </div>
  )
}
