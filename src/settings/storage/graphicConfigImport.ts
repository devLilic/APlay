import path from 'node:path'
import type { AppSettings, GraphicInstanceConfig } from '../models/appConfig'
import {
  graphicConfigExportType,
  graphicConfigExportVersion,
  parseGraphicConfigImport,
  serializeGraphicConfigExport,
} from './graphicConfigExport'
import type { GraphicConfigFileMap } from './workspaceConfigRepository'
import { appSettingsSchema } from '../schemas/appConfigSchemas'

export type GraphicConfigIdConflictPolicy = 'replace' | 'preserve' | 'duplicate'

export interface GraphicConfigLibraryImportOptions {
  conflictPolicy?: GraphicConfigIdConflictPolicy
}

export interface GraphicConfigFileLoadDependencies {
  readFile: (filePath: string) => Promise<string>
}

export interface GraphicConfigFileLoadService {
  load: (filePath: string) => Promise<GraphicInstanceConfig>
}

export interface GraphicConfigLibraryImportResult {
  status: 'added' | 'replaced' | 'preserved' | 'duplicated'
  importedGraphic: GraphicInstanceConfig
  settings: AppSettings
  graphicFiles: GraphicConfigFileMap
  conflict: {
    policy: GraphicConfigIdConflictPolicy
    existingGraphicId: string
    resolvedGraphicId: string
  } | null
}

export function createGraphicConfigFileLoadService(
  dependencies: GraphicConfigFileLoadDependencies,
): GraphicConfigFileLoadService {
  return {
    async load(filePath: string): Promise<GraphicInstanceConfig> {
      const rawContent = await dependencies.readFile(filePath)
      return parseGraphicConfigImportContent(rawContent)
    },
  }
}

export function parseGraphicConfigImportContent(rawContent: string): GraphicInstanceConfig {
  const parsedContent = parseGraphicConfigImportJson(rawContent)
  return parseGraphicConfigImport(parsedContent)
}

export function importGraphicConfigToLibrary(
  input: {
    content: string | unknown
    settings: AppSettings
    graphicFiles?: GraphicConfigFileMap
  },
  options: GraphicConfigLibraryImportOptions = {},
): GraphicConfigLibraryImportResult {
  const conflictPolicy = options.conflictPolicy ?? 'replace'
  const importedGraphic = typeof input.content === 'string'
    ? parseGraphicConfigImportContent(input.content)
    : parseGraphicConfigImport(input.content)
  const existingGraphic = input.settings.graphics.find((graphic) => graphic.id === importedGraphic.id)
  const normalizedSettings = appSettingsSchema.parse(input.settings)
  const normalizedGraphicFiles = { ...(input.graphicFiles ?? {}) }

  if (!existingGraphic) {
    const nextSettings = appSettingsSchema.parse({
      ...normalizedSettings,
      graphics: [...normalizedSettings.graphics, importedGraphic],
    })

    return {
      status: 'added',
      importedGraphic,
      settings: nextSettings,
      graphicFiles: {
        ...normalizedGraphicFiles,
        [resolveGraphicConfigFileName(importedGraphic.id)]: serializeGraphicConfigExport(importedGraphic),
      },
      conflict: null,
    }
  }

  if (conflictPolicy === 'preserve') {
    return {
      status: 'preserved',
      importedGraphic: existingGraphic,
      settings: normalizedSettings,
      graphicFiles: normalizedGraphicFiles,
      conflict: {
        policy: conflictPolicy,
        existingGraphicId: existingGraphic.id,
        resolvedGraphicId: existingGraphic.id,
      },
    }
  }

  const resolvedGraphic = conflictPolicy === 'duplicate'
    ? duplicateGraphicConfigWithNewId(importedGraphic, normalizedSettings.graphics)
    : importedGraphic
  const nextGraphics = conflictPolicy === 'replace'
    ? normalizedSettings.graphics.map((graphic) =>
      graphic.id === existingGraphic.id ? resolvedGraphic : graphic)
    : [...normalizedSettings.graphics, resolvedGraphic]
  const nextSettings = appSettingsSchema.parse({
    ...normalizedSettings,
    graphics: nextGraphics,
  })

  return {
    status: conflictPolicy === 'replace' ? 'replaced' : 'duplicated',
    importedGraphic: resolvedGraphic,
    settings: nextSettings,
    graphicFiles: {
      ...normalizedGraphicFiles,
      [resolveGraphicConfigFileName(resolvedGraphic.id)]: serializeGraphicConfigExport(resolvedGraphic),
    },
    conflict: {
      policy: conflictPolicy,
      existingGraphicId: existingGraphic.id,
      resolvedGraphicId: resolvedGraphic.id,
    },
  }
}

function parseGraphicConfigImportJson(rawContent: string): unknown {
  try {
    return JSON.parse(rawContent) as unknown
  } catch (error) {
    throw new Error(
      `Invalid graphic config JSON: ${error instanceof Error ? error.message : 'Unable to parse JSON'}`,
    )
  }
}

function duplicateGraphicConfigWithNewId(
  graphic: GraphicInstanceConfig,
  existingGraphics: GraphicInstanceConfig[],
): GraphicInstanceConfig {
  const nextId = createUniqueGraphicConfigId(graphic.id, existingGraphics.map((item) => item.id))
  const nextDataFileName = `${nextId}.json`

  return {
    ...graphic,
    id: nextId,
    dataFileName: nextDataFileName,
    ...(graphic.datasourcePath
      ? { datasourcePath: replaceDatasourceFileName(graphic.datasourcePath, nextDataFileName) }
      : {}),
  }
}

function createUniqueGraphicConfigId(baseId: string, existingIds: string[]): string {
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

  throw new Error(`Unable to generate unique graphic config id for "${baseId}"`)
}

function replaceDatasourceFileName(datasourcePath: string, nextDataFileName: string): string {
  const normalizedPath = datasourcePath.trim()
  if (normalizedPath.length === 0) {
    return nextDataFileName
  }

  const directory = path.dirname(normalizedPath)
  return directory === '.'
    ? nextDataFileName
    : path.join(directory, nextDataFileName)
}

function resolveGraphicConfigFileName(graphicId: string): string {
  return `${graphicId}.json`
}

export function isGraphicConfigImportEnvelope(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false
  }

  const value = input as Record<string, unknown>
  return value.version === graphicConfigExportVersion
    && value.exportType === graphicConfigExportType
    && 'payload' in value
}
