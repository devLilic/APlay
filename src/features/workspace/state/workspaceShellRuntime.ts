import type { EditorialDocument } from '@/core/models/editorial'
import type { SelectedEntityContext, SelectedMultiEntityContext } from '@/features/workspace/state/workspaceSelectionState'
import { createCsvEditorialSourceAdapter } from '@/adapters/content-source/csvEditorialSource'
import { createJsonEditorialSourceAdapter } from '@/adapters/content-source/jsonEditorialSource'
import { createProfileContentSourceLoader } from '@/adapters/content-source/profileContentSourceLoader'
import {
  createGraphicsAdapter,
  publishGraphicsDatasource,
  resolveGraphicsActionCommand,
  resolveGraphicsActionOscTarget,
  resolveGraphicsDatasourceTargetPath,
} from '@/adapters/graphics/graphicsAdapter'
import { createElectronOscClient } from '@/integrations/osc/electronOscClient'
import { createInMemoryGraphicConfigStorage, createProfileGraphicConfigLoader } from '@/settings/storage/profileGraphicConfigLoader'
import type { AppSettings, GraphicInstanceConfig, OscArgConfig, OscSettingsConfig } from '@/settings/models/appConfig'
import type { WorkspaceConfigSnapshot } from '@/settings/storage/workspaceConfigRepository'
import { sampleGraphicFiles, sampleSettings, sampleSourceFiles } from '@/features/workspace/data/sampleWorkspaceConfig'
import {
  createSelectedEntityPreviewData,
  resolveGraphicControlForSelectedEntity,
  type SelectedEntityControlFeedback,
} from '@/features/workspace/state/selectedEntityControl'
import { serializeGraphicConfigExport } from '@/settings/storage/graphicConfigExport'
import type { ActionType } from '@/core/actions/actionTypes'
import { createOscGraphicOutputAdapter } from '@/adapters/graphic-output/oscGraphicOutput'

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

export function createEntityPreviewContent(
  selectedEntity: SelectedEntityContext | SelectedMultiEntityContext | undefined,
  graphic?: GraphicInstanceConfig,
): Record<string, string | undefined> {
  return createSelectedEntityPreviewData(selectedEntity, graphic)
}

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

export async function runWorkspaceMultiGraphicAction(
  actionType: 'playGraphic' | 'stopGraphic' | 'resumeGraphic',
  selectedEntities: SelectedMultiEntityContext[],
  graphicsById: Partial<Record<string, GraphicInstanceConfig>>,
  oscSettings?: OscSettingsConfig,
): Promise<SelectedEntityControlFeedback> {
  if (selectedEntities.length === 0) {
    return {
      kind: 'error',
      title: 'No entities selected',
      details: ['Select at least one item before sending commands to LiveBoard.'],
    }
  }

  if (actionType === 'playGraphic') {
    return await runWorkspaceGroupedPlayAction(selectedEntities, graphicsById, oscSettings)
  }

  const adapter = createWorkspaceGraphicsAdapter()
  const details: string[] = []
  const errors: string[] = []

  for (const selectedEntity of selectedEntities) {
    const graphic = resolveGraphicControlForSelectedEntity(graphicsById, selectedEntity)
    if (!graphic) {
      logGroupedGraphicAction({
        stage: 'missing-config',
        actionType,
        selectedEntity,
        graphicId: selectedEntity.graphicConfigId,
      })
      errors.push(`No graphic configuration is loaded for "${selectedEntity.graphicConfigId}".`)
      continue
    }

    const requiresDatasource = doesGraphicRequireDatasource(actionType, graphic)
    logGroupedGraphicAction({
      stage: requiresDatasource ? 'start' : 'skip',
      actionType,
      selectedEntity,
      graphicId: graphic.id,
      graphicName: graphic.name,
      targetFile: requiresDatasource ? resolveGroupedDatasourceTargetFile(graphic) : undefined,
      reason: requiresDatasource ? undefined : 'static graphic or non-play action',
    })

    const result = await runGraphicsAdapterActionWithAdapter(
      adapter,
      actionType,
      selectedEntity,
      graphic,
      oscSettings,
    )

    if (!result.success) {
      logGroupedGraphicAction({
        stage: 'error',
        actionType,
        selectedEntity,
        graphicId: graphic.id,
        graphicName: graphic.name,
        targetFile: result.targetFile,
        oscAddress: result.command?.address,
        oscArgs: result.command?.args,
        diagnostics: result.diagnostics.map((diagnostic) => diagnostic.message),
      })
      errors.push(...result.diagnostics.map((diagnostic) => `[${graphic.name}] ${diagnostic.message}`))
      continue
    }

    logGroupedGraphicAction({
      stage: 'success',
      actionType,
      selectedEntity,
      graphicId: graphic.id,
      graphicName: graphic.name,
      targetFile: result.targetFile,
      oscAddress: result.command?.address,
      oscArgs: result.command?.args,
    })

    details.push(...formatGraphicsAdapterSuccessDetails(result, actionType, graphic.name))
  }

  if (errors.length > 0) {
    return {
      kind: 'error',
      title: 'Grouped action failed',
      details: [...details, ...errors],
    }
  }

  return {
    kind: 'success',
    title: `${actionType} completed`,
    details,
  }
}

