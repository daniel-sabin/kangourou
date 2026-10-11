import type { AppError } from './types'

function isAppError(e: unknown): e is AppError {
  return typeof e === 'object' && e !== null && typeof (e as AppError).code === 'string' && typeof (e as AppError).message === 'string'
}

export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e
  const raw = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e)
  try {
    const parsed: unknown = JSON.parse(raw)
    if (isAppError(parsed)) return parsed
  } catch {
    // not JSON
  }
  return { code: 'kangourou.internal', message: raw }
}

export const isConnectionLost = (e: AppError) => e.code === 'kangourou.connection_lost'
