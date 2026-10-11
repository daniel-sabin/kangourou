import { QueryPanel } from '../query/QueryPanel'
import { TableGroupPanel } from '../table-view/TableGroupPanel'
import { useTabs } from '../tabs/store'

export function TabContent() {
  const tab = useTabs((s) => s.tabs.find((t) => t.id === s.activeTabId))
  if (!tab) return <div className="empty-state">Ouvrez une table depuis la barre latérale 🦘</div>
  if (tab.kind === 'table-group') return <TableGroupPanel key={tab.id} tab={tab} />
  return <QueryPanel key={tab.id} tab={tab} />
}
