import { Logo } from '../brand/Logo'
import { QueryPanel } from '../query/QueryPanel'
import { TableGroupPanel } from '../table-view/TableGroupPanel'
import { useTabs } from '../tabs/store'

export function TabContent() {
  const tab = useTabs((s) => s.tabs.find((t) => t.id === s.activeTabId))
  if (!tab) return <Welcome />
  if (tab.kind === 'table-group') return <TableGroupPanel key={tab.id} tab={tab} />
  return <QueryPanel key={tab.id} tab={tab} />
}

function Welcome() {
  return (
    <div className="welcome">
      <Logo size={72} className="welcome-logo" />
      <h1>Prêt à sauter dans vos données</h1>
      <p>Choisissez une connexion puis ouvrez une table depuis la barre latérale, ou lancez une nouvelle requête.</p>
      <div className="hints">
        <span><kbd>⌘</kbd><kbd>clic</kbd></span><span>ouvrir une table dans une nouvelle vue</span>
        <span><kbd>⌘</kbd><kbd>↵</kbd></span><span>exécuter l’instruction sous le curseur</span>
        <span><kbd>⌘</kbd><kbd>[</kbd></span><span>revenir à la vue précédente</span>
        <span><kbd>clic droit</kbd></span><span>voir les lignes qui référencent celle-ci</span>
      </div>
    </div>
  )
}
