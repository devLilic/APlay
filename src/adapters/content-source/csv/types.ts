import type { CsvSourceSchemaConfig, GraphicInstanceConfig } from '@/settings/models/appConfig'

export interface CsvParseOptions {
  schema?: CsvSourceSchemaConfig
  expectedColumnsByGraphicId?: Record<string, string[]>
  graphics?: GraphicInstanceConfig[]
}

export interface CsvRow {
  lineNumber: number
  values: string[]
}

export interface CsvTable {
  header: string[]
  rows: CsvRow[]
}
