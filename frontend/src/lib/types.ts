export type SSLMode = 'disable' | 'require' | 'verify-full'

export interface ConnectionConfig {
  id: string
  name: string
  host: string
  port: number
  user: string
  database: string
  sslMode: SSLMode
  statementTimeoutSeconds: number
}

export interface SaveInput {
  config: ConnectionConfig
  password: string
  passwordChanged: boolean
}

export type Category = 'text' | 'number' | 'temporal' | 'boolean' | 'enum' | 'json' | 'other'

export interface Column {
  name: string
  type: string
  castType: string
  category: Category
  nullable: boolean
  sortable: boolean
  enumValues: string[] | null
}

export interface ForeignKey {
  name: string
  fromSchema: string
  fromTable: string
  fromColumns: string[]
  toSchema: string
  toTable: string
  toColumns: string[]
}

export interface Table {
  schema: string
  name: string
  kind: 'table' | 'view' | 'materialized_view' | 'foreign_table'
  columns: Column[]
  primaryKey: string[] | null
  foreignKeys: ForeignKey[]
  referencedBy: ForeignKey[]
}

export interface Schema {
  tables: Table[]
}

export type FilterOp =
  | 'eq' | 'neq' | 'lt' | 'gt' | 'between'
  | 'contains' | 'starts_with' | 'is_null' | 'is_not_null' | 'is_empty'

export interface Filter {
  column: string
  op: FilterOp
  value: string
  value2: string
}

export interface Sort {
  column: string
  desc: boolean
}

export interface BrowseRequest {
  schema: string
  table: string
  filters: Filter[]
  sort?: Sort
  page: number
}

export type Cell = string | null

export interface BrowseResult {
  columns: string[]
  rows: Cell[][]
  primaryKey: string[] | null
  total: number
  totalIsEstimate: boolean
  hasMore: boolean
  page: number
  pageSize: number
}

export interface QueryResult {
  columns: string[] | null
  rows: Cell[][] | null
  commandTag: string
  rowsAffected: number
  hasRows: boolean
  truncated: boolean
}

export interface AppError {
  code: string
  message: string
  detail?: string
  hint?: string
  position?: number
  column?: string
}
