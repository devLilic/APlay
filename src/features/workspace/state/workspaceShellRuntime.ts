import type { EditorialDocument } from '@/core/models/editorial'
import type { SelectedEntityContext } from '@/features/workspace/state/workspaceSelectionState'
import { createCsvEditorialSourceAdapter } from '@/adapters/content-source/csvEditorialSource'
import { createJsonEditorialSourceAdapter } from '@/adapters/content-source/jsonEditorialSource'
import { createProfileContentSourceLoader } from '@/adapters/content-source/profileContentSourceLoader'
import { createOscGraphicOutputAdapter } from '@/adapters/graphic-output/oscGraphicOutput'
import { createJsonDatasourcePublishTargetAdapter } from '@/adapters/publish-target/jsonDatasourcePublishTarget'
import { createInMemoryGraphicConfigStorage, createProfileGraphicConfigLoader } from '@/settings/storage/profileGraphicConfigLoader'
import type { AppSettings, GraphicInstanceConfig } from '@/settings/models/appConfig'
import type { WorkspaceConfigSnapshot } from '@/settings/storage/workspaceConfigRepository'
import { sampleGraphicFiles, sampleSettings, sampleSourceFiles } from '@/features/workspace/data/sampleWorkspaceConfig'
import {
  createSelectedEntityControlOrchestrator,
  createSelectedEntityPreviewData,
  resolveGraphicControlForSelectedEntity,
  type SelectedEntityControlFeedback,
} from '@/features/workspace/state/selectedEntityControl'
import { serializeGraphicConfigExport } from '@/settings/storage/graphicConfigExport'

export interface WorkspaceShellData {
  document: EditorialDocument
  activeProfileLabel: string
  activeSourceFilePath?: string
  graphicsByEntityType: Partial<Record<string, GraphicInstanceConfig>>
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
    graphicsByEntityType: Object.fromEntries(
      profileResult.graphics.map((graphic) => [graphic.entityType, graphic]),
    ),
    diagnostics: [
      ...loadedSource.diagnostics.map((diagnostic) => diagnostic.message),
      ...profileResult.diagnostics.map(formatGraphicConfigDiagnostic),
    ],
  }
}

const datasourceFiles = new Map<string, string>()
const sentOscAddresses: string[] = []

export const createEntityPreviewContent = createSelectedEntityPreviewData

export function resolveGraphicForSelection(
  graphicsByEntityType: Partial<Record<string, GraphicInstanceConfig>>,
  selectedEntity: SelectedEntityContext | undefined,
): GraphicInstanceConfig | undefined {
  return resolveGraphicControlForSelectedEntity(graphicsByEntityType, selectedEntity)
}

export function runWorkspaceGraphicAction(
  actionType: 'playGraphic' | 'stopGraphic' | 'resumeGraphic',
  selectedEntity: SelectedEntityContext | undefined,
  graphicsByEntityType: Partial<Record<string, GraphicInstanceConfig>>,
): SelectedEntityControlFeedback {
  const orchestrator = createWorkspaceControlOrchestrator(graphicsByEntityType)

  switch (actionType) {
    case 'playGraphic':
      return orchestrator.play(selectedEntity)
    case 'stopGraphic':
      return orchestrator.stop(selectedEntity)
    case 'resumeGraphic':
      return orchestrator.resume(selectedEntity)
  }
}

function createWorkspaceControlOrchestrator(
  graphicsByEntityType: Partial<Record<string, GraphicInstanceConfig>>,
) {
  return createSelectedEntityControlOrchestrator({
    graphicsByEntityType,
    bindingsByEntityType: Object.fromEntries(
      Object.entries(graphicsByEntityType).map(([entityType, graphic]) => [
        entityType,
        graphic?.bindings ?? [],
      ]),
    ),
    publishTarget: {
      publishEntity(input) {
        const publisher = createJsonDatasourcePublishTargetAdapter()
        return publisher.publishEntity(input, {
          write(targetFile, content) {
            datasourceFiles.set(targetFile, content)
          },
        })
      },
    },
    graphicOutput: {
      sendForGraphic(input) {
        const output = createOscGraphicOutputAdapter()
        return output.sendForGraphic(input, {
          send(command) {
            sentOscAddresses.push(command.address)
          },
        })
      },
    },
  })
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

function warnWorkspaceRuntime(message: string): void {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[APlay runtime] ${message}`)
  }
}

function formatGraphicConfigDiagnostic(
  diagnostic: ReturnType<typeof loadProfileResult>['diagnostics'][number],
): string {
  const reason = diagnostic.details.reason

  return typeof reason === 'string' && reason.length > 0
    ? `${diagnostic.message}: ${reason}`
    : diagnostic.message
}
