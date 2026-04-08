import type { EditorialDocument } from '@/core/models/editorial'
import type { SelectedEntityContext } from '@/features/workspace/state/workspaceSelectionState'
import { createCsvEditorialSourceAdapter } from '@/adapters/content-source/csvEditorialSource'
import { createJsonEditorialSourceAdapter } from '@/adapters/content-source/jsonEditorialSource'
import { createProfileContentSourceLoader } from '@/adapters/content-source/profileContentSourceLoader'
import { createGraphicsAdapter } from '@/adapters/graphics/graphicsAdapter'
import { createInMemoryGraphicConfigStorage, createProfileGraphicConfigLoader } from '@/settings/storage/profileGraphicConfigLoader'
import type { AppSettings, GraphicInstanceConfig, OscSettingsConfig } from '@/settings/models/appConfig'
import type { WorkspaceConfigSnapshot } from '@/settings/storage/workspaceConfigRepository'
import { sampleGraphicFiles, sampleSettings, sampleSourceFiles } from '@/features/workspace/data/sampleWorkspaceConfig'
import {
  createSelectedEntityPreviewData,
  resolveGraphicControlForSelectedEntity,
  type SelectedEntityControlFeedback,
} from '@/features/workspace/state/selectedEntityControl'
import { serializeGraphicConfigExport } from '@/settings/storage/graphicConfigExport'
import type { ActionType } from '@/core/actions/actionTypes'

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

const datasourceFiles = new Map<string, string>()
const sentOscAddresses: string[] = []

export const createEntityPreviewContent = createSelectedEntityPreviewData

export function resolveGraphicForSelection(
  graphicsById: Partial<Record<string, GraphicInstanceConfig>>,
  selectedEntity: SelectedEntityContext | undefined,
): GraphicInstanceConfig | undefined {
  return resolveGraphicControlForSelectedEntity(graphicsById, selectedEntity)
}

export function runWorkspaceGraphicAction(
  actionType: 'playGraphic' | 'stopGraphic' | 'resumeGraphic',
  selectedEntity: SelectedEntityContext | undefined,
  graphicsById: Partial<Record<string, GraphicInstanceConfig>>,
  oscSettings?: OscSettingsConfig,
): Promise<SelectedEntityControlFeedback> {
  return runWorkspaceGraphicsAdapterAction(actionType, selectedEntity, graphicsById, oscSettings)
}

export function runWorkspaceGraphicDebugAction(
  actionType: 'playGraphic' | 'stopGraphic' | 'resumeGraphic',
  graphic: GraphicInstanceConfig,
  oscSettings: OscSettingsConfig | undefined,
  previewContent: Record<string, string | undefined> = {},
): Promise<SelectedEntityControlFeedback> {
  const adapter = createWorkspaceGraphicsAdapter()
  const entityType = graphic.entityType
  const entity = createDebugEntityForGraphic(entityType, previewContent)

  return runGraphicsAdapterFeedback(
    actionType === 'playGraphic'
      ? adapter.play({
        entityType,
        entity: entity as never,
        graphic,
        bindings: graphic.bindings ?? [],
        oscSettings,
      })
      : actionType === 'stopGraphic'
        ? adapter.stop({
          entityType,
          entity: entity as never,
          graphic,
          bindings: graphic.bindings ?? [],
          oscSettings,
        })
        : adapter.resume({
          entityType,
          entity: entity as never,
          graphic,
          bindings: graphic.bindings ?? [],
          oscSettings,
        }),
    actionType,
  )
}

async function runWorkspaceGraphicsAdapterAction(
  actionType: ActionType,
  selectedEntity: SelectedEntityContext | undefined,
  graphicsById: Partial<Record<string, GraphicInstanceConfig>>,
  oscSettings?: OscSettingsConfig,
): Promise<SelectedEntityControlFeedback> {
  if (!selectedEntity) {
    return {
      kind: 'error',
      title: 'No entity selected',
      details: ['Select an entity before sending commands to LiveBoard.'],
    }
  }

  const graphic = resolveGraphicControlForSelectedEntity(graphicsById, selectedEntity)
  if (!graphic) {
    return {
      kind: 'error',
      title: 'Graphic unavailable',
      details: [`No graphic configuration is loaded for "${selectedEntity.graphicConfigId}".`],
    }
  }
  const entityType = graphic.entityType

  const adapter = createWorkspaceGraphicsAdapter()

  return runGraphicsAdapterFeedback(
    actionType === 'playGraphic'
      ? adapter.play({
      entityType,
      entity: selectedEntity.entity as never,
      graphic,
      bindings: graphic.bindings ?? [],
      oscSettings,
    })
      : actionType === 'stopGraphic'
        ? adapter.stop({
        entityType,
        entity: selectedEntity.entity as never,
        graphic,
        bindings: graphic.bindings ?? [],
        oscSettings,
      })
        : adapter.resume({
        entityType,
        entity: selectedEntity.entity as never,
        graphic,
        bindings: graphic.bindings ?? [],
        oscSettings,
      }),
    actionType,
  )
}

async function runGraphicsAdapterFeedback(
  resultPromise: ReturnType<ReturnType<typeof createWorkspaceGraphicsAdapter>['play']>,
  actionType: ActionType,
): Promise<SelectedEntityControlFeedback> {
  const result = await resultPromise
  if (!result.success) {
    return {
      kind: 'error',
      title: actionType === 'playGraphic' && result.diagnostics.some((diagnostic) => diagnostic.code === 'publish-failed' || diagnostic.code === 'missing-bindings')
        ? 'Publish failed'
        : 'Output failed',
      details: result.diagnostics.map((diagnostic) => diagnostic.message),
    }
  }

  return {
    kind: 'success',
    title: `${actionType} completed`,
    details: [
      ...(result.targetFile ? [`Datasource updated: ${result.targetFile}`] : []),
      `OSC sent: ${result.command?.address ?? ''}`,
    ],
  }
}

function createWorkspaceGraphicsAdapter() {
  return createGraphicsAdapter({
    createOscClient(config) {
      return {
        async send(address, args) {
          sentOscAddresses.push(`${config.host}:${config.port}${address}`)
          if (!window.settingsApi?.sendOscMessage) {
            throw new Error('OSC send is unavailable in this environment.')
          }
          await window.settingsApi.sendOscMessage(config.host, config.port, address, args)
        },
      }
    },
    fileWriter: {
      write(targetFile, content) {
        if (window.settingsApi?.writeDatasourceFileSync) {
          window.settingsApi.writeDatasourceFileSync(targetFile, content)
        }

        datasourceFiles.set(targetFile, content)
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

function createDebugEntityForGraphic(
  entityType: GraphicInstanceConfig['entityType'],
  previewContent: Record<string, string | undefined>,
) {
  switch (entityType) {
    case 'title':
      return {
        text: previewContent.text ?? 'Debug title',
      }
    case 'person':
      return {
        name: previewContent.name ?? 'Debug name',
        role: previewContent.role ?? 'Debug role',
      }
    case 'location':
      return {
        value: previewContent.value ?? previewContent.text ?? 'Debug value',
      }
    case 'phone':
      return {
        label: previewContent.label ?? 'Debug label',
        number: previewContent.number ?? '000',
      }
    case 'staticImage':
      return {}
  }
}
