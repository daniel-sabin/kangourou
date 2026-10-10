import { create } from 'zustand'
import type { AppError, Filter, QueryResult, Sort } from '../lib/types'

export interface TableView {
  id: string
  filters: Filter[]
  sort?: Sort
  page: number
  scrollTop: number
}

export interface TableGroupTab {
  kind: 'table-group'
  id: string
  connId: string
  schema: string
  table: string
  views: TableView[]
  activeViewId: string
  history: string[]
}

export interface QueryTab {
  kind: 'query'
  id: string
  connId: string
  title: string
  sql: string
  results?: QueryResult[]
  error?: AppError
  errorOffset?: number
  running?: boolean
  runningQueryId?: string
}

export type Tab = TableGroupTab | QueryTab

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
  queryCounter: number
  openTable(connId: string, schema: string, table: string, opts?: { newView?: boolean }): void
  openView(connId: string, schema: string, table: string, filters: Filter[]): void
  openQuery(connId: string): void
  activateTab(id: string): void
  activateView(tabId: string, viewId: string): void
  closeTab(id: string): void
  closeView(tabId: string, viewId: string): void
  updateView(tabId: string, viewId: string, patch: Partial<Omit<TableView, 'id'>>): void
  goBack(tabId: string): void
  updateQuery(tabId: string, patch: Partial<Omit<QueryTab, 'kind' | 'id'>>): void
}

let seq = 0
const nextId = (prefix: string) => `${prefix}${++seq}`
const newView = (filters: Filter[] = []): TableView => ({ id: nextId('v'), filters, page: 0, scrollTop: 0 })

const findGroup = (tabs: Tab[], connId: string, schema: string, table: string) =>
  tabs.find((t): t is TableGroupTab => t.kind === 'table-group' && t.connId === connId && t.schema === schema && t.table === table)

const mapGroup = (tabs: Tab[], id: string, fn: (g: TableGroupTab) => TableGroupTab): Tab[] =>
  tabs.map((t) => (t.id === id && t.kind === 'table-group' ? fn(t) : t))

const withActiveView = (g: TableGroupTab, viewId: string): TableGroupTab =>
  g.activeViewId === viewId ? g : { ...g, activeViewId: viewId, history: [...g.history, g.activeViewId] }

const neighborAfterClose = (tabs: Tab[], closedId: string, activeId: string | null): string | null => {
  if (activeId !== closedId) return activeId
  const i = tabs.findIndex((t) => t.id === closedId)
  const rest = tabs.filter((t) => t.id !== closedId)
  if (rest.length === 0) return null
  return rest[Math.max(0, i - 1)].id
}

export const useTabs = create<TabsState>()((set, get) => ({
  tabs: [],
  activeTabId: null,
  queryCounter: 0,

  openTable(connId, schema, table, opts) {
    const existing = findGroup(get().tabs, connId, schema, table)
    if (!existing) {
      const view = newView()
      const tab: TableGroupTab = { kind: 'table-group', id: nextId('t'), connId, schema, table, views: [view], activeViewId: view.id, history: [] }
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
      return
    }
    if (opts?.newView) {
      const view = newView()
      set((s) => ({
        tabs: mapGroup(s.tabs, existing.id, (g) => withActiveView({ ...g, views: [...g.views, view] }, view.id)),
        activeTabId: existing.id,
      }))
      return
    }
    set({ activeTabId: existing.id })
  },

  openView(connId, schema, table, filters) {
    const existing = findGroup(get().tabs, connId, schema, table)
    const view = newView(filters)
    if (!existing) {
      const tab: TableGroupTab = { kind: 'table-group', id: nextId('t'), connId, schema, table, views: [view], activeViewId: view.id, history: [] }
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }))
      return
    }
    set((s) => ({
      tabs: mapGroup(s.tabs, existing.id, (g) => withActiveView({ ...g, views: [...g.views, view] }, view.id)),
      activeTabId: existing.id,
    }))
  },

  openQuery(connId) {
    const n = get().queryCounter + 1
    const tab: QueryTab = { kind: 'query', id: nextId('q'), connId, title: `Requête ${n}`, sql: '' }
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id, queryCounter: n }))
  },

  activateTab(id) {
    set({ activeTabId: id })
  },

  activateView(tabId, viewId) {
    set((s) => ({ tabs: mapGroup(s.tabs, tabId, (g) => withActiveView(g, viewId)) }))
  },

  closeTab(id) {
    set((s) => ({ tabs: s.tabs.filter((t) => t.id !== id), activeTabId: neighborAfterClose(s.tabs, id, s.activeTabId) }))
  },

  closeView(tabId, viewId) {
    const g = get().tabs.find((t) => t.id === tabId)
    if (!g || g.kind !== 'table-group') return
    const views = g.views.filter((v) => v.id !== viewId)
    if (views.length === 0) {
      get().closeTab(tabId)
      return
    }
    const activeViewId = g.activeViewId === viewId ? views[views.length - 1].id : g.activeViewId
    set((s) => ({
      tabs: mapGroup(s.tabs, tabId, (x) => ({ ...x, views, activeViewId, history: x.history.filter((h) => h !== viewId) })),
    }))
  },

  updateView(tabId, viewId, patch) {
    set((s) => ({
      tabs: mapGroup(s.tabs, tabId, (g) => ({ ...g, views: g.views.map((v) => (v.id === viewId ? { ...v, ...patch } : v)) })),
    }))
  },

  goBack(tabId) {
    set((s) => ({
      tabs: mapGroup(s.tabs, tabId, (g) => {
        const history = [...g.history]
        while (history.length > 0) {
          const prev = history.pop()!
          if (g.views.some((v) => v.id === prev)) return { ...g, activeViewId: prev, history }
        }
        return { ...g, history }
      }),
    }))
  },

  updateQuery(tabId, patch) {
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === tabId && t.kind === 'query' ? { ...t, ...patch } : t)) }))
  },
}))
