import type {
  ContentSourceDiagnostic,
  ContentSourceLoadResult,
} from '@/adapters/content-source/contracts'
import type { EditorialBlock } from '@/core/models/editorial'
import type { CsvSourceSchemaConfig } from '@/settings/models/appConfig'
import type { CsvParseOptions, CsvRow } from './types'
import { parseCsvRows } from './parseCsvRows'
import { normalizeCellValue } from './utils'

const defaultBlockName = 'Imported Block'

export function parseCsvEditorialDocument(
  content: string,
  options: CsvParseOptions = {},
): Omit<ContentSourceLoadResult, 'source'> {
  const schema = options.schema ?? createDefaultCsvSchema()
  const { table, diagnostics } = parseCsvRows(content, { schema })
  const columnIndexByName = createColumnIndexByName(table.header, schema.hasHeader)
  const blocks: EditorialBlock[] = []
  let currentBlock: EditorialBlock | null = null
  const blockRegex = new RegExp(schema.blockDetection.pattern)

  for (const row of table.rows) {
    const hasContent = row.values.some((value) => normalizeCellValue(value) !== undefined)
    if (!hasContent) {
      continue
    }

    const blockSourceValue = normalizeCellValue(resolveCellValue(
      row.values,
      columnIndexByName,
      schema.blockDetection.sourceColumn,
    ))
    const blockMatch = blockSourceValue ? blockSourceValue.match(blockRegex) : null

    if (blockMatch) {
      currentBlock = createEmptyBlock(resolveBlockName(blockSourceValue ?? '', blockMatch))
      blocks.push(currentBlock)
      continue
    }

    if (!currentBlock) {
      currentBlock = createEmptyBlock(defaultBlockName)
      blocks.push(currentBlock)
    }

    pushEntitiesIntoBlock(currentBlock, row, columnIndexByName, schema)
  }

  return {
    document: {
      blocks,
    },
    diagnostics: [
      ...createMissingConfiguredColumnDiagnostics(columnIndexByName, schema),
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

function createColumnIndexByName(header: string[], hasHeader: boolean): Record<string, number> {
  if (!hasHeader) {
    return {}
  }

  return Object.fromEntries(
    header
      .map((columnName, index) => [columnName.trim(), index] as const)
      .filter((entry) => entry[0].length > 0),
  )
}

function resolveCellValue(
  values: string[],
  columnIndexByName: Record<string, number>,
  columnName: string,
): string | undefined {
  const trimmedColumnName = columnName.trim()
  const index = /^\d+$/.test(trimmedColumnName)
    ? Number(trimmedColumnName)
    : columnIndexByName[trimmedColumnName]

  return index === undefined ? undefined : values[index]
}

function pushEntitiesIntoBlock(
  block: EditorialBlock,
  row: CsvRow,
  columnIndexByName: Record<string, number>,
  schema: CsvSourceSchemaConfig,
): void {
  const titleMapping = schema.entityMappings.title
  if (titleMapping.enabled && titleMapping.fields) {
    const number = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, titleMapping.fields.number))
    const title = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, titleMapping.fields.title))
    if (title) {
      const id = createCollectionEntityId('title', block.titles.length)
      block.titles.push(number ? { id, number, text: title } : { id, text: title })
    }
  }

  const supertitleMapping = schema.entityMappings.supertitle
  if (supertitleMapping.enabled && supertitleMapping.fields) {
    const supertitle = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, supertitleMapping.fields.text))
    if (supertitle) {
      block.supertitles.push({ text: supertitle })
    }
  }

  const personMapping = schema.entityMappings.person
  if (personMapping.enabled && personMapping.fields) {
    const name = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, personMapping.fields.name))
    const role = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, personMapping.fields.role))
    if (name) {
      block.persons.push(role ? { name, role } : { name })
    }
  }

  pushValueEntity(block.locations, row.values, columnIndexByName, schema.entityMappings.location)
  pushValueEntity(block.breakingNews, row.values, columnIndexByName, schema.entityMappings.breakingNews)
  pushValueEntity(block.waitingTitles, row.values, columnIndexByName, schema.entityMappings.waitingTitle)
  pushValueEntity(block.waitingLocations, row.values, columnIndexByName, schema.entityMappings.waitingLocation)

  const phoneMapping = schema.entityMappings.phone
  if (phoneMapping.enabled && phoneMapping.fields) {
    const label = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, phoneMapping.fields.label))
    const number = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, phoneMapping.fields.number))
    if (label && number) {
      block.phones.push({ label, number })
    }
  }
}

function createCollectionEntityId(prefix: string, currentLength: number): string {
  return `${prefix}-${currentLength + 1}`
}

