import type { Cell } from '../lib/types'

export function FkCell({ value, onOpen }: { value: Cell; onOpen?: () => void }) {
  if (value === null) return <span className="null">NULL</span>
  if (!onOpen) return <>{value}</>
  return (
    <button className="fk-link" title="Ouvrir la ligne référencée" onClick={(e) => { e.stopPropagation(); onOpen() }}>
      {value}
    </button>
  )
}
