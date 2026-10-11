import { PostgreSQL, sql as sqlLang, type SQLNamespace } from '@codemirror/lang-sql'
import { Prec } from '@codemirror/state'
import { type EditorView, keymap } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo, useRef } from 'react'
import { useConnections } from '../connections/store'
import { cancelQuery, executeQuery } from '../lib/api'
import { isConnectionLost } from '../lib/errors'
import type { AppError } from '../lib/types'
import { type QueryTab, useTabs } from '../tabs/store'
import { errorMarkExtension, setErrorMark } from './errorMark'
import { ResultTabs } from './ResultTabs'
import { statementAt } from './sqlSplit'

export function QueryPanel({ tab }: { tab: QueryTab }) {
  const updateQuery = useTabs((s) => s.updateQuery)
  const schema = useConnections((s) => s.schemas[tab.connId])
  const markLost = useConnections((s) => s.markLost)
  const viewRef = useRef<EditorView | null>(null)

  const namespace = useMemo<SQLNamespace>(() => {
    const ns: Record<string, Record<string, string[]>> = {}
    for (const t of schema?.tables ?? []) {
      ns[t.schema] = { ...(ns[t.schema] ?? {}), [t.name]: t.columns.map((c) => c.name) }
    }
    return ns
  }, [schema])

  const run = async (mode: 'current' | 'all') => {
    const view = viewRef.current
    if (!view || tab.running) return
    const doc = view.state.doc.toString()
    const sel = view.state.selection.main
    let text = doc
    let offset = 0
    if (mode === 'current') {
      if (!sel.empty) {
        text = doc.slice(sel.from, sel.to)
        offset = sel.from
      } else {
        const stmt = statementAt(doc, sel.head)
        if (!stmt) return
        text = stmt.text
        offset = stmt.from
      }
    }
    if (!text.trim()) return
    const queryId = crypto.randomUUID()
    setErrorMark(view, null)
    updateQuery(tab.id, { running: true, runningQueryId: queryId, error: undefined })
    try {
      const results = await executeQuery(tab.connId, queryId, text)
      updateQuery(tab.id, { results, running: false, runningQueryId: undefined })
    } catch (e) {
      const err = e as AppError
      updateQuery(tab.id, { error: err, errorOffset: offset, running: false, runningQueryId: undefined })
      if (err.position) setErrorMark(view, offset + err.position - 1)
      if (isConnectionLost(err)) markLost(tab.connId)
    }
  }

  const runRef = useRef(run)
  runRef.current = run
  const shortcuts = useMemo(
    () =>
      Prec.highest(
        keymap.of([
          { key: 'Mod-Enter', run: () => { void runRef.current('current'); return true } },
          { key: 'Shift-Mod-Enter', run: () => { void runRef.current('all'); return true } },
        ]),
      ),
    [],
  )
  const extensions = useMemo(
    () => [sqlLang({ dialect: PostgreSQL, schema: namespace, defaultSchema: 'public', upperCaseKeywords: true }), shortcuts, errorMarkExtension],
    [namespace, shortcuts],
  )

  return (
    <div className="query-panel">
      <div className="toolbar">
        <button className="primary" disabled={tab.running} onClick={() => run('current')} title="Cmd/Ctrl+Entrée">Exécuter</button>
        <button disabled={tab.running} onClick={() => run('all')} title="Cmd/Ctrl+Maj+Entrée">Tout exécuter</button>
        {tab.running && tab.runningQueryId && <button className="danger" onClick={() => cancelQuery(tab.runningQueryId!)}>Annuler</button>}
        {tab.running && <span className="muted">Exécution…</span>}
      </div>
      <div className="query-editor">
        <CodeMirror
          value={tab.sql}
          theme="dark"
          height="100%"
          extensions={extensions}
          onChange={(sql) => updateQuery(tab.id, { sql })}
          onCreateEditor={(view) => (viewRef.current = view)}
        />
      </div>
      {tab.error ? (
        <div className="status-error">
          {tab.error.message}
          {tab.error.detail && `\n${tab.error.detail}`}
          {tab.error.hint && `\nIndice : ${tab.error.hint}`}
        </div>
      ) : (
        tab.results && <ResultTabs key={tab.results.length + tab.results.map((r) => r.commandTag).join()} results={tab.results} />
      )}
    </div>
  )
}
