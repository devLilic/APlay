import type {
  ContentSourceDiagnostic,
  ContentSourceLoadResult,
} from '@/adapters/content-source/contracts'
import type { EditorialBlock } from '@/core/models/editorial'
import type { CsvSourceSchemaConfig } from '@/settings/models/appConfig'
import type { CsvParseOptions, CsvRow } from './types'
import {
  appendGraphicConfigEntityCollectionsRow,
  collectGraphicConfigExpectedColumns,
  collectGraphicConfigMappingColumns,
  createEmptyGraphicConfigEntityCollections,
  createGraphicCollectionPlans,
  deriveLegacyEntityCollectionsFromGraphicConfigs,
} from './graphicConfigEntityCollections'
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
  const graphicCollectionPlans = createGraphicCollectionPlans(options.graphics ?? [])
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
      currentBlock = createEmptyBlock(resolveBlockName(blockSourceValue ?? '', blockMatch), graphicCollectionPlans)
      blocks.push(currentBlock)
      continue
    }

    if (!currentBlock) {
      currentBlock = createEmptyBlock(defaultBlockName, graphicCollectionPlans)
      blocks.push(currentBlock)
    }

    pushEntitiesIntoBlock(currentBlock, row, columnIndexByName, schema, graphicCollectionPlans)
  }

  return {
    document: {
      blocks,
    },
    diagnostics: [
      ...createMissingConfiguredColumnDiagnostics(columnIndexByName, schema, graphicCollectionPlans),
      ...createMissingColumnDiagnostics(columnIndexByName, {
        ...options,
        expectedColumnsByGraphicId: {
          ...collectGraphicConfigExpectedColumns(graphicCollectionPlans),
          ...(options.expectedColumnsByGraphicId ?? {}),
        },
      }),
      ...diagnostics,
    ],
  }
}

function createEmptyBlock(
  name: string,
  graphicCollectionPlans: ReturnType<typeof createGraphicCollectionPlans>,
): EditorialBlock {
  return {
    name,
    titles: [],
    persons: [],
    locations: [],
    phones: [],
    ...(graphicCollectionPlans.length > 0
      ? { entityCollections: createEmptyGraphicConfigEntityCollections(graphicCollectionPlans) }
      : {}),
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
  graphicCollectionPlans: ReturnType<typeof createGraphicCollectionPlans>,
): void {
  if (graphicCollectionPlans.length > 0 && block.entityCollections) {
    appendGraphicConfigEntityCollectionsRow(block.entityCollections, row, columnIndexByName, graphicCollectionPlans)
    const legacyCollections = deriveLegacyEntityCollectionsFromGraphicConfigs(
      block.entityCollections,
      graphicCollectionPlans,
    )

    block.titles = legacyCollections.titles
    block.persons = legacyCollections.persons
    block.locations = legacyCollections.locations
    block.phones = legacyCollections.phones
    return
  }

  const titleMapping = schema.entityMappings.title
  if (titleMapping.enabled && titleMapping.fields) {
    const number = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, titleMapping.fields.number))
    const title = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, titleMapping.fields.title))
    if (title) {
      addTitleEntity(block, number ? { number, text: title } : { text: title })
    }
  }

  const personMapping = schema.entityMappings.person
  if (personMapping.enabled && personMapping.fields) {
    const name = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, personMapping.fields.name))
    const role = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, personMapping.fields.role))
    if (name) {
      addPersonEntity(block, role ? { name, role } : { name })
    }
  }

  pushValueEntity(block.locations, row.values, columnIndexByName, schema.entityMappings.location)

  const phoneMapping = schema.entityMappings.phone
  if (phoneMapping.enabled && phoneMapping.fields) {
    const label = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, phoneMapping.fields.label))
    const number = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, phoneMapping.fields.number))
    if (label && number) {
      addPhoneEntity(block, { label, number })
    }
  }
}

function createCollectionEntityId(prefix: string, currentLength: number): string {
  return `${prefix}-${currentLength + 1}`
}

function pushValueEntity(
  collection: EditorialBlock['locations'],
  values: string[],
  columnIndexByName: Record<string, number>,
  mapping: CsvSourceSchemaConfig['entityMappings']['location'],
): void {
  if (!mapping.enabled || !mapping.fields) {
    return
  }

  const value = normalizeCellValue(resolveCellValue(values, columnIndexByName, mapping.fields.value))
  if (value) {
    if (!collection.some((item) => item.value === value)) {
      collection.push({ value })
    }
  }
}

function createMissingConfiguredColumnDiagnostics(
  columnIndexByName: Record<string, number>,
  schema: CsvSourceSchemaConfig,
  graphicCollectionPlans: ReturnType<typeof createGraphicCollectionPlans>,
): ContentSourceDiagnostic[] {
  if (!schema.hasHeader) {
    return []
  }

  const requiredColumns = new Set<string>([schema.blockDetection.sourceColumn])
  const manualMappingColumns = collectGraphicConfigMappingColumns(graphicCollectionPlans)

  if (manualMappingColumns.length > 0) {
    for (const column of manualMappingColumns) {
      requiredColumns.add(column)
    }
  } else {
    for (const column of collectEnabledMappingColumns(schema)) {
      requiredColumns.add(column)
    }
  }

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

  if (schema.entityMappings.person.enabled && schema.entityMappings.person.fields) {
    columns.push(schema.entityMappings.person.fields.name, schema.entityMappings.person.fields.role)
  }

  for (const mapping of [schema.entityMappings.location]) {
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
      phone: {
        enabled: false,
      },
    },
  }
}

function addTitleEntity(
  block: EditorialBlock,
  entity: Omit<EditorialBlock['titles'][number], 'id'>,
): void {
  const exists = block.titles.some((item) => item.text === entity.text && item.number === entity.number)
  if (exists) {
    return
  }

  const id = createCollectionEntityId('title', block.titles.length)
  block.titles.push(entity.number ? { id, number: entity.number, text: entity.text } : { id, text: entity.text })
}

function addPersonEntity(
  block: EditorialBlock,
  entity: EditorialBlock['persons'][number],
): void {
  if (!block.persons.some((item) => item.name === entity.name && item.role === entity.role)) {
    block.persons.push(entity.role ? { name: entity.name, role: entity.role } : { name: entity.name })
  }
}

function addPhoneEntity(
  block: EditorialBlock,
  entity: EditorialBlock['phones'][number],
): void {
  if (!block.phones.some((item) => item.label === entity.label && item.number === entity.number)) {
    block.phones.push(entity)
  }
}
