import type {
  AppSettings,
  CsvSourceSchemaConfig,
  GraphicInstanceConfig,
  ReferenceImageAsset,
  ShowProfileConfig,
} from '../models/appConfig'
import type { GraphicConfigFileMap } from './workspaceConfigRepository'
import {
  parseProfileConfigImport,
  type ProfileConfigExportPayload,
} from './profileConfigExport'
import { appSettingsSchema } from '../schemas/appConfigSchemas'
import { serializeGraphicConfigExport } from './graphicConfigExport'

export type ProfileImportConflictPolicy = 'replace' | 'preserve' | 'duplicate'

export interface ProfileConfigFileLoadDependencies {
  readFile: (filePath: string) => Promise<string>
}

export interface ProfileConfigFileLoadService {
  load: (filePath: string) => Promise<ProfileConfigExportPayload>
}

export interface ProfileLibraryImportOptions {
  profileConflictPolicy?: ProfileImportConflictPolicy
  graphicConflictPolicy?: ProfileImportConflictPolicy
  schemaConflictPolicy?: ProfileImportConflictPolicy
  referenceImageConflictPolicy?: ProfileImportConflictPolicy
}

export interface ProfileLibraryImportResult {
  status: 'imported'
  importedProfile: ShowProfileConfig
  settings: AppSettings
  graphicFiles: GraphicConfigFileMap
  conflicts: {
    profile: ProfileImportConflictPolicy | null
    graphics: Array<{ policy: ProfileImportConflictPolicy; existingId: string; resolvedId: string }>
    schemas: Array<{ policy: ProfileImportConflictPolicy; existingId: string; resolvedId: string }>
    referenceImages: Array<{ policy: ProfileImportConflictPolicy; existingId: string; resolvedId: string }>
  }
}

export function createProfileConfigFileLoadService(
  dependencies: ProfileConfigFileLoadDependencies,
): ProfileConfigFileLoadService {
  return {
    async load(filePath: string): Promise<ProfileConfigExportPayload> {
      const rawContent = await dependencies.readFile(filePath)
      return parseProfileConfigImportContent(rawContent)
    },
  }
}

export function parseProfileConfigImportContent(rawContent: string): ProfileConfigExportPayload {
  try {
    return parseProfileConfigImport(JSON.parse(rawContent) as unknown)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unexpected')) {
      throw new Error(`Invalid profile config JSON: ${error.message}`)
    }

    throw error
  }
}

export function importProfileConfigToLibrary(
  input: {
    content: string | unknown
    settings: AppSettings
    graphicFiles?: GraphicConfigFileMap
  },
  options: ProfileLibraryImportOptions = {},
): ProfileLibraryImportResult {
  const payload = typeof input.content === 'string'
    ? parseProfileConfigImportContent(input.content)
    : parseProfileConfigImport(input.content)
  const baseSettings = appSettingsSchema.parse(input.settings)
  const graphicFiles = { ...(input.graphicFiles ?? {}) }
  const profileConflictPolicy = options.profileConflictPolicy ?? 'replace'
  const graphicConflictPolicy = options.graphicConflictPolicy ?? 'replace'
  const schemaConflictPolicy = options.schemaConflictPolicy ?? 'replace'
  const referenceImageConflictPolicy = options.referenceImageConflictPolicy ?? 'replace'

  const referenceImageResult = importReferenceImages(
    baseSettings.referenceImages,
    payload.referenceImages,
    referenceImageConflictPolicy,
  )
  const graphicsWithResolvedReferenceImages = payload.graphics.map((graphic) =>
    applyReferenceImageIdRemap(graphic, referenceImageResult.remappedIds))
  const sourceSchemaResult = importSourceSchemas(
    baseSettings.sourceSchemas,
    payload.sourceSchemas,
    schemaConflictPolicy,
  )
  const graphicsResult = importGraphics(
    baseSettings.graphics,
    graphicsWithResolvedReferenceImages,
    graphicConflictPolicy,
  )
  const importedProfile = applyProfileRemap(payload.profile, {
    sourceSchemaIds: sourceSchemaResult.remappedIds,
    graphicIds: graphicsResult.remappedIds,
  })
  const profileResult = importProfiles(
    baseSettings.profiles,
    importedProfile,
    profileConflictPolicy,
  )
  const nextSettings = appSettingsSchema.parse({
    ...baseSettings,
    referenceImages: referenceImageResult.items,
    sourceSchemas: sourceSchemaResult.items,
    graphics: graphicsResult.items,
    profiles: profileResult.items,
  })
  const nextGraphicFiles = {
    ...graphicFiles,
    ...Object.fromEntries(
      graphicsResult.importedItems.map((graphic) => [
        `${graphic.id}.json`,
        serializeGraphicConfigExport(graphic),
      ]),
    ),
  }

  return {
    status: 'imported',
    importedProfile: profileResult.importedItem,
    settings: nextSettings,
    graphicFiles: nextGraphicFiles,
    conflicts: {
      profile: profileResult.conflictPolicy,
      graphics: graphicsResult.conflicts,
      schemas: sourceSchemaResult.conflicts,
      referenceImages: referenceImageResult.conflicts,
    },
  }
}

