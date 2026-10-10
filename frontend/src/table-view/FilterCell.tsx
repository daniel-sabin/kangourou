import { useEffect, useRef, useState } from 'react'
import type { Column, Filter, FilterOp } from '../lib/types'
import { buildFilter, defaultOp, NO_VALUE_OPS, OP_LABELS, OP_TITLES, OPS_BY_CATEGORY } from './operators'

interface Props {
  column: Column
  filter?: Filter
  invalid?: string
  onChange(f: Filter | null): void
}

const DEBOUNCE_MS = 300

export function FilterCell({ column, filter, invalid, onChange }: Props) {
  const [op, setOp] = useState<FilterOp>(filter?.op ?? defaultOp(column.category))
  const [value, setValue] = useState(filter?.value ?? '')
  const [value2, setValue2] = useState(filter?.value2 ?? '')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => () => clearTimeout(timer.current), [])

  const apply = (nextOp: FilterOp, v: string, v2: string) => {
    clearTimeout(timer.current)
    onChangeRef.current(buildFilter(column.name, nextOp, v, v2))
  }
  const applyLater = (nextOp: FilterOp, v: string, v2: string) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChangeRef.current(buildFilter(column.name, nextOp, v, v2)), DEBOUNCE_MS)
  }

  const choices = column.category === 'boolean' ? ['true', 'false'] : column.category === 'enum' ? column.enumValues ?? [] : null
  const needsValue = !NO_VALUE_OPS.includes(op)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') apply(op, value, value2)
  }

  return (
    <div className="filter-cell" onClick={(e) => e.stopPropagation()}>
      <select
        aria-label={`Opérateur ${column.name}`}
        title={OP_TITLES[op]}
        value={op}
        onChange={(e) => {
          const next = e.target.value as FilterOp
          setOp(next)
          apply(next, value, value2)
        }}
      >
        {OPS_BY_CATEGORY[column.category].map((o) => (
          <option key={o} value={o} title={OP_TITLES[o]}>{OP_LABELS[o]}</option>
        ))}
      </select>
      {needsValue && choices && op === 'eq' && (
        <select
          aria-label={`Valeur du filtre ${column.name}`}
          className={`value-select ${invalid ? 'invalid' : ''}`}
          title={invalid}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            apply(op, e.target.value, '')
          }}
        >
          <option value="" />
          {choices.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {needsValue && !(choices && op === 'eq') && (
        <input
          aria-label={`Valeur du filtre ${column.name}`}
          className={invalid ? 'invalid' : undefined}
          title={invalid}
          value={value}
          onKeyDown={onKeyDown}
          onChange={(e) => {
            setValue(e.target.value)
            applyLater(op, e.target.value, value2)
          }}
        />
      )}
      {op === 'between' && (
        <input
          aria-label={`Valeur max du filtre ${column.name}`}
          value={value2}
          onKeyDown={onKeyDown}
          onChange={(e) => {
            setValue2(e.target.value)
            applyLater(op, value, e.target.value)
          }}
        />
      )}
    </div>
  )
}
