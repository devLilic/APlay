import type {
  EditorialBlock,
  GraphicConfigEntityCollections,
  GraphicConfigEntityItem,
} from '@/core/models/editorial'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import type { CsvRow } from './types'
import { normalizeCellValue } from './utils'

interface GraphicCollectionPlan {
  graphicId: string
  entityType: GraphicInstanceConfig['entityType']
  bindings: Array<{
    sourceColumn: string
    targetField: string
  }>
}

export function createGraphicCollectionPlans(graphics: GraphicInstanceConfig[]): GraphicCollectionPlan[] {
  return graphics
    .filter((graphic) => graphic.kind !== 'static' && graphic.entityType !== 'image')
    .map((graphic) => ({
      graphicId: graphic.id,
      entityType: graphic.entityType,
      bindings: (graphic.bindings ?? [])
        .map((binding) => ({
          sourceColumn: binding.sourceField.trim(),
          targetField: binding.targetField.trim(),
        }))
        .filter((binding) => binding.sourceColumn.length > 0 && binding.targetField.length > 0),
    }))
}

export function createEmptyGraphicConfigEntityCollections(
  plans: GraphicCollectionPlan[],
): GraphicConfigEntityCollections {
  return Object.fromEntries(plans.map((plan) => [plan.graphicId, []]))
}

export function appendGraphicConfigEntityCollectionsRow(
  entityCollections: GraphicConfigEntityCollections,
  row: CsvRow,
  columnIndexByName: Record<string, number>,
  plans: GraphicCollectionPlan[],
): void {
  for (const plan of plans) {
    const item = extractGraphicCollectionItem(row, columnIndexByName, plan)
    if (!item) {
      continue
    }

    const collection = entityCollections[plan.graphicId]
    if (!collection) {
      continue
    }

    if (!collection.some((entry) => areGraphicConfigItemsEqual(entry, item))) {
      collection.push(item)
    }
  }
}

export function collectGraphicConfigExpectedColumns(plans: GraphicCollectionPlan[]): Record<string, string[]> {
  return Object.fromEntries(
    plans.map((plan) => [plan.graphicId, plan.bindings.map((binding) => binding.sourceColumn)]),
  )
}

export function collectGraphicConfigMappingColumns(plans: GraphicCollectionPlan[]): string[] {
  return Array.from(new Set(plans.flatMap((plan) => plan.bindings.map((binding) => binding.sourceColumn))))
}

export function deriveLegacyEntityCollectionsFromGraphicConfigs(
  entityCollections: GraphicConfigEntityCollections,
  plans: GraphicCollectionPlan[],
): Pick<EditorialBlock, 'titles' | 'persons' | 'locations' | 'phones'> {
  const block: Pick<EditorialBlock, 'titles' | 'persons' | 'locations' | 'phones'> = {
    titles: [],
    persons: [],
    locations: [],
    phones: [],
  }

  for (const plan of plans) {
    const collection = entityCollections[plan.graphicId] ?? []

    switch (plan.entityType) {
      case 'title':
        for (const item of collection) {
          const text = normalizeText(item.text)
          if (!text) {
            continue
          }

          const number = normalizeText(item.number)
          if (!block.titles.some((entry) => entry.text === text && entry.number === number)) {
            const id = `title-${block.titles.length + 1}`
            block.titles.push(number ? { id, number, text } : { id, text })
          }
        }
        break
      case 'person':
        for (const item of collection) {
          const name = normalizeText(item.name)
          if (!name) {
            continue
          }

          const role = normalizeText(item.role)
          if (!block.persons.some((entry) => entry.name === name && entry.role === role)) {
            block.persons.push(role ? { name, role } : { name })
          }
        }
        break
      case 'location':
        for (const item of collection) {
          const value = normalizeText(item.value)
          if (value && !block.locations.some((entry) => entry.value === value)) {
            block.locations.push({ value })
          }
        }
        break
      case 'phone':
        for (const item of collection) {
          const label = normalizeText(item.label)
          const number = normalizeText(item.number)
          if (label && number && !block.phones.some((entry) => entry.label === label && entry.number === number)) {
            block.phones.push({ label, number })
          }
        }
        break
      case 'image':
        break
    }
  }

  return block
}

function extractGraphicCollectionItem(
  row: CsvRow,
  columnIndexByName: Record<string, number>,
  plan: GraphicCollectionPlan,
): GraphicConfigEntityItem | null {
  const item: GraphicConfigEntityItem = {}

  for (const binding of plan.bindings) {
    const value = normalizeCellValue(resolveCellValue(row.values, columnIndexByName, binding.sourceColumn))
    if (value !== undefined) {
      item[binding.targetField] = value
    }
  }

  return Object.keys(item).length > 0 ? item : null
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

function areGraphicConfigItemsEqual(
  left: GraphicConfigEntityItem,
  right: GraphicConfigEntityItem,
): boolean {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b))
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b))

  if (leftEntries.length !== rightEntries.length) {
    return false
  }

  return leftEntries.every(([leftKey, leftValue], index) => {
    const [rightKey, rightValue] = rightEntries[index] ?? []
    return leftKey === rightKey && leftValue === rightValue
  })
}

function normalizeText(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}
