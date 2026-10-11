import { isConnectionLost, toAppError } from './errors'

test('parses the JSON string Wails rejects with', () => {
  const e = toAppError('{"code":"42P01","message":"relation does not exist","position":15}')
  expect(e).toEqual({ code: '42P01', message: 'relation does not exist', position: 15 })
})

test('wraps plain strings and Error instances', () => {
  expect(toAppError('boom')).toEqual({ code: 'kangourou.internal', message: 'boom' })
  expect(toAppError(new Error('bad'))).toEqual({ code: 'kangourou.internal', message: 'bad' })
})

test('passes AppError objects through', () => {
  const e = { code: 'kangourou.timeout', message: 't' }
  expect(toAppError(e)).toBe(e)
})

test('ignores JSON without code/message', () => {
  expect(toAppError('{"foo":1}')).toEqual({ code: 'kangourou.internal', message: '{"foo":1}' })
})

test('isConnectionLost', () => {
  expect(isConnectionLost({ code: 'kangourou.connection_lost', message: '' })).toBe(true)
  expect(isConnectionLost({ code: '42P01', message: '' })).toBe(false)
})