function pushValueEntity(
  collection: EditorialBlock['locations'] | EditorialBlock['breakingNews'] | EditorialBlock['waitingTitles'] | EditorialBlock['waitingLocations'],
  values: string[],
  columnIndexByName: Record<string, number>,
  mapping: CsvSourceSchemaConfig['entityMappings']['location'],
): void {
  if (!mapping.enabled || !mapping.fields) {
    return
  }

  const value = normalizeCellValue(resolveCellValue(values, columnIndexByName, mapping.fields.value))
  if (value) {
    collection.push({ value })
  }
}

function createMissingConfiguredColumnDiagnostics(
  columnIndexByName: Record<string, number>,
  schema: CsvSourceSchemaConfig,
): ContentSourceDiagnostic[] {
  if (!schema.hasHeader) {
    return []
  }

  const requiredColumns = new Set<string>([
    schema.blockDetection.sourceColumn,
    ...collectEnabledMappingColumns(schema),
  ])
  const missingColumns = Array.from(requiredColumns).filter((column) => columnIndexByName[column.trim()] === undefined)

  if (missingColumns.length === 0) {
    return []
  }

  return [
    {
      severity: 'warning',
      code: 'missing-column',
      message: `Missing configured source columns: ${missingColumns.join(', ')}`,
      details: {
        missingColumns,
        schemaId: schema.id,
      },
    },
  ]
}

function collectEnabledMappingColumns(schema: CsvSourceSchemaConfig): string[] {
  const columns: string[] = []

  if (schema.entityMappings.title.enabled && schema.entityMappings.title.fields) {
    columns.push(schema.entityMappings.title.fields.number, schema.entityMappings.title.fields.title)
  }

  if (schema.entityMappings.supertitle.enabled && schema.entityMappings.supertitle.fields) {
    columns.push(schema.entityMappings.supertitle.fields.text)
  }

  if (schema.entityMappings.person.enabled && schema.entityMappings.person.fields) {
    columns.push(schema.entityMappings.person.fields.name, schema.entityMappings.person.fields.role)
  }

  for (const mapping of [
    schema.entityMappings.location,
    schema.entityMappings.breakingNews,
    schema.entityMappings.waitingTitle,
    schema.entityMappings.waitingLocation,
  ]) {
    if (mapping.enabled && mapping.fields) {
      columns.push(mapping.fields.value)
    }
  }

  if (schema.entityMappings.phone.enabled && schema.entityMappings.phone.fields) {
    columns.push(schema.entityMappings.phone.fields.label, schema.entityMappings.phone.fields.number)
  }

  return columns
}

function createMissingColumnDiagnostics(
  columnIndexByName: Record<string, number>,
  options: CsvParseOptions,
): ContentSourceDiagnostic[] {
  const expectedColumnsByGraphicId = options.expectedColumnsByGraphicId ?? {}
  const availableColumns = new Set(Object.keys(columnIndexByName))
  const diagnostics: ContentSourceDiagnostic[] = []

  for (const [graphicId, expectedColumns] of Object.entries(expectedColumnsByGraphicId)) {
    const missingColumns = expectedColumns.filter((column) => {
      const trimmedColumn = column.trim()
      if (!options.schema?.hasHeader && /^\d+$/.test(trimmedColumn)) {
        return false
      }

      return !availableColumns.has(trimmedColumn)
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

function resolveBlockName(value: string, match: RegExpMatchArray): string {
  const capturedBlockName = match[1]?.trim()
  return capturedBlockName && capturedBlockName.length > 0 ? capturedBlockName : value.trim()
}

function createDefaultCsvSchema(): CsvSourceSchemaConfig {
  return {
    id: 'csv-default',
    name: 'Default CSV schema',
    type: 'csv',
    delimiter: ';',
    hasHeader: true,
    blockDetection: {
      mode: 'columnRegex',
      sourceColumn: 'Nr',
      pattern: '^---\\s*(.+?)\\s*---$',
    },
    entityMappings: {
      title: {
        enabled: true,
        fields: {
          number: 'Nr',
          title: 'Titlu',
        },
      },
      supertitle: {
        enabled: false,
      },
      person: {
        enabled: true,
        fields: {
          name: 'Nume',
          role: 'Functie',
        },
      },
      location: {
        enabled: true,
        fields: {
          value: 'Locatie',
        },
      },
      breakingNews: {
        enabled: true,
        fields: {
          value: 'Ultima Ora',
        },
      },
      waitingTitle: {
        enabled: true,
        fields: {
          value: 'Titlu Asteptare',
        },
      },
      waitingLocation: {
        enabled: true,
        fields: {
          value: 'Locatie Asteptare',
        },
      },
      phone: {
        enabled: false,
      },
    },
  }
}