export function runWorkspaceGraphicDebugAction(
  actionType: 'playGraphic' | 'stopGraphic' | 'resumeGraphic',
  graphic: GraphicInstanceConfig,
  oscSettings: OscSettingsConfig | undefined,
  previewContent: Record<string, string | undefined> = {},
): Promise<SelectedEntityControlFeedback> {
  const adapter = createWorkspaceGraphicsAdapter()
  const entityType = graphic.entityType
  const debugEntity = createDebugEntityForGraphic(entityType, previewContent, graphic)

  return runGraphicsAdapterFeedback(
    actionType === 'playGraphic'
      ? adapter.play({
        entityType,
        entity: debugEntity as never,
        graphic,
        bindings: graphic.bindings ?? [],
        oscSettings,
      })
      : actionType === 'stopGraphic'
        ? adapter.stop({
          entityType,
          entity: debugEntity as never,
          graphic,
          bindings: graphic.bindings ?? [],
          oscSettings,
        })
        : adapter.resume({
          entityType,
          entity: debugEntity as never,
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
  const adapter = createWorkspaceGraphicsAdapter()

  return runGraphicsAdapterFeedback(
    runGraphicsAdapterActionWithAdapter(
      adapter,
      actionType,
      selectedEntity,
      graphic,
      oscSettings,
    ),
    actionType,
  )
}

async function runGraphicsAdapterFeedback(
  resultPromise: Promise<Awaited<ReturnType<ReturnType<typeof createWorkspaceGraphicsAdapter>['play']>>>,
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
    details: formatGraphicsAdapterSuccessDetails(result, actionType),
  }
}

async function runGraphicsAdapterActionWithAdapter(
  adapter: ReturnType<typeof createWorkspaceGraphicsAdapter>,
  actionType: ActionType,
  selectedEntity: SelectedEntityContext | SelectedMultiEntityContext,
  graphic: GraphicInstanceConfig,
  oscSettings?: OscSettingsConfig,
) {
  const entityType = graphic.entityType

  return actionType === 'playGraphic'
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
    })
}

interface PreparedGroupedPlayItem {
  selectedEntity: SelectedMultiEntityContext
  graphic: GraphicInstanceConfig
  targetFile?: string
  command: {
    host: string
    port: number
    address: string
    args: OscArgConfig[]
  }
  commandSource: 'local override' | 'global' | 'fallback'
  requiresDatasource: boolean
}

