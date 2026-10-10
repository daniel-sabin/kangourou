import { SubTabBar } from '../tabs/SubTabBar'
import type { TableGroupTab } from '../tabs/store'

export function TableGroupPanel({ tab }: { tab: TableGroupTab }) {
  const view = tab.views.find((v) => v.id === tab.activeViewId) ?? tab.views[0]
  return (
    <div className="tab-content">
      <SubTabBar tab={tab} />
      <div key={view.id} className="empty-state">{tab.schema}.{tab.table}</div>
    </div>
  )
}
