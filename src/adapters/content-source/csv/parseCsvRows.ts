import type { ContentSourceDiagnostic } from '@/adapters/content-source/contracts'
import type { CsvParseOptions, CsvRow, CsvTable } from './types'
import { detectCsvDelimiter, isBlankLine } from './utils'

export function parseCsvRows(
  content: string,
  options: Pick<CsvParseOptions, 'schema'> = {},
): { table: CsvTable; diagnostics: ContentSourceDiagnostic[] } {
  const lines = content.split(/\r?\n/)
  const diagnostics: ContentSourceDiagnostic[] = []
  const significantLines = lines
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => !isBlankLine(line))

  if (significantLines.length === 0) {
    return {
      table: { header: [], rows: [] },
      diagnostics,
    }
  }

  let header: string[] = []
  const rows: CsvRow[] = []
  const hasHeader = options.schema?.hasHeader ?? true
  let headerAssigned = !hasHeader
  const delimiter = normalizeDelimiter(options.schema?.delimiter) ?? detectCsvDelimiter(significantLines[0]?.line ?? '')

  for (const { line, lineNumber } of significantLines) {
    if (!headerAssigned) {
      const parsedHeader = parseCsvLine(line, delimiter)
      if (parsedHeader.ok) {
        header = parsedHeader.values
        headerAssigned = true
      } else {
        diagnostics.push(createMalformedRowDiagnostic(lineNumber))
      }
      continue
    }

    const parsedRow = parseCsvLine(line, delimiter)
    if (!parsedRow.ok) {
      diagnostics.push(createMalformedRowDiagnostic(lineNumber))
      continue
    }

    rows.push({
      lineNumber,
      values: parsedRow.values,
    })
  }

  return {
    table: {
      header,
      rows,
    },
    diagnostics,
  }
}

function parseCsvLine(
  line: string,
  delimiter: ',' | ';',
): { ok: true; values: string[] } | { ok: false } {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (character === '"') {
      const nextCharacter = line[index + 1]
      if (inQuotes && nextCharacter === '"') {
        current += '"'
        index += 1
        continue
      }

      inQuotes = !inQuotes
      continue
    }

    if (character === delimiter && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += character
  }

  if (inQuotes) {
    return { ok: false }
  }

  values.push(current)
  return { ok: true, values }
}

function createMalformedRowDiagnostic(lineNumber: number): ContentSourceDiagnostic {
  return {
    severity: 'error',
    code: 'malformed-csv-row',
    message: `Malformed CSV row at line ${lineNumber}`,
    details: {
      lineNumber,
    },
  }
}

function normalizeDelimiter(value: string | undefined): ',' | ';' | undefined {
  return value === ',' || value === ';' ? value : undefined
}
