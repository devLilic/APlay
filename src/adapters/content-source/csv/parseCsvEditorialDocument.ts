import type {
  ContentSourceDiagnostic,
  ContentSourceLoadResult,
} from '@/adapters/content-source/contracts'
import type { EditorialBlock, EditorialDocument } from '@/core/models/editorial'
import { supportedEntityTypes, type SupportedEntityType } from '@/core/entities/entityTypes'
import type { CsvParseOptions } from './types'
import { parseCsvRows } from './parseCsvRows'
import {
  combineTitleParts,
  isBlockDelimiter,
  normalizeCellValue,
  parseBlockName,
} from './utils'

const defaultBlockName = 'Imported Block'

export function parseCsvEditorialDocument(
  content: string,
  options: CsvParseOptions = {},
): Omit<ContentSourceLoadResult, 'source'> {
  const { table, diagnostics } = parseCsvRows(content)
  const columnIndexByName = createColumnIndexByName(table.header)
  const blockDiagnostics = createMissingColumnDiagnostics(table.header, options)
  const blocks: EditorialBlock[] = []
  let currentBlock: EditorialBlock | null = null

  for (const row of table.rows) {
    const firstValue = row.values[0]?.trim()
    if (!firstValue) {
      continue
    }

    if (isBlockDelimiter(firstValue)) {
      currentBlock = createEmptyBlock(parseBlockName(firstValue))
      blocks.push(currentBlock)
      continue
    }

    if (!currentBlock) {
      currentBlock = createEmptyBlock(defaultBlockName)
      blocks.push(currentBlock)
    }

    const typeValue = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, 'type'))
    if (!typeValue) {
      continue
    }

    if (!isSupportedEntityType(typeValue)) {
      diagnostics.push({
        severity: 'warning',
        code: 'unknown-type',
        message: `Unsupported content type "${typeValue}" on line ${row.lineNumber}`,
        details: {
          lineNumber: row.lineNumber,
          type: typeValue,
        },
      })
      continue
    }

    pushEntityIntoBlock(currentBlock, typeValue, row.values, columnIndexByName)
  }

  const document: EditorialDocument = {
    blocks,
  }

  return {
    document,
    diagnostics: [...blockDiagnostics, ...diagnostics],
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

function createColumnIndexByName(header: string[]): Record<string, number> {
  return Object.fromEntries(
    header.map((columnName, index) => [columnName.trim(), index]),
  )
}

function resolveCellValue(
  values: string[],
  columnIndexByName: Record<string, number>,
  columnName: string,
): string | undefined {
  const index = columnIndexByName[columnName]
  return index === undefined ? undefined : values[index]
}

function pushEntityIntoBlock(
  block: EditorialBlock,
  entityType: SupportedEntityType,
  values: string[],
  columnIndexByName: Record<string, number>,
): void {
  switch (entityType) {
    case 'title': {
      const text = combineTitleParts(
        normalizeCellValue(resolveCellValue(values, columnIndexByName, 'number')),
        normalizeCellValue(resolveCellValue(values, columnIndexByName, 'title')),
      )
      if (text) {
        block.titles.push({ text })
      }
      return
    }
    case 'supertitle': {
      const text = normalizeCellValue(resolveCellValue(values, columnIndexByName, 'supertitle'))
      if (text) {
        block.supertitles.push({ text })
      }
      return
    }
    case 'person': {
      const name = normalizeCellValue(resolveCellValue(values, columnIndexByName, 'name'))
      const role = normalizeCellValue(resolveCellValue(values, columnIndexByName, 'role'))
      if (name) {
        block.persons.push(role ? { name, role } : { name })
      }
      return
    }
    case 'location': {
      const value = normalizeCellValue(resolveCellValue(values, columnIndexByName, 'location'))
      if (value) {
        block.locations.push({ value })
      }
      return
    }
    case 'breakingNews': {
      const value = normalizeCellValue(resolveCellValue(values, columnIndexByName, 'breakingNews'))
      if (value) {
        block.breakingNews.push({ value })
      }
      return
    }
    case 'waitingTitle': {
      const value = normalizeCellValue(resolveCellValue(values, columnIndexByName, 'waitingTitle'))
      if (value) {
        block.waitingTitles.push({ value })
      }
      return
    }
    case 'waitingLocation': {
      const value = normalizeCellValue(resolveCellValue(values, columnIndexByName, 'waitingLocation'))
      if (value) {
        block.waitingLocations.push({ value })
      }
      return
    }
    case 'phone': {
      const label = normalizeCellValue(resolveCellValue(values, columnIndexByName, 'phoneLabel'))
      const number = normalizeCellValue(resolveCellValue(values, columnIndexByName, 'phoneNumber'))
      if (label && number) {
        block.phones.push({ label, number })
      }
      return
    }
  }
}

function createMissingColumnDiagnostics(
  header: string[],
  options: CsvParseOptions,
): ContentSourceDiagnostic[] {
  const availableColumns = new Set(header.map((column) => column.trim()).filter(Boolean))
  const expectedColumnsByGraphicId = options.expectedColumnsByGraphicId ?? {}

  const diagnostics: ContentSourceDiagnostic[] = []

  for (const [graphicId, expectedColumns] of Object.entries(expectedColumnsByGraphicId)) {
    const missingColumns = expectedColumns.filter((column) => !availableColumns.has(column))
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

function isSupportedEntityType(value: string): value is SupportedEntityType {
  return supportedEntityTypes.includes(value as SupportedEntityType)
}
