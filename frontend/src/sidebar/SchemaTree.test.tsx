import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach } from 'vitest'
import type { Schema, Table } from '../lib/types'
import { useTabs } from '../tabs/store'
import { SchemaTree } from './SchemaTree'

const t = (schema: string, name: string, kind: Table['kind'] = 'table'): Table =>
  ({ schema, name, kind, columns: [], primaryKey: null, foreignKeys: [], referencedBy: [] })
const schema: Schema = { tables: [t('public', 'users'), t('public', 'orders'), t('billing', 'invoices'), t('public', 'active_users', 'view')] }
const initial = useTabs.getState()
beforeEach(() => useTabs.setState(initial, true))

test('groups tables by schema and filters by search', () => {
  render(<SchemaTree connId="c1" schema={schema} />)
  expect(screen.getByText('billing')).toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText('Rechercher une table'), { target: { value: 'user' } })
  expect(screen.getByText('users')).toBeInTheDocument()
  expect(screen.getByText('active_users')).toBeInTheDocument()
  expect(screen.queryByText('orders')).not.toBeInTheDocument()
  expect(screen.queryByText('billing')).not.toBeInTheDocument()
})

test('click opens the table; cmd+click opens a new view', () => {
  render(<SchemaTree connId="c1" schema={schema} />)
  fireEvent.click(screen.getByText('users'))
  fireEvent.click(screen.getByText('users'), { metaKey: true })
  const tabs = useTabs.getState().tabs
  expect(tabs).toHaveLength(1)
  expect(tabs[0].kind === 'table-group' && tabs[0].views).toHaveLength(2)
})