async function runWorkspaceGroupedPlayAction(
  selectedEntities: SelectedMultiEntityContext[],
  graphicsById: Partial<Record<string, GraphicInstanceConfig>>,
  oscSettings?: OscSettingsConfig,
): Promise<SelectedEntityControlFeedback> {
  const details: string[] = []
  const errors: string[] = []

  console.log('GROUPED PLAY', {
    stage: 'start',
    selectedCount: selectedEntities.length,
  })

  const preparedItems = prepareGroupedPlayItems(selectedEntities, graphicsById, oscSettings, errors)
  if (errors.length > 0) {
    return {
      kind: 'error',
      title: 'Grouped action failed',
      details: errors,
    }
  }

  const fileWriter = createWorkspaceFileWriter()
  console.log('GROUPED PLAY', {
    stage: 'datasource-phase-start',
    itemCount: preparedItems.length,
  })

  for (const item of preparedItems) {
    if (!item.requiresDatasource || !item.targetFile) {
      logGroupedGraphicAction({
        stage: 'skip',
        actionType: 'playGraphic',
        selectedEntity: item.selectedEntity,
        graphicId: item.graphic.id,
        graphicName: item.graphic.name,
        reason: 'static graphic or no datasource required',
      })
      continue
    }

    logGroupedGraphicAction({
      stage: 'start',
      actionType: 'playGraphic',
      selectedEntity: item.selectedEntity,
      graphicId: item.graphic.id,
      graphicName: item.graphic.name,
      targetFile: item.targetFile,
      reason: 'datasource write',
    })

    const publishResult = publishGraphicsDatasource(
      {
        entityType: item.graphic.entityType,
        entity: item.selectedEntity.entity as never,
        graphic: item.graphic,
        bindings: item.graphic.bindings ?? [],
        oscSettings,
      },
      fileWriter,
    )

    if (!publishResult.success) {
      logGroupedGraphicAction({
        stage: 'error',
        actionType: 'playGraphic',
        selectedEntity: item.selectedEntity,
        graphicId: item.graphic.id,
        graphicName: item.graphic.name,
        targetFile: publishResult.targetFile,
        diagnostics: publishResult.diagnostics.map((diagnostic) => diagnostic.message),
      })
      errors.push(...publishResult.diagnostics.map((diagnostic) => `[${item.graphic.name}] ${diagnostic.message}`))
      break
    }

    logGroupedGraphicAction({
      stage: 'success',
      actionType: 'playGraphic',
      selectedEntity: item.selectedEntity,
      graphicId: item.graphic.id,
      graphicName: item.graphic.name,
      targetFile: publishResult.targetFile,
    })
    details.push(`[${item.graphic.name}] Datasource updated: ${publishResult.targetFile}`)
  }

  console.log('GROUPED PLAY', {
    stage: 'datasource-phase-end',
    success: errors.length === 0,
  })

  if (errors.length > 0) {
    return {
      kind: 'error',
      title: 'Grouped action failed',
      details: [...details, ...errors],
    }
  }

  console.log('GROUPED PLAY', {
    stage: 'osc-phase-start',
    itemCount: preparedItems.length,
  })

  for (const item of preparedItems) {
    logGroupedGraphicAction({
      stage: 'start',
      actionType: 'playGraphic',
      selectedEntity: item.selectedEntity,
      graphicId: item.graphic.id,
      graphicName: item.graphic.name,
      targetFile: item.targetFile,
      oscAddress: item.command.address,
      oscArgs: item.command.args,
      reason: 'osc send',
    })

    console.log('OSC PLAY RESOLUTION', {
      graphicId: item.graphic.id,
      resolvedTemplateName: item.graphic.control.templateName ?? '',
      commandSource: item.commandSource,
      address: item.command.address,
      args: item.command.args,
      targetFile: item.targetFile,
    })

    try {
      const transportStages = await createWorkspaceOscClient({
        host: item.command.host,
        port: item.command.port,
      }).send(item.command.address, item.command.args)

      logGroupedGraphicAction({
        stage: 'success',
        actionType: 'playGraphic',
        selectedEntity: item.selectedEntity,
        graphicId: item.graphic.id,
        graphicName: item.graphic.name,
        targetFile: item.targetFile,
        oscAddress: item.command.address,
        oscArgs: item.command.args,
      })

      details.push(`[${item.graphic.name}] OSC sent: ${item.command.address}`)
      if (transportStages.length > 0) {
        details.push(`[${item.graphic.name}] OSC transport: ${transportStages.join(' -> ')}`)
      }
      details.push(`[${item.graphic.name}] playGraphic completed`)
    } catch (error) {
      logGroupedGraphicAction({
        stage: 'error',
        actionType: 'playGraphic',
        selectedEntity: item.selectedEntity,
        graphicId: item.graphic.id,
        graphicName: item.graphic.name,
        targetFile: item.targetFile,
        oscAddress: item.command.address,
        oscArgs: item.command.args,
        diagnostics: [error instanceof Error ? error.message : 'Failed to send OSC play command'],
      })
      errors.push(`[${item.graphic.name}] ${error instanceof Error ? error.message : 'Failed to send OSC play command'}`)
    }
  }

  console.log('GROUPED PLAY', {
    stage: 'osc-phase-end',
    success: errors.length === 0,
  })

  if (errors.length > 0) {
    return {
      kind: 'error',
      title: 'Grouped action failed',
      details: [...details, ...errors],
    }
  }

  return {
    kind: 'success',
    title: 'playGraphic completed',
    details,
  }
}

