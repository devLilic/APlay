import type { ActionType } from '@/core/actions/actionTypes'
import { createGraphicsAdapter } from '@/adapters/graphics/graphicsAdapter'
import { createElectronOscClient } from '@/integrations/osc/electronOscClient'
import type { GraphicInstanceConfig, OscArgConfig, OscSettingsConfig } from '@/settings/models/appConfig'
import {
  resolveGraphicControlForSelectedEntity,
  type SelectedEntityControlFeedback,
} from '@/features/workspace/state/selectedEntityControl'
import {
  isStaticPlayableGraphic,
  type SelectedEntityContext,
  type SelectedMultiEntityContext,
} from '@/features/workspace/state/workspaceSelectionState'

const datasourceFiles = new Map<string, string>()
const sentOscAddresses: string[] = []

export type WorkspaceGraphicsAdapter = ReturnType<typeof createWorkspaceGraphicsAdapter>
export type WorkspaceGraphicsAdapterResult = Awaited<ReturnType<WorkspaceGraphicsAdapter['play']>>

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

export function createWorkspaceGraphicsAdapter() {
  return createGraphicsAdapter({
    createOscClient: createWorkspaceOscClient,
    fileWriter: createWorkspaceFileWriter(),
  })
}

export function createWorkspaceOscClient(config: { host: string; port: number }) {
  const oscClient = createElectronOscClient(config)

  return {
    async send(address: string, args: OscArgConfig[]) {
      sentOscAddresses.push(`${config.host}:${config.port}${address}`)
      return await oscClient.send(address, args)
    },
  }
}

export async function runGraphicsAdapterFeedback(
  resultPromise: Promise<WorkspaceGraphicsAdapterResult>,
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

export async function runGraphicsAdapterActionWithAdapter(
  adapter: WorkspaceGraphicsAdapter,
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

export function formatGraphicsAdapterSuccessDetails(
  result: WorkspaceGraphicsAdapterResult,
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

export function doesGraphicRequireDatasource(
  actionType: ActionType,
  graphic: GraphicInstanceConfig,
): boolean {
  return actionType === 'playGraphic' && !isStaticPlayableGraphic(graphic)
}

export function resolveGroupedDatasourceTargetFile(graphic: GraphicInstanceConfig): string {
  const configuredPath = graphic.datasourcePath?.trim()
  if (configuredPath) {
    return configuredPath
  }

  return `datasources/${graphic.dataFileName}`
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
