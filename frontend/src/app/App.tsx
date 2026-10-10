import { useEffect } from 'react'
import { useConnections } from '../connections/store'
import { Sidebar } from '../sidebar/Sidebar'
import { TabBar } from '../tabs/TabBar'
import { ConnectionBanner } from './ConnectionBanner'
import { TabContent } from './TabContent'
import { useGlobalShortcuts } from './useGlobalShortcuts'

export default function App() {
  const load = useConnections((s) => s.load)
  useEffect(() => {
    void load()
  }, [load])
  useGlobalShortcuts()

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <ConnectionBanner />
        <TabBar />
        <TabContent />
      </main>
    </div>
  )
}
