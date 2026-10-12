import { IconClose } from '../brand/icons'
import { groupLabel } from './labels'
import { useTabs } from './store'

export function TabBar() {
  const { tabs, activeTabId, activateTab, closeTab } = useTabs()
  if (tabs.length === 0) return null
  return (
    <div className="tabbar" role="tablist">
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tab"
          aria-selected={t.id === activeTabId}
          className={`tab ${t.id === activeTabId ? 'active' : ''}`}
          onClick={() => activateTab(t.id)}
          onAuxClick={(e) => e.button === 1 && closeTab(t.id)}
        >
          {t.kind === 'table-group' ? groupLabel(t) : t.title}
          <button className="close" aria-label="Fermer" onClick={(e) => { e.stopPropagation(); closeTab(t.id) }}><IconClose size={12} /></button>
        </div>
      ))}
    </div>
  )
}
