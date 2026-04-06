export interface CsvParseOptions {
  expectedColumnsByGraphicId?: Record<string, string[]>
}

export interface CsvRow {
  lineNumber: number
  values: string[]
}

export interface CsvTable {
  header: string[]
  rows: CsvRow[]
}
