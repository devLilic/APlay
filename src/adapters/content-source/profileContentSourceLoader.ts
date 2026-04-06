import type { EditorialDocument } from '@/core/models/editorial'
import type {
  ContentSourceAdapter,
  ContentSourceDiagnostic,
  ContentSourceFormat,
} from '@/adapters/content-source/contracts'
import type {
  AppSettings,
  ContentSourceType,
  ShowProfileConfig,
  ShowProfileSourceConfig,
} from '@/settings/models/appConfig'
import { resolveActiveProfileSource } from '@/settings/utils/profileSources'

export type ProfileContentSourceDiagnosticCode =
  | ContentSourceDiagnostic['code']
  | 'missing-source'
  | 'missing-source-file-path'
  | 'invalid-source-file-path'
  | 'unsupported-source-type'
  | 'adapter-failure'
  | 'source-read-failure'

export interface ProfileContentSourceDiagnostic {
  severity: 'warning' | 'error'
  code: ProfileContentSourceDiagnosticCode
  message: string
  details?: Record<string, unknown>
}

export interface ProfileContentSourceLoadResult {
  profile: ShowProfileConfig
  source?: ShowProfileSourceConfig
  activeSourceFilePath?: string
  document: EditorialDocument
  diagnostics: ProfileContentSourceDiagnostic[]
}

export interface ProfileContentSourceLoader {
  loadActiveProfileSource: (settings: AppSettings) => ProfileContentSourceLoadResult
}

export interface ProfileContentSourceLoaderDependencies {
  adapters: ContentSourceAdapter[]
  readSourceFile: (filePath: string) => string
}

export function resolveActiveProfileSourceConfig(settings: AppSettings) {
  return resolveActiveProfileSource(settings)
}

export function resolveContentSourceAdapter(
  adapters: ContentSourceAdapter[],
  sourceType: ContentSourceType | string,
): ContentSourceAdapter | undefined {
  return adapters.find((adapter) => adapter.format === sourceType)
}

export function createProfileContentSourceLoader(
  dependencies: ProfileContentSourceLoaderDependencies,
): ProfileContentSourceLoader {
  return {
    loadActiveProfileSource(settings: AppSettings): ProfileContentSourceLoadResult {
      const sourceResolution = resolveActiveProfileSourceConfig(settings)

      if (!sourceResolution.source) {
        return {
          profile: sourceResolution.profile,
          document: createEmptyEditorialDocument(),
          diagnostics: [
            {
              severity: 'error',
              code: 'missing-source',
              message: `Show profile "${sourceResolution.profile.id}" has no source configured.`,
            },
          ],
        }
      }

      if (!sourceResolution.activeSourceFilePath) {
        return {
          profile: sourceResolution.profile,
          source: sourceResolution.source,
          document: createEmptyEditorialDocument(),
          diagnostics: [
            {
              severity: 'error',
              code: 'missing-source-file-path',
              message: `Show profile "${sourceResolution.profile.id}" has no source file selected.`,
            },
          ],
        }
      }

      if (!isValidSourceFilePath(sourceResolution.activeSourceFilePath, sourceResolution.source.type)) {
        return {
          profile: sourceResolution.profile,
          source: sourceResolution.source,
          activeSourceFilePath: sourceResolution.activeSourceFilePath,
          document: createEmptyEditorialDocument(),
          diagnostics: [
            {
              severity: 'error',
              code: 'invalid-source-file-path',
              message: `Source file path is invalid for profile "${sourceResolution.profile.id}".`,
              details: {
                filePath: sourceResolution.activeSourceFilePath,
                sourceType: sourceResolution.source.type,
              },
            },
          ],
        }
      }

      const adapter = resolveContentSourceAdapter(dependencies.adapters, sourceResolution.source.type)
      if (!adapter) {
        return {
          profile: sourceResolution.profile,
          source: sourceResolution.source,
          activeSourceFilePath: sourceResolution.activeSourceFilePath,
          document: createEmptyEditorialDocument(),
          diagnostics: [
            {
              severity: 'error',
              code: 'unsupported-source-type',
              message: `No content source adapter is registered for source type "${sourceResolution.source.type}".`,
            },
          ],
        }
      }

      try {
        const content = dependencies.readSourceFile(sourceResolution.activeSourceFilePath)

        try {
          const loaded = adapter.load({
            fileName: getFileNameFromPath(sourceResolution.activeSourceFilePath),
            content,
          })

          return {
            profile: sourceResolution.profile,
            source: sourceResolution.source,
            activeSourceFilePath: sourceResolution.activeSourceFilePath,
            document: loaded.document,
            diagnostics: loaded.diagnostics.map((diagnostic) => ({
              severity: diagnostic.severity,
              code: diagnostic.code,
              message: diagnostic.message,
              ...(diagnostic.details ? { details: diagnostic.details } : {}),
            })),
          }
        } catch (error) {
          return {
            profile: sourceResolution.profile,
            source: sourceResolution.source,
            activeSourceFilePath: sourceResolution.activeSourceFilePath,
            document: createEmptyEditorialDocument(),
            diagnostics: [
              {
                severity: 'error',
                code: 'adapter-failure',
                message: `Content source adapter "${adapter.id}" failed to load the active source.`,
                details: {
                  filePath: sourceResolution.activeSourceFilePath,
                  reason: error instanceof Error ? error.message : 'Unknown adapter failure',
                },
              },
            ],
          }
        }
      } catch (error) {
        return {
          profile: sourceResolution.profile,
          source: sourceResolution.source,
          activeSourceFilePath: sourceResolution.activeSourceFilePath,
          document: createEmptyEditorialDocument(),
          diagnostics: [
            {
              severity: 'error',
              code: 'source-read-failure',
              message: `Source file could not be read for profile "${sourceResolution.profile.id}".`,
              details: {
                filePath: sourceResolution.activeSourceFilePath,
                reason: error instanceof Error ? error.message : 'Unknown source read failure',
              },
            },
          ],
        }
      }
    },
  }
}

function createEmptyEditorialDocument(): EditorialDocument {
  return {
    blocks: [],
  }
}

function getFileNameFromPath(filePath: string): string {
  const segments = filePath.split(/[\\/]/)
  return segments[segments.length - 1] ?? filePath
}

function isValidSourceFilePath(
  filePath: string,
  sourceType: ContentSourceFormat | string,
): boolean {
  const normalized = filePath.trim()
  if (normalized.length === 0) {
    return false
  }

  const hasInvalidCharacters = /[<>:"|?*]/.test(normalized.replace(/^[a-zA-Z]:\\/, ''))
  if (hasInvalidCharacters) {
    return false
  }

  switch (sourceType) {
    case 'csv':
      return normalized.toLowerCase().endsWith('.csv')
    case 'json':
      return normalized.toLowerCase().endsWith('.json')
    default:
      return false
  }
}