function importReferenceImages(
  existingItems: ReferenceImageAsset[],
  importedItems: ReferenceImageAsset[],
  conflictPolicy: ProfileImportConflictPolicy,
) {
  const nextItems = [...existingItems]
  const remappedIds = new Map<string, string>()
  const importedResolved: ReferenceImageAsset[] = []

  for (const item of importedItems) {
    const resolution = resolveImportedItem(
      nextItems,
      item,
      conflictPolicy,
    )

    if (resolution.action !== 'preserve') {
      applyImportedItem(nextItems, resolution.item)
    }

    remappedIds.set(item.id, resolution.item.id)
    importedResolved.push(resolution.item)
  }

  return {
    items: nextItems,
    remappedIds,
    importedItems: importedResolved,
    conflicts: importedResolved
      .map((resolved, index) => {
        const original = importedItems[index]
        if (!original || resolved.id === original.id) {
          const existing = existingItems.find((item) => item.id === resolved.id)
          if (!existing || existing.id !== resolved.id) {
            return null
          }
        }

        const existing = existingItems.find((item) => item.id === original?.id)
        if (!original || !existing) {
          return null
        }

        return {
          policy: conflictPolicy,
          existingId: existing.id,
          resolvedId: resolved.id,
        }
      })
      .filter((item): item is { policy: ProfileImportConflictPolicy; existingId: string; resolvedId: string } => item !== null),
  }
}

function importSourceSchemas(
  existingItems: CsvSourceSchemaConfig[],
  importedItems: CsvSourceSchemaConfig[],
  conflictPolicy: ProfileImportConflictPolicy,
) {
  const nextItems = [...existingItems]
  const remappedIds = new Map<string, string>()

  for (const item of importedItems) {
    const resolution = resolveImportedItem(
      nextItems,
      item,
      conflictPolicy,
    )

    if (resolution.action !== 'preserve') {
      applyImportedItem(nextItems, resolution.item)
    }

    remappedIds.set(item.id, resolution.item.id)
  }

  return {
    items: nextItems,
    remappedIds,
    conflicts: importedItems
      .map((original) => {
        const existing = existingItems.find((item) => item.id === original.id)
        if (!existing) {
          return null
        }

        return {
          policy: conflictPolicy,
          existingId: existing.id,
          resolvedId: remappedIds.get(original.id) ?? original.id,
        }
      })
      .filter((item): item is { policy: ProfileImportConflictPolicy; existingId: string; resolvedId: string } => item !== null),
  }
}

function importGraphics(
  existingItems: GraphicInstanceConfig[],
  importedItems: GraphicInstanceConfig[],
  conflictPolicy: ProfileImportConflictPolicy,
) {
  const nextItems = [...existingItems]
  const remappedIds = new Map<string, string>()
  const importedResolved: GraphicInstanceConfig[] = []

  for (const item of importedItems) {
    const resolution = resolveImportedGraphic(nextItems, item, conflictPolicy)

    if (resolution.action !== 'preserve') {
      applyImportedItem(nextItems, resolution.item)
    }

    remappedIds.set(item.id, resolution.item.id)
    importedResolved.push(resolution.item)
  }

  return {
    items: nextItems,
    remappedIds,
    importedItems: importedResolved,
    conflicts: importedItems
      .map((original) => {
        const existing = existingItems.find((item) => item.id === original.id)
        if (!existing) {
          return null
        }

        return {
          policy: conflictPolicy,
          existingId: existing.id,
          resolvedId: remappedIds.get(original.id) ?? original.id,
        }
      })
      .filter((item): item is { policy: ProfileImportConflictPolicy; existingId: string; resolvedId: string } => item !== null),
  }
}

function importProfiles(
  existingItems: ShowProfileConfig[],
  importedItem: ShowProfileConfig,
  conflictPolicy: ProfileImportConflictPolicy,
) {
  const resolution = resolveImportedItem(existingItems, importedItem, conflictPolicy)
  const nextItems = [...existingItems]

  if (resolution.action !== 'preserve') {
    applyImportedItem(nextItems, resolution.item)
  }

  return {
    items: nextItems,
    importedItem: resolution.item,
    conflictPolicy: existingItems.some((item) => item.id === importedItem.id) ? conflictPolicy : null,
  }
}

