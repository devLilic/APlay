import type { EditorialDocument } from '@/core/models/editorial'
import { createCsvEditorialSourceAdapter } from '@/adapters/content-source/csvEditorialSource'
import { createJsonEditorialSourceAdapter } from '@/adapters/content-source/jsonEditorialSource'
import { createProfileContentSourceLoader } from '@/adapters/content-source/profileContentSourceLoader'
import { createInMemoryGraphicConfigStorage, createProfileGraphicConfigLoader } from '@/settings/storage/profileGraphicConfigLoader'
import type { AppSettings, GraphicInstanceConfig } from '@/settings/models/appConfig'
import type { WorkspaceConfigSnapshot } from '@/settings/storage/workspaceConfigRepository'
import { sampleGraphicFiles, sampleSettings, sampleSourceFiles } from '@/features/workspace/data/sampleWorkspaceConfig'
import { serializeGraphicConfigExport } from '@/settings/storage/graphicConfigExport'
import { formatGraphicConfigDiagnostic, warnWorkspaceRuntime } from '@/features/workspace/state/workspaceDiagnostics'

export interface WorkspaceShellData {
  document: EditorialDocument
  activeProfileLabel: string
  activeSourceFilePath?: string
  graphics: GraphicInstanceConfig[]
  graphicsById: Partial<Record<string, GraphicInstanceConfig>>
  diagnostics: string[]
}

export function createDefaultWorkspaceConfigSnapshot(): WorkspaceConfigSnapshot {
  return {
    settings: sampleSettings,
    graphicFiles: sampleGraphicFiles,
  }
}

export function loadWorkspaceShellData(
  snapshot: WorkspaceConfigSnapshot = createDefaultWorkspaceConfigSnapshot(),
): WorkspaceShellData {
  const sourceLoader = createProfileContentSourceLoader({
    adapters: [
      createCsvEditorialSourceAdapter(),
      createJsonEditorialSourceAdapter(),
    ],
    readSourceFile(filePath) {
      const runtimeSourceContent = typeof window !== 'undefined'
        ? window.settingsApi?.readSourceFileSync?.(filePath)
        : null
      if (typeof runtimeSourceContent === 'string') {
        return runtimeSourceContent
      }

      const sourceContent = sampleSourceFiles[filePath]
      if (sourceContent === undefined) {
        throw new Error(`Source file not found: ${filePath}`)
      }

      return sourceContent
    },
  })
  const loadedSource = sourceLoader.loadActiveProfileSource(snapshot.settings)
  const profileLoader = createProfileGraphicConfigLoader(
    createInMemoryGraphicConfigStorage(snapshot.graphicFiles),
  )
  const profileResult = loadProfileResult(profileLoader, snapshot)

  return {
    document: loadedSource.document,
    activeProfileLabel: profileResult.profile.label,
    activeSourceFilePath: loadedSource.activeSourceFilePath,
    graphics: profileResult.graphics,
    graphicsById: Object.fromEntries(
      profileResult.graphics.map((graphic) => [graphic.id, graphic]),
    ),
    diagnostics: [
      ...loadedSource.diagnostics.map((diagnostic) => diagnostic.message),
      ...profileResult.diagnostics.map(formatGraphicConfigDiagnostic),
    ],
  }
}

export function createWorkspaceSnapshotFromSettings(settings: AppSettings): WorkspaceConfigSnapshot {
  return {
    settings,
    graphicFiles: Object.fromEntries(
      settings.graphics.map((graphic) => [`${graphic.id}.json`, serializeGraphicConfigExport(graphic)]),
    ),
  }
}

function loadProfileResult(
  profileLoader: ReturnType<typeof createProfileGraphicConfigLoader>,
  snapshot: WorkspaceConfigSnapshot,
) {
  try {
    return profileLoader.loadForProfile(
      snapshot.settings,
      snapshot.settings.selectedProfileId,
    )
  } catch (error) {
    const fallbackProfile = snapshot.settings.profiles[0]
    if (!fallbackProfile) {
      throw error
    }

    warnWorkspaceRuntime(
      `Selected profile "${snapshot.settings.selectedProfileId}" is unavailable. Falling back to "${fallbackProfile.id}".`,
    )

    const fallbackResult = profileLoader.loadForProfile(snapshot.settings, fallbackProfile.id)
    return {
      ...fallbackResult,
      diagnostics: [
        {
          severity: 'error' as const,
          code: 'missing-graphic-config' as const,
          message: `Selected profile "${snapshot.settings.selectedProfileId}" is unavailable. Loaded fallback profile "${fallbackProfile.label}".`,
          details: {
            selectedProfileId: snapshot.settings.selectedProfileId,
            fallbackProfileId: fallbackProfile.id,
            reason: error instanceof Error ? error.message : 'Unknown profile loading error',
          },
        },
        ...fallbackResult.diagnostics,
      ],
    }
  }
}
