import type { AppSettings, GraphicInstanceConfig } from '@/settings/models/appConfig'
import { appSettingsSchema } from '@/settings/schemas/appConfigSchemas'
import { serializeGraphicConfigExport } from '@/settings/storage/graphicConfigExport'
import type { GraphicConfigFileMap } from '@/settings/storage/workspaceConfigRepository'

export interface GraphicConfigLibraryState {
  settings: AppSettings
  graphicFiles: GraphicConfigFileMap
}

export interface GraphicConfigReference {
  profileId: string
  profileLabel: string
}

export interface GraphicConfigLibraryService {
  createGraphicConfig: (
    state: GraphicConfigLibraryState,
    graphic: GraphicInstanceConfig,
  ) => GraphicConfigMutationResult
  updateGraphicConfig: (
    state: GraphicConfigLibraryState,
    graphicId: string,
    updater: (graphic: GraphicInstanceConfig) => GraphicInstanceConfig,
  ) => GraphicConfigMutationResult
  duplicateGraphicConfig: (
    state: GraphicConfigLibraryState,
    graphicId: string,
  ) => GraphicConfigMutationResult
  deleteGraphicConfig: (
    state: GraphicConfigLibraryState,
    graphicId: string,
  ) => GraphicConfigDeleteResult
  attachGraphicConfigToProfile: (
    state: GraphicConfigLibraryState,
    profileId: string,
    graphicId: string,
  ) => GraphicConfigProfileAssignmentResult
  detachGraphicConfigFromProfile: (
    state: GraphicConfigLibraryState,
    profileId: string,
    graphicId: string,
  ) => GraphicConfigProfileAssignmentResult
}

export interface GraphicConfigMutationResult extends GraphicConfigLibraryState {
  status: 'created' | 'updated' | 'duplicated'
  graphic: GraphicInstanceConfig
}

export interface GraphicConfigDeleteResult extends GraphicConfigLibraryState {
  status: 'deleted'
  deletedGraphicId: string
}

export interface GraphicConfigProfileAssignmentResult extends GraphicConfigLibraryState {
  status: 'attached' | 'detached' | 'already-attached' | 'already-detached'
  profileId: string
  graphicId: string
}

export function createGraphicConfigLibraryService(): GraphicConfigLibraryService {
  return {
    createGraphicConfig(state, graphic) {
      const normalized = normalizeState(state)

      if (normalized.settings.graphics.some((item) => item.id === graphic.id)) {
        throw new Error(`Graphic config already exists: ${graphic.id}`)
      }

      const settings = appSettingsSchema.parse({
        ...normalized.settings,
        graphics: [...normalized.settings.graphics, graphic],
      })

      return {
        status: 'created',
        graphic: settings.graphics.find((item) => item.id === graphic.id) as GraphicInstanceConfig,
        settings,
        graphicFiles: createGraphicFileMap(settings.graphics),
      }
    },
    updateGraphicConfig(state, graphicId, updater) {
      const normalized = normalizeState(state)
      const existingGraphic = getGraphicOrThrow(normalized.settings, graphicId)
      const nextGraphic = updater(structuredClone(existingGraphic))

      if (nextGraphic.id !== graphicId && normalized.settings.graphics.some((item) => item.id === nextGraphic.id)) {
        throw new Error(`Graphic config already exists: ${nextGraphic.id}`)
      }

      const nextGraphics = normalized.settings.graphics.map((graphic) =>
        graphic.id === graphicId ? nextGraphic : graphic)
      const settings = appSettingsSchema.parse({
        ...normalized.settings,
        graphics: nextGraphics,
        profiles: normalized.settings.profiles.map((profile) => ({
          ...profile,
          graphicConfigIds: profile.graphicConfigIds.map((id) => id === graphicId ? nextGraphic.id : id),
        })),
      })

      return {
        status: 'updated',
        graphic: settings.graphics.find((item) => item.id === nextGraphic.id) as GraphicInstanceConfig,
        settings,
        graphicFiles: createGraphicFileMap(settings.graphics),
      }
    },
    duplicateGraphicConfig(state, graphicId) {
      const normalized = normalizeState(state)
      const existingGraphic = getGraphicOrThrow(normalized.settings, graphicId)
      const duplicatedGraphic = duplicateGraphicConfig(
        existingGraphic,
        normalized.settings.graphics.map((item) => item.id),
      )
      const settings = appSettingsSchema.parse({
        ...normalized.settings,
        graphics: [...normalized.settings.graphics, duplicatedGraphic],
      })

      return {
        status: 'duplicated',
        graphic: duplicatedGraphic,
        settings,
        graphicFiles: createGraphicFileMap(settings.graphics),
      }
    },
    deleteGraphicConfig(state, graphicId) {
      const normalized = normalizeState(state)
      getGraphicOrThrow(normalized.settings, graphicId)

      const references = findGraphicConfigReferences(normalized.settings, graphicId)
      if (references.length > 0) {
        const profileIds = references.map((reference) => reference.profileId).join(', ')
        throw new Error(`Cannot delete graphic config "${graphicId}" while referenced by profiles: ${profileIds}`)
      }

      const settings = appSettingsSchema.parse({
        ...normalized.settings,
        graphics: normalized.settings.graphics.filter((graphic) => graphic.id !== graphicId),
      })

      return {
        status: 'deleted',
        deletedGraphicId: graphicId,
        settings,
        graphicFiles: createGraphicFileMap(settings.graphics),
      }
    },
    attachGraphicConfigToProfile(state, profileId, graphicId) {
      const normalized = normalizeState(state)
      getGraphicOrThrow(normalized.settings, graphicId)
      const profile = getProfileOrThrow(normalized.settings, profileId)

      if (profile.graphicConfigIds.includes(graphicId)) {
        return {
          status: 'already-attached',
          profileId,
          graphicId,
          settings: normalized.settings,
          graphicFiles: createGraphicFileMap(normalized.settings.graphics),
        }
      }

      const settings = appSettingsSchema.parse({
        ...normalized.settings,
        profiles: normalized.settings.profiles.map((item) =>
          item.id === profileId
            ? {
              ...item,
              graphicConfigIds: [...item.graphicConfigIds, graphicId],
            }
            : item),
      })

      return {
        status: 'attached',
        profileId,
        graphicId,
        settings,
        graphicFiles: createGraphicFileMap(settings.graphics),
      }
    },
    detachGraphicConfigFromProfile(state, profileId, graphicId) {
      const normalized = normalizeState(state)
      const profile = getProfileOrThrow(normalized.settings, profileId)

      if (!profile.graphicConfigIds.includes(graphicId)) {
        return {
          status: 'already-detached',
          profileId,
          graphicId,
          settings: normalized.settings,
          graphicFiles: createGraphicFileMap(normalized.settings.graphics),
        }
      }

      const settings = appSettingsSchema.parse({
        ...normalized.settings,
        profiles: normalized.settings.profiles.map((item) =>
          item.id === profileId
            ? {
              ...item,
              graphicConfigIds: item.graphicConfigIds.filter((id) => id !== graphicId),
            }
            : item),
      })

      return {
        status: 'detached',
        profileId,
        graphicId,
        settings,
        graphicFiles: createGraphicFileMap(settings.graphics),
      }
    },
  }
}

