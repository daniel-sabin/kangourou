import * as ConnectionService from '../../wailsjs/go/api/ConnectionService'
import * as SchemaService from '../../wailsjs/go/api/SchemaService'
import * as BrowseService from '../../wailsjs/go/api/BrowseService'
import * as QueryService from '../../wailsjs/go/api/QueryService'
import { api, browse } from '../../wailsjs/go/models'
import { toAppError } from './errors'
import type { BrowseRequest, BrowseResult, ConnectionConfig, QueryResult, SaveInput, Schema } from './types'

async function call<T>(fn: () => Promise<unknown>): Promise<T> {
  try {
    return (await fn()) as T
  } catch (e) {
    throw toAppError(e)
  }
}

export const listConnections = () => call<ConnectionConfig[]>(() => ConnectionService.List())
export const saveConnection = (input: SaveInput) =>
  call<ConnectionConfig>(() => ConnectionService.Save(api.SaveInput.createFrom(input)))
export const deleteConnection = (id: string) => call<void>(() => ConnectionService.Delete(id))
export const testConnection = (input: SaveInput) => call<void>(() => ConnectionService.Test(api.SaveInput.createFrom(input)))
export const connect = (id: string) => call<void>(() => ConnectionService.Connect(id))
export const disconnect = (id: string) => call<void>(() => ConnectionService.Disconnect(id))
export const getSchema = (connId: string) => call<Schema>(() => SchemaService.GetSchema(connId))
export const refreshSchema = (connId: string) => call<Schema>(() => SchemaService.RefreshSchema(connId))
export const fetchRows = (connId: string, requestId: string, req: BrowseRequest) =>
  call<BrowseResult>(() => BrowseService.FetchRows(connId, requestId, browse.Request.createFrom(req)))
export const cancelFetch = (requestId: string) => call<void>(() => BrowseService.CancelFetch(requestId))
export const executeQuery = (connId: string, queryId: string, sql: string) =>
  call<QueryResult[]>(() => QueryService.Execute(connId, queryId, sql))
export const cancelQuery = (queryId: string) => call<void>(() => QueryService.Cancel(queryId))
