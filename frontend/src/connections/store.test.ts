import { beforeEach, vi } from 'vitest'
import type { Schema } from '../lib/types'

vi.mock('../lib/api', () => ({
  listConnections: vi.fn(),
  saveConnection: vi.fn(),
  deleteConnection: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSchema: vi.fn(),
  refreshSchema: vi.fn(),
}))

import * as api from '../lib/api'
import { useConnections } from './store'

const schema: Schema = { tables: [{ schema: 'public', name: 'users', kind: 'table', columns: [], primaryKey: ['id'], foreignKeys: [], referencedBy: [] }] }
const initial = useConnections.getState()

beforeEach(() => {
  useConnections.setState(initial, true)
  vi.mocked(api.connect).mockResolvedValue(undefined)
  vi.mocked(api.getSchema).mockResolvedValue(schema)
})

test('connect loads the schema, activates and bumps reloadToken', async () => {
  await useConnections.getState().connect('c1')
  const s = useConnections.getState()
  expect(s.status.c1).toBe('connected')
  expect(s.activeId).toBe('c1')
  expect(s.schemas.c1).toBe(schema)
  expect(s.reloadTokens.c1).toBe(1)
  expect(s.findTable('c1', 'public', 'users')?.name).toBe('users')
})

test('connect after lost bumps reloadToken again', async () => {
  await useConnections.getState().connect('c1')
  useConnections.getState().markLost('c1')
  expect(useConnections.getState().status.c1).toBe('lost')
  await useConnections.getState().connect('c1')
  expect(useConnections.getState().status.c1).toBe('connected')
  expect(useConnections.getState().reloadTokens.c1).toBe(2)
})

test('failed connect records error and stays disconnected', async () => {
  vi.mocked(api.connect).mockRejectedValue({ code: 'kangourou.connect_failed', message: 'nope' })
  await useConnections.getState().connect('c1')
  const s = useConnections.getState()
  expect(s.status.c1).toBe('disconnected')
  expect(s.error?.code).toBe('kangourou.connect_failed')
})