export function findGraphicConfigReferences(
  settings: AppSettings,
  graphicId: string,
): GraphicConfigReference[] {
  return settings.profiles
    .filter((profile) => profile.graphicConfigIds.includes(graphicId))
    .map((profile) => ({
      profileId: profile.id,
      profileLabel: profile.label,
    }))
}

function normalizeState(state: GraphicConfigLibraryState): GraphicConfigLibraryState {
  const settings = appSettingsSchema.parse(state.settings)

  return {
    settings,
    graphicFiles: createGraphicFileMap(settings.graphics),
  }
}

function createGraphicFileMap(graphics: GraphicInstanceConfig[]): GraphicConfigFileMap {
  return Object.fromEntries(
    graphics.map((graphic) => [`${graphic.id}.json`, serializeGraphicConfigExport(graphic)]),
  )
}

function getGraphicOrThrow(settings: AppSettings, graphicId: string): GraphicInstanceConfig {
  const graphic = settings.graphics.find((item) => item.id === graphicId)
  if (!graphic) {
    throw new Error(`Graphic config not found: ${graphicId}`)
  }

  return graphic
}

function getProfileOrThrow(settings: AppSettings, profileId: string) {
  const profile = settings.profiles.find((item) => item.id === profileId)
  if (!profile) {
    throw new Error(`Show profile not found: ${profileId}`)
  }

  return profile
}

function duplicateGraphicConfig(
  graphic: GraphicInstanceConfig,
  existingIds: string[],
): GraphicInstanceConfig {
  const nextId = createUniqueGraphicConfigId(graphic.id, existingIds)
  const nextDataFileName = `${nextId}.json`

  return {
    ...structuredClone(graphic),
    id: nextId,
    name: createDuplicatedGraphicConfigName(graphic.name),
    dataFileName: nextDataFileName,
    preview: {
      ...graphic.preview,
      id: `${graphic.preview.id}-${nextId}`,
    },
    ...(graphic.datasourcePath
      ? { datasourcePath: replaceTrailingFileName(graphic.datasourcePath, nextDataFileName) }
      : {}),
  }
}

function createDuplicatedGraphicConfigName(baseName: string): string {
  const normalized = baseName.trim()
  if (normalized.length === 0) {
    return 'Graphic config copy'
  }

  return normalized.toLowerCase().endsWith(' copy')
    ? normalized
    : `${normalized} copy`
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
