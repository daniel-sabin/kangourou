import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach } from 'vitest'
import type { Table } from '../lib/types'
import { type TableGroupTab, useTabs } from '../tabs/store'
import { ReferencedByMenu } from './ReferencedByMenu'

const users = {
  schema: 'public', name: 'users',
  referencedBy: [
    { name: 'o', fromSchema: 'public', fromTable: 'orders', fromColumns: ['user_id'], toSchema: 'public', toTable: 'users', toColumns: ['id'] },
    { name: 'i', fromSchema: 'billing', fromTable: 'invoices', fromColumns: ['owner'], toSchema: 'public', toTable: 'users', toColumns: ['id'] },
  ],
} as unknown as Table
const initial = useTabs.getState()
beforeEach(() => useTabs.setState(initial, true))

test('lists referencing tables and opens a filtered view', () => {
  render(<ReferencedByMenu connId="c1" table={users} columns={['id']} row={['42']} x={0} y={0} onClose={() => {}} />)
  fireEvent.click(screen.getByText('billing.invoices.owner'))
  const tab = useTabs.getState().tabs[0] as TableGroupTab
  expect(tab).toMatchObject({ schema: 'billing', table: 'invoices' })
  expect(tab.views[0].filters).toEqual([{ column: 'owner', op: 'eq', value: '42', value2: '' }])
})

test('shows an empty message when nothing references the table', () => {
  render(<ReferencedByMenu connId="c1" table={{ ...users, referencedBy: [] }} columns={['id']} row={['42']} x={0} y={0} onClose={() => {}} />)
  expect(screen.getByText('Aucune table ne référence celle-ci')).toBeInTheDocument()
})