function prepareGroupedPlayItems(
  selectedEntities: SelectedMultiEntityContext[],
  graphicsById: Partial<Record<string, GraphicInstanceConfig>>,
  oscSettings: OscSettingsConfig | undefined,
  errors: string[],
): PreparedGroupedPlayItem[] {
  const preparedItems: PreparedGroupedPlayItem[] = []
  const graphicOutput = createOscGraphicOutputAdapter()

  for (const selectedEntity of selectedEntities) {
    const graphic = resolveGraphicControlForSelectedEntity(graphicsById, selectedEntity)
    if (!graphic) {
      logGroupedGraphicAction({
        stage: 'missing-config',
        actionType: 'playGraphic',
        selectedEntity,
        graphicId: selectedEntity.graphicConfigId,
      })
      errors.push(`No graphic configuration is loaded for "${selectedEntity.graphicConfigId}".`)
      continue
    }

    const actionInput = {
      entityType: graphic.entityType,
      entity: selectedEntity.entity as never,
      graphic,
      bindings: graphic.bindings ?? [],
      oscSettings,
    } as const

    const target = resolveGraphicsActionOscTarget(actionInput)
    if (!target.success) {
      logGroupedGraphicAction({
        stage: 'error',
        actionType: 'playGraphic',
        selectedEntity,
        graphicId: graphic.id,
        graphicName: graphic.name,
        diagnostics: target.diagnostics.map((diagnostic) => diagnostic.message),
      })
      errors.push(...target.diagnostics.map((diagnostic) => `[${graphic.name}] ${diagnostic.message}`))
      continue
    }

    const commandResult = resolveGraphicsActionCommand(actionInput, 'playGraphic', graphicOutput)
    if (!commandResult.success) {
      logGroupedGraphicAction({
        stage: 'error',
        actionType: 'playGraphic',
        selectedEntity,
        graphicId: graphic.id,
        graphicName: graphic.name,
        diagnostics: commandResult.diagnostics.map((diagnostic) => diagnostic.message),
      })
      errors.push(...commandResult.diagnostics.map((diagnostic) => `[${graphic.name}] ${diagnostic.message}`))
      continue
    }

    preparedItems.push({
      selectedEntity,
      graphic,
      targetFile: doesGraphicRequireDatasource('playGraphic', graphic)
        ? resolveGraphicsDatasourceTargetPath(graphic)
        : undefined,
      command: {
        host: target.host,
        port: target.port,
        address: commandResult.command.address,
        args: commandResult.command.args,
      },
      commandSource: commandResult.source,
      requiresDatasource: doesGraphicRequireDatasource('playGraphic', graphic),
    })
  }

  return preparedItems
}

function formatGraphicsAdapterSuccessDetails(
  result: Awaited<ReturnType<ReturnType<typeof createWorkspaceGraphicsAdapter>['play']>>,
  actionType: ActionType,
  graphicName?: string,
): string[] {
  const prefix = graphicName ? `[${graphicName}] ` : ''

  return [
    ...(result.targetFile ? [`${prefix}Datasource updated: ${result.targetFile}`] : []),
    `${prefix}OSC sent: ${result.command?.address ?? ''}`,
    ...(result.transportStages && result.transportStages.length > 0
      ? [`${prefix}OSC transport: ${result.transportStages.join(' -> ')}`]
      : []),
    ...(graphicName ? [`${prefix}${actionType} completed`] : []),
  ]
}

function doesGraphicRequireDatasource(
  actionType: ActionType,
  graphic: GraphicInstanceConfig,
): boolean {
  return actionType === 'playGraphic' && graphic.kind !== 'static' && graphic.entityType !== 'image'
}

function resolveGroupedDatasourceTargetFile(graphic: GraphicInstanceConfig): string {
  const configuredPath = graphic.datasourcePath?.trim()
  if (configuredPath) {
    return configuredPath
  }

  return `datasources/${graphic.dataFileName}`
}

function logGroupedGraphicAction(input: {
  stage: 'start' | 'success' | 'skip' | 'error' | 'missing-config'
  actionType: ActionType
  selectedEntity: SelectedMultiEntityContext
  graphicId: string
  graphicName?: string
  targetFile?: string
  oscAddress?: string
  oscArgs?: unknown[]
  reason?: string
  diagnostics?: string[]
}) {
  console.log('GROUPED GRAPHIC ACTION', {
    stage: input.stage,
    actionType: input.actionType,
    graphicId: input.graphicId,
    graphicName: input.graphicName,
    blockName: input.selectedEntity.blockName,
    entityIndex: input.selectedEntity.entityIndex,
    targetFile: input.targetFile,
    oscAddress: input.oscAddress,
    oscArgs: input.oscArgs,
    reason: input.reason,
    diagnostics: input.diagnostics,
  })
}

function createWorkspaceGraphicsAdapter() {
  return createGraphicsAdapter({
    createOscClient: createWorkspaceOscClient,
    fileWriter: createWorkspaceFileWriter(),
  })
}

function createWorkspaceOscClient(config: { host: string; port: number }) {
  const oscClient = createElectronOscClient(config)

  return {
    async send(address: string, args: OscArgConfig[]) {
      sentOscAddresses.push(`${config.host}:${config.port}${address}`)
      return await oscClient.send(address, args)
    },
  }
}

function createWorkspaceFileWriter() {
  return {
    write(targetFile: string, content: string) {
      if (window.settingsApi?.writeDatasourceFileSync) {
        window.settingsApi.writeDatasourceFileSync(targetFile, content)
      }

      datasourceFiles.set(targetFile, content)
    },
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
  graphic: GraphicInstanceConfig,
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
    case 'image':
      return {
        staticAsset: graphic.staticAsset?.assetPath ?? previewContent.staticAsset,
      }
  }
}
