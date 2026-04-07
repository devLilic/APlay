import type { AppSettings, GraphicInstanceConfig, ShowProfileConfig } from '@/settings/models/appConfig'
import { supportedEntityTypes } from '@/core/entities/entityTypes'
import { parseGraphicConfigImport } from '@/settings/storage/graphicConfigExport'

export interface GraphicConfigStorage {
  read: (fileName: string) => string | null
}

export interface GraphicConfigLoadDiagnostic {
  severity: 'error'
  code: 'missing-graphic-config' | 'invalid-graphic-config'
  message: string
  details: Record<string, unknown>
}

export interface ProfileGraphicConfigLoadResult {
  profile: ShowProfileConfig
  graphics: GraphicInstanceConfig[]
  diagnostics: GraphicConfigLoadDiagnostic[]
}

export interface ProfileGraphicConfigLoader {
  loadForProfile: (settings: AppSettings, profileId: string) => ProfileGraphicConfigLoadResult
}

export function createProfileGraphicConfigLoader(
  storage: GraphicConfigStorage,
): ProfileGraphicConfigLoader {
  return {
    loadForProfile(settings: AppSettings, profileId: string): ProfileGraphicConfigLoadResult {
      const profile = settings.profiles.find((candidate) => candidate.id === profileId)

      if (!profile) {
        throw new Error(`Unknown show profile: ${profileId}`)
      }

      const graphics: GraphicInstanceConfig[] = []
      const diagnostics: GraphicConfigLoadDiagnostic[] = []

      for (const graphicConfigId of profile.graphicConfigIds) {
        const fileName = `${graphicConfigId}.json`
        const content = storage.read(fileName)

        if (content === null) {
          diagnostics.push({
            severity: 'error',
            code: 'missing-graphic-config',
            message: `Graphic config file not found for "${graphicConfigId}"`,
            details: {
              graphicConfigId,
              fileName,
            },
          })
          continue
        }

        try {
          const parsed = JSON.parse(content) as unknown
          const entityTypeReason = resolveEntityTypeValidationReason(parsed)
          if (entityTypeReason) {
            throw new Error(entityTypeReason)
          }
          const graphicConfig = parseGraphicConfigImport(parsed)
          graphics.push(graphicConfig)
        } catch (error) {
          diagnostics.push({
            severity: 'error',
            code: 'invalid-graphic-config',
            message: `Invalid graphic config file for "${graphicConfigId}"`,
            details: {
              graphicConfigId,
              fileName,
              reason: error instanceof Error ? error.message : 'Unknown validation error',
            },
          })
        }
      }

      return {
        profile,
        graphics,
        diagnostics,
      }
    },
  }
}

function resolveEntityTypeValidationReason(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }

  const entityType = (input as Record<string, unknown>).entityType
    ?? ((input as Record<string, unknown>).payload as Record<string, unknown> | undefined)?.entityType
  if (typeof entityType !== 'string') {
    return null
  }

  if (!supportedEntityTypes.includes(entityType as typeof supportedEntityTypes[number])) {
    return `graphicInstanceConfig.entityType must be one of: ${supportedEntityTypes.join(', ')}`
  }

  return null
}

export function createInMemoryGraphicConfigStorage(
  files: Record<string, string>,
): GraphicConfigStorage {
  return {
    read(fileName: string): string | null {
      return files[fileName] ?? null
    },
  }
}
