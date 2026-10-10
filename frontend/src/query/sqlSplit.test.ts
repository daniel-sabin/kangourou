import { splitStatements, statementAt } from './sqlSplit'

const texts = (sql: string) => splitStatements(sql).map((s) => s.text)

test('splits on semicolons and trims', () => {
  expect(texts('select 1;  select 2 ;\n\nselect 3')).toEqual(['select 1', 'select 2', 'select 3'])
})

test('ignores semicolons in strings, identifiers and comments', () => {
  expect(texts(`select 'a;b', "x;y" from t; -- c;d\nselect /* e;f /* nested; */ g; */ 2`)).toEqual([
    `select 'a;b', "x;y" from t`,
    `-- c;d\nselect /* e;f /* nested; */ g; */ 2`,
  ])
})

test('handles doubled quotes and E-strings', () => {
  expect(texts(`select 'it''s;'; select E'a\\';b'; select 3`)).toEqual([`select 'it''s;'`, `select E'a\\';b'`, 'select 3'])
})

test('handles dollar quoting but not $1 params', () => {
  const fn = `create function f() returns int as $body$ begin; return 1; end; $body$ language plpgsql`
  expect(texts(`${fn}; select $$a;b$$; select $1`)).toEqual([fn, 'select $$a;b$$', 'select $1'])
})

test('offsets point into the original text', () => {
  const sql = '  select 1;\n  select 2'
  const [a, b] = splitStatements(sql)
  expect(sql.slice(a.from, a.to)).toBe('select 1')
  expect(sql.slice(b.from, b.to)).toBe('select 2')
})

test('statementAt picks the statement under or before the cursor', () => {
  const sql = 'select 1;\n\nselect 2;'
  expect(statementAt(sql, 3)?.text).toBe('select 1')
  expect(statementAt(sql, 9)?.text).toBe('select 1')
  expect(statementAt(sql, 10)?.text).toBe('select 1')
  expect(statementAt(sql, 13)?.text).toBe('select 2')
  expect(statementAt('   ', 1)).toBeNull()
})
