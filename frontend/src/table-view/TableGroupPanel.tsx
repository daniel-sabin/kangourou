import { SubTabBar } from '../tabs/SubTabBar'
import type { TableGroupTab } from '../tabs/store'
import { TableViewPanel } from './TableViewPanel'

export function TableGroupPanel({ tab }: { tab: TableGroupTab }) {
  const view = tab.views.find((v) => v.id === tab.activeViewId) ?? tab.views[0]
  return (
    <div className="tab-content">
      <SubTabBar tab={tab} />
      <TableViewPanel key={view.id} tab={tab} view={view} />
    </div>
  )
}
