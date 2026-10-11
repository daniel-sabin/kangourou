import { useEffect } from 'react'
import type { Cell } from '../lib/types'

function pretty(value: Cell): string {
  if (value === null) return 'NULL'
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed === 'object' && parsed !== null) return JSON.stringify(parsed, null, 2)
  } catch {
    // not JSON
  }
  return value
}

export function CellPopover({ column, value, onClose }: { column: string; value: Cell; onClose(): void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="popover" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={column}>
        <div className="toolbar">
          <strong>{column}</strong>
          <span className="grow" />
          {value !== null && <button onClick={() => navigator.clipboard.writeText(value)}>Copier</button>}
          <button onClick={onClose}>Fermer</button>
        </div>
        <pre>{pretty(value)}</pre>
      </div>
    </div>
  )
}
