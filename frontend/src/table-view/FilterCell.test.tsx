import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import type { Column } from '../lib/types'
import { FilterCell } from './FilterCell'

const col = (category: Column['category'], extra: Partial<Column> = {}): Column =>
  ({ name: 'c', type: '', castType: '', category, nullable: true, sortable: true, enumValues: null, ...extra })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

test('typing applies after 300ms debounce', () => {
  const onChange = vi.fn()
  render(<FilterCell column={col('text')} onChange={onChange} />)
  fireEvent.change(screen.getByLabelText('Valeur du filtre c'), { target: { value: 'bob' } })
  expect(onChange).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(300))
  expect(onChange).toHaveBeenCalledWith({ column: 'c', op: 'contains', value: 'bob', value2: '' })
})

test('Enter applies immediately', () => {
  const onChange = vi.fn()
  render(<FilterCell column={col('number')} onChange={onChange} />)
  const input = screen.getByLabelText('Valeur du filtre c')
  fireEvent.change(input, { target: { value: '42' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onChange).toHaveBeenCalledWith({ column: 'c', op: 'eq', value: '42', value2: '' })
})

test('choosing a no-value operator applies immediately and hides the input', () => {
  const onChange = vi.fn()
  render(<FilterCell column={col('text')} onChange={onChange} />)
  fireEvent.change(screen.getByLabelText('Opérateur c'), { target: { value: 'is_null' } })
  expect(onChange).toHaveBeenCalledWith({ column: 'c', op: 'is_null', value: '', value2: '' })
  expect(screen.queryByLabelText('Valeur du filtre c')).not.toBeInTheDocument()
})

test('clearing the value removes the filter', () => {
  const onChange = vi.fn()
  render(<FilterCell column={col('text')} filter={{ column: 'c', op: 'contains', value: 'x', value2: '' }} onChange={onChange} />)
  fireEvent.change(screen.getByLabelText('Valeur du filtre c'), { target: { value: '' } })
  act(() => vi.advanceTimersByTime(300))
  expect(onChange).toHaveBeenCalledWith(null)
})

test('enum columns use a select of values', () => {
  const onChange = vi.fn()
  render(<FilterCell column={col('enum', { enumValues: ['happy', 'sad'] })} onChange={onChange} />)
  fireEvent.change(screen.getByLabelText('Valeur du filtre c'), { target: { value: 'sad' } })
  expect(onChange).toHaveBeenCalledWith({ column: 'c', op: 'eq', value: 'sad', value2: '' })
})

test('between shows a second input', () => {
  render(<FilterCell column={col('number')} filter={{ column: 'c', op: 'between', value: '1', value2: '5' }} onChange={() => {}} />)
  expect(screen.getByLabelText('Valeur max du filtre c')).toHaveValue('5')
})

test('invalid message marks the input', () => {
  render(<FilterCell column={col('number')} invalid="invalid input syntax" onChange={() => {}} />)
  expect(screen.getByLabelText('Valeur du filtre c')).toHaveClass('invalid')
  expect(screen.getByLabelText('Valeur du filtre c')).toHaveAttribute('title', 'invalid input syntax')
})