function resolveImportedGraphic(
  existingItems: GraphicInstanceConfig[],
  importedItem: GraphicInstanceConfig,
  conflictPolicy: ProfileImportConflictPolicy,
) {
  const existingItem = existingItems.find((item) => item.id === importedItem.id)
  if (!existingItem) {
    return {
      action: 'add' as const,
      item: importedItem,
    }
  }

  if (conflictPolicy === 'preserve') {
    return {
      action: 'preserve' as const,
      item: existingItem,
    }
  }

  if (conflictPolicy === 'duplicate') {
    return {
      action: 'duplicate' as const,
      item: duplicateGraphic(importedItem, existingItems.map((item) => item.id)),
    }
  }

  return {
    action: 'replace' as const,
    item: importedItem,
  }
}

function resolveImportedItem<TItem extends { id: string }>(
  existingItems: TItem[],
  importedItem: TItem,
  conflictPolicy: ProfileImportConflictPolicy,
) {
  const existingItem = existingItems.find((item) => item.id === importedItem.id)
  if (!existingItem) {
    return {
      action: 'add' as const,
      item: importedItem,
    }
  }

  if (conflictPolicy === 'preserve') {
    return {
      action: 'preserve' as const,
      item: existingItem,
    }
  }

  if (conflictPolicy === 'duplicate') {
    return {
      action: 'duplicate' as const,
      item: {
        ...importedItem,
        id: createUniqueId(importedItem.id, existingItems.map((item) => item.id)),
      },
    }
  }

  return {
    action: 'replace' as const,
    item: importedItem,
  }
}

function applyImportedItem<TItem extends { id: string }>(items: TItem[], importedItem: TItem): void {
  const index = items.findIndex((item) => item.id === importedItem.id)
  if (index === -1) {
    items.push(importedItem)
    return
  }

  items[index] = importedItem
}

function duplicateGraphic(
  graphic: GraphicInstanceConfig,
  existingIds: string[],
): GraphicInstanceConfig {
  const nextId = createUniqueId(graphic.id, existingIds)
  const nextDataFileName = `${nextId}.json`

  return {
    ...graphic,
    id: nextId,
    dataFileName: nextDataFileName,
    ...(graphic.datasourcePath
      ? {
        datasourcePath: replaceTrailingFileName(graphic.datasourcePath, nextDataFileName),
      }
      : {}),
  }
}

function applyReferenceImageIdRemap(
  graphic: GraphicInstanceConfig,
  remappedIds: Map<string, string>,
): GraphicInstanceConfig {
  const referenceImageId = graphic.preview.background?.referenceImageId
  if (!referenceImageId) {
    return graphic
  }

  const nextReferenceImageId = remappedIds.get(referenceImageId) ?? referenceImageId
  if (nextReferenceImageId === referenceImageId) {
    return graphic
  }

  return {
    ...graphic,
    preview: {
      ...graphic.preview,
      background: {
        ...graphic.preview.background,
        referenceImageId: nextReferenceImageId,
      },
    },
  }
}

function applyProfileRemap(
  profile: ShowProfileConfig,
  remappedIds: {
    sourceSchemaIds: Map<string, string>
    graphicIds: Map<string, string>
  },
): ShowProfileConfig {
  const currentSchemaId = profile.source?.schemaId

  return {
    ...profile,
    ...(profile.source
      ? {
        source: {
          ...profile.source,
          ...(currentSchemaId
            ? {
              schemaId: remappedIds.sourceSchemaIds.get(currentSchemaId) ?? currentSchemaId,
            }
            : {}),
        },
      }
      : {}),
    graphicConfigIds: profile.graphicConfigIds.map((graphicId) => remappedIds.graphicIds.get(graphicId) ?? graphicId),
  }
}

function replaceTrailingFileName(filePath: string, nextFileName: string): string {
  const normalized = filePath.trim()
  if (normalized.length === 0) {
    return nextFileName
  }

  const separators = ['\\', '/']
  const lastSeparatorIndex = Math.max(...separators.map((separator) => normalized.lastIndexOf(separator)))
  if (lastSeparatorIndex === -1) {
    return nextFileName
  }

  return `${normalized.slice(0, lastSeparatorIndex + 1)}${nextFileName}`
}

function createUniqueId(baseId: string, existingIds: string[]): string {
  const knownIds = new Set(existingIds)
  if (!knownIds.has(baseId)) {
    return baseId
  }

  for (let suffix = 2; suffix < Number.MAX_SAFE_INTEGER; suffix += 1) {
    const candidate = `${baseId}-${suffix}`
    if (!knownIds.has(candidate)) {
      return candidate
    }
  }

  throw new Error(`Unable to generate unique id for "${baseId}"`)
}
