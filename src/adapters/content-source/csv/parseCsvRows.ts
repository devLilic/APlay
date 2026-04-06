import type { ContentSourceDiagnostic } from '@/adapters/content-source/contracts'
import type { CsvRow, CsvTable } from './types'
import { isBlankLine } from './utils'

export function parseCsvRows(content: string): { table: CsvTable; diagnostics: ContentSourceDiagnostic[] } {
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
  let headerAssigned = false

  for (const { line, lineNumber } of significantLines) {
    if (!headerAssigned && line.trim().startsWith('---')) {
      rows.push({
        lineNumber,
        values: [line.trim()],
      })
      continue
    }

    if (!headerAssigned && !line.trim().startsWith('---')) {
      const parsedHeader = parseCsvLine(line)
      if (parsedHeader.ok) {
        header = parsedHeader.values
        headerAssigned = true
      } else {
        diagnostics.push(createMalformedRowDiagnostic(lineNumber))
      }

      continue
    }

    if (line.trim().startsWith('---')) {
      rows.push({
        lineNumber,
        values: [line.trim()],
      })
      continue
    }

    const parsedRow = parseCsvLine(line)
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

function parseCsvLine(line: string): { ok: true; values: string[] } | { ok: false } {
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

    if (character === ',' && !inQuotes) {
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
