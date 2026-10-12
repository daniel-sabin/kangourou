import { IconClose } from '../brand/icons'
import { viewLabel } from './labels'
import { type TableGroupTab, useTabs } from './store'

export function SubTabBar({ tab }: { tab: TableGroupTab }) {
  const { activateView, closeView } = useTabs()
  return (
    <div className="subtabbar" role="tablist">
      {tab.views.map((v, i) => (
        <div
          key={v.id}
          role="tab"
          aria-selected={v.id === tab.activeViewId}
          className={`tab ${v.id === tab.activeViewId ? 'active' : ''}`}
          onClick={() => activateView(tab.id, v.id)}
          onAuxClick={(e) => e.button === 1 && closeView(tab.id, v.id)}
        >
          {viewLabel(v, i)}
          <button className="close" aria-label="Fermer la vue" onClick={(e) => { e.stopPropagation(); closeView(tab.id, v.id) }}><IconClose size={12} /></button>
        </div>
      ))}
    </div>
  )
}
