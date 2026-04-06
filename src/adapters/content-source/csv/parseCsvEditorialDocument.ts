import type {
  ContentSourceDiagnostic,
  ContentSourceLoadResult,
} from '@/adapters/content-source/contracts'
import type { EditorialBlock, EditorialDocument } from '@/core/models/editorial'
import type { CsvParseOptions, CsvRow } from './types'
import { parseCsvRows } from './parseCsvRows'
import {
  isBlockDelimiter,
  normalizeCellValue,
  normalizeHeaderValue,
  parseBlockName,
} from './utils'

const defaultBlockName = 'Imported Block'

const csvColumnAliases = {
  number: ['nr', 'number'],
  title: ['titlu', 'title'],
  supertitle: ['supertitle', 'supratitlu', 'supertitlu'],
  name: ['nume', 'name'],
  role: ['functie', 'funcție', 'role'],
  location: ['locatie', 'locație', 'location'],
  breakingNews: ['ultima ora', 'ultima oră', 'breaking news', 'breakingnews'],
  waitingTitle: ['titlu asteptare', 'titlu așteptare', 'waiting title', 'waitingtitle'],
  waitingLocation: ['locatie asteptare', 'locație așteptare', 'waiting location', 'waitinglocation'],
  phoneLabel: ['telefon label', 'phone label', 'phonelabel'],
  phoneNumber: ['telefon', 'numar telefon', 'număr telefon', 'phone number', 'phonenumber'],
} as const

type CsvCanonicalColumn = keyof typeof csvColumnAliases

export function parseCsvEditorialDocument(
  content: string,
  options: CsvParseOptions = {},
): Omit<ContentSourceLoadResult, 'source'> {
  const { table, diagnostics } = parseCsvRows(content)
  const columnIndexByName = createColumnIndexByName(table.header)
  const blocks: EditorialBlock[] = []
  let currentBlock: EditorialBlock | null = null

  for (const row of table.rows) {
    const firstValue = normalizeCellValue(row.values[0])
    const hasContent = row.values.some((value) => normalizeCellValue(value) !== undefined)
    if (!hasContent) {
      continue
    }

    if (firstValue && isBlockDelimiter(firstValue)) {
      currentBlock = createEmptyBlock(parseBlockName(firstValue))
      blocks.push(currentBlock)
      continue
    }

    if (!currentBlock) {
      currentBlock = createEmptyBlock(defaultBlockName)
      blocks.push(currentBlock)
    }

    pushEntitiesIntoBlock(currentBlock, row, columnIndexByName)
  }

  return {
    document: {
      blocks,
    },
    diagnostics: [
      ...createMissingColumnDiagnostics(columnIndexByName, options),
      ...diagnostics,
    ],
  }
}

function createEmptyBlock(name: string): EditorialBlock {
  return {
    name,
    titles: [],
    supertitles: [],
    persons: [],
    locations: [],
    breakingNews: [],
    waitingTitles: [],
    waitingLocations: [],
    phones: [],
  }
}

function createColumnIndexByName(header: string[]): Partial<Record<CsvCanonicalColumn, number>> {
  const normalizedHeader = header.map((columnName) => normalizeHeaderValue(columnName))
  const result: Partial<Record<CsvCanonicalColumn, number>> = {}

  for (const [columnName, aliases] of Object.entries(csvColumnAliases) as [CsvCanonicalColumn, readonly string[]][]) {
    const index = normalizedHeader.findIndex((headerValue) => headerValue !== undefined && aliases.includes(headerValue))
    if (index >= 0) {
      result[columnName] = index
    }
  }

  return result
}

function resolveCellValue(
  values: string[],
  columnIndexByName: Partial<Record<CsvCanonicalColumn, number>>,
  columnName: CsvCanonicalColumn,
): string | undefined {
  const index = columnIndexByName[columnName]
  return index === undefined ? undefined : values[index]
}

function pushEntitiesIntoBlock(
  block: EditorialBlock,
  row: CsvRow,
  columnIndexByName: Partial<Record<CsvCanonicalColumn, number>>,
): void {
  const number = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, 'number'))
  const title = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, 'title'))
  const supertitle = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, 'supertitle'))
  const name = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, 'name'))
  const role = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, 'role'))
  const location = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, 'location'))
  const breakingNews = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, 'breakingNews'))
  const waitingTitle = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, 'waitingTitle'))
  const waitingLocation = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, 'waitingLocation'))
  const phoneLabel = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, 'phoneLabel'))
  const phoneNumber = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, 'phoneNumber'))

  if (title) {
    block.titles.push(number ? { number, text: title } : { text: title })
  }

  if (supertitle) {
    block.supertitles.push({ text: supertitle })
  }

  if (name) {
    block.persons.push(role ? { name, role } : { name })
  }

  if (location) {
    block.locations.push({ value: location })
  }

  if (breakingNews) {
    block.breakingNews.push({ value: breakingNews })
  }

  if (waitingTitle) {
    block.waitingTitles.push({ value: waitingTitle })
  }

  if (waitingLocation) {
    block.waitingLocations.push({ value: waitingLocation })
  }

  if (phoneLabel && phoneNumber) {
    block.phones.push({ label: phoneLabel, number: phoneNumber })
  }
}

function createMissingColumnDiagnostics(
  columnIndexByName: Partial<Record<CsvCanonicalColumn, number>>,
  options: CsvParseOptions,
): ContentSourceDiagnostic[] {
  const expectedColumnsByGraphicId = options.expectedColumnsByGraphicId ?? {}
  const availableColumns = new Set(
    Object.entries(columnIndexByName)
      .filter((entry): entry is [CsvCanonicalColumn, number] => entry[1] !== undefined)
      .map(([columnName]) => columnName),
  )

  const diagnostics: ContentSourceDiagnostic[] = []

  for (const [graphicId, expectedColumns] of Object.entries(expectedColumnsByGraphicId)) {
    const missingColumns = expectedColumns.filter((column) => {
      const mappedColumn = mapExpectedColumnName(column)
      return mappedColumn === undefined || !availableColumns.has(mappedColumn)
    })
    if (missingColumns.length === 0) {
      continue
    }

    diagnostics.push({
      severity: 'warning',
      code: 'missing-column',
      message: `Missing expected columns for graphic "${graphicId}": ${missingColumns.join(', ')}`,
      details: {
        graphicId,
        missingColumns,
      },
    })
  }

  return diagnostics
}

function mapExpectedColumnName(columnName: string): CsvCanonicalColumn | undefined {
  const normalized = normalizeHeaderValue(columnName)
  if (!normalized) {
    return undefined
  }

  for (const [canonicalName, aliases] of Object.entries(csvColumnAliases) as [CsvCanonicalColumn, readonly string[]][]) {
    if (aliases.includes(normalized)) {
      return canonicalName
    }
  }

  return undefined
}
