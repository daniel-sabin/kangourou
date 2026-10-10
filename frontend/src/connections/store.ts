import { create } from 'zustand'
import * as api from '../lib/api'
import type { AppError, ConnectionConfig, SaveInput, Schema, Table } from '../lib/types'

export type ConnStatus = 'disconnected' | 'connecting' | 'connected' | 'lost'

interface ConnectionsState {
  connections: ConnectionConfig[]
  activeId: string | null
  status: Record<string, ConnStatus>
  schemas: Record<string, Schema>
  reloadTokens: Record<string, number>
  error: AppError | null
  load(): Promise<void>
  save(input: SaveInput): Promise<ConnectionConfig>
  remove(id: string): Promise<void>
  connect(id: string): Promise<void>
  disconnect(id: string): Promise<void>
  setActive(id: string | null): void
  markLost(id: string): void
  refreshSchema(id: string): Promise<void>
  findTable(connId: string, schema: string, name: string): Table | undefined
}

export const useConnections = create<ConnectionsState>()((set, get) => ({
  connections: [],
  activeId: null,
  status: {},
  schemas: {},
  reloadTokens: {},
  error: null,

  async load() {
    try {
      set({ connections: await api.listConnections(), error: null })
    } catch (e) {
      set({ error: e as AppError })
    }
  },

  async save(input) {
    const saved = await api.saveConnection(input)
    await get().load()
    return saved
  },

  async remove(id) {
    await api.deleteConnection(id)
    set((s) => ({ activeId: s.activeId === id ? null : s.activeId, status: { ...s.status, [id]: 'disconnected' } }))
    await get().load()
  },

  async connect(id) {
    set((s) => ({ status: { ...s.status, [id]: 'connecting' }, error: null }))
    try {
      await api.connect(id)
      const schema = await api.getSchema(id)
      set((s) => ({
        status: { ...s.status, [id]: 'connected' },
        schemas: { ...s.schemas, [id]: schema },
        reloadTokens: { ...s.reloadTokens, [id]: (s.reloadTokens[id] ?? 0) + 1 },
        activeId: id,
      }))
    } catch (e) {
      set((s) => ({ status: { ...s.status, [id]: 'disconnected' }, error: e as AppError }))
    }
  },

  async disconnect(id) {
    await api.disconnect(id)
    set((s) => ({ status: { ...s.status, [id]: 'disconnected' } }))
  },

  setActive(id) {
    set({ activeId: id })
  },

  markLost(id) {
    set((s) => ({ status: { ...s.status, [id]: 'lost' } }))
  },

  async refreshSchema(id) {
    try {
      const schema = await api.refreshSchema(id)
      set((s) => ({ schemas: { ...s.schemas, [id]: schema }, error: null }))
    } catch (e) {
      set({ error: e as AppError })
    }
  },

  findTable(connId, schema, name) {
    return get().schemas[connId]?.tables.find((t) => t.schema === schema && t.name === name)
  },
}))
