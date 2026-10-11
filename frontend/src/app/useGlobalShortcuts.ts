import { useEffect } from 'react'
import { useTabs } from '../tabs/store'

export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== '[') return
      const { tabs, activeTabId, goBack } = useTabs.getState()
      const tab = tabs.find((t) => t.id === activeTabId)
      if (tab?.kind === 'table-group') {
        e.preventDefault()
        goBack(tab.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
