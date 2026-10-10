export interface Statement {
  from: number
  to: number
  text: string
}

const WORD = /[A-Za-z0-9_$]/
const DOLLAR_TAG = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/

/** Splits SQL on top-level semicolons, skipping strings, quoted identifiers, dollar quotes and comments. */
export function splitStatements(sql: string): Statement[] {
  const out: Statement[] = []
  const n = sql.length
  let start = 0
  let i = 0

  const push = (end: number) => {
    const raw = sql.slice(start, end)
    const text = raw.trim()
    if (!text) return
    const from = start + (raw.length - raw.trimStart().length)
    out.push({ from, to: from + text.length, text })
  }

  while (i < n) {
    const c = sql[i]
    const next = sql[i + 1]
    if (c === '-' && next === '-') {
      const nl = sql.indexOf('\n', i)
      i = nl === -1 ? n : nl + 1
      continue
    }
    if (c === '/' && next === '*') {
      let depth = 1
      i += 2
      while (i < n && depth > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') { depth++; i += 2 }
        else if (sql[i] === '*' && sql[i + 1] === '/') { depth--; i += 2 }
        else i++
      }
      continue
    }
    if (c === "'") {
      const escapes = i > 0 && (sql[i - 1] === 'E' || sql[i - 1] === 'e') && (i < 2 || !WORD.test(sql[i - 2]))
      i++
      while (i < n) {
        if (escapes && sql[i] === '\\') { i += 2; continue }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { i += 2; continue }
          i++
          break
        }
        i++
      }
      continue
    }
    if (c === '"') {
      i++
      while (i < n) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') { i += 2; continue }
          i++
          break
        }
        i++
      }
      continue
    }
    if (c === '$' && !(i > 0 && WORD.test(sql[i - 1]))) {
      const m = DOLLAR_TAG.exec(sql.slice(i))
      if (m) {
        const tag = m[0]
        const end = sql.indexOf(tag, i + tag.length)
        i = end === -1 ? n : end + tag.length
        continue
      }
    }
    if (c === ';') {
      push(i)
      start = i + 1
    }
    i++
  }
  push(n)
  return out
}

export function statementAt(sql: string, pos: number): Statement | null {
  const stmts = splitStatements(sql)
  if (stmts.length === 0) return null
  const inside = stmts.find((s) => pos >= s.from && pos <= s.to)
  if (inside) return inside
  const before = [...stmts].reverse().find((s) => s.to <= pos)
  return before ?? stmts[0]
}
