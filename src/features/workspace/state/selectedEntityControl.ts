import type { ActionType } from '@/core/actions/actionTypes'
import {
  isStaticPlayableGraphic,
  type SelectedEntityContext,
} from '@/features/workspace/state/workspaceSelectionState'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import type {
  EntityPublishInput,
  FieldBinding,
} from '@/adapters/publish-target/jsonDatasourcePublishTarget'
import type { OscGraphicActionInput } from '@/adapters/graphic-output/oscGraphicOutput'
import type { PublishTargetPublishResult } from '@/adapters/publish-target/contracts'
import type { GraphicOutputExecutionResult } from '@/adapters/graphic-output/contracts'

export interface SelectedEntityControlFeedback {
  kind: 'success' | 'error'
  title: string
  details: string[]
}

export interface SelectedEntityControlOrchestrator {
  play: (selectedEntity: SelectedEntityContext | undefined) => SelectedEntityControlFeedback
  stop: (selectedEntity: SelectedEntityContext | undefined) => SelectedEntityControlFeedback
  resume: (selectedEntity: SelectedEntityContext | undefined) => SelectedEntityControlFeedback
}

interface SelectedEntityControlDependencies {
  graphicsById: Partial<Record<string, GraphicInstanceConfig>>
  bindingsByGraphicId: Partial<Record<string, FieldBinding[]>>
  publishTarget: {
    publishEntity: (input: EntityPublishInput) => PublishTargetPublishResult
  }
  graphicOutput: {
    sendForGraphic: (input: OscGraphicActionInput) => GraphicOutputExecutionResult
  }
}

export function createSelectedEntityControlOrchestrator(
  dependencies: SelectedEntityControlDependencies,
): SelectedEntityControlOrchestrator {
  return {
    play(selectedEntity) {
      return runAction('playGraphic', selectedEntity, dependencies)
    },
    stop(selectedEntity) {
      return runAction('stopGraphic', selectedEntity, dependencies)
    },
    resume(selectedEntity) {
      return runAction('resumeGraphic', selectedEntity, dependencies)
    },
  }
}

export function resolveGraphicControlForSelectedEntity(
  graphicsById: Partial<Record<string, GraphicInstanceConfig>>,
  selectedEntity: SelectedEntityContext | undefined,
): GraphicInstanceConfig | undefined {
  if (!selectedEntity) {
    return undefined
  }

  return graphicsById[selectedEntity.graphicConfigId]
}

export function createSelectedEntityPreviewData(
  selectedEntity: SelectedEntityContext | undefined,
  graphic?: GraphicInstanceConfig,
): Record<string, string | undefined> {
  if (!selectedEntity) {
    return graphic?.staticAsset?.assetPath
      ? { staticAsset: graphic.staticAsset.assetPath }
      : {}
  }

  const entity = selectedEntity.entity as unknown as Record<string, unknown>
  const previewData = Object.fromEntries(
    Object.entries(entity).map(([key, value]) => [key, typeof value === 'string' ? value : undefined]),
  )

  if (graphic?.staticAsset?.assetPath) {
    return {
      ...previewData,
      staticAsset: graphic.staticAsset.assetPath,
    }
  }

  return previewData
}

function runAction(
  actionType: ActionType,
  selectedEntity: SelectedEntityContext | undefined,
  dependencies: SelectedEntityControlDependencies,
): SelectedEntityControlFeedback {
  if (!selectedEntity) {
    return {
      kind: 'error',
      title: 'No entity selected',
      details: ['Select an entity before sending commands to LiveBoard.'],
    }
  }

  const graphic = resolveGraphicControlForSelectedEntity(dependencies.graphicsById, selectedEntity)
  if (!graphic) {
    return {
      kind: 'error',
      title: 'Graphic unavailable',
      details: [`No graphic configuration is loaded for "${selectedEntity.graphicConfigId}".`],
    }
  }

  const entityType = graphic.entityType

  const bindings = graphic.bindings ?? dependencies.bindingsByGraphicId[graphic.id] ?? []
  const targetFile = resolveDatasourceTargetPath(graphic)
  const requiresDatasource = actionType === 'playGraphic' && !isStaticPlayableGraphic(graphic)

  if (requiresDatasource) {
    if (bindings.length === 0) {
      return {
        kind: 'error',
        title: 'Publish failed',
        details: [`No datasource bindings are configured for graphic "${graphic.id}".`],
      }
    }

    const publishResult = dependencies.publishTarget.publishEntity({
      entityType,
      entity: selectedEntity.entity as never,
      targetFile,
      bindings,
    })

    if (!publishResult.success) {
      return {
        kind: 'error',
        title: 'Publish failed',
        details: publishResult.diagnostics.map((diagnostic) => diagnostic.message),
      }
    }
  }

  const outputResult = dependencies.graphicOutput.sendForGraphic({
    actionType,
    graphic,
  })

  if (!outputResult.success) {
    return {
      kind: 'error',
      title: 'Output failed',
      details: outputResult.diagnostics.map((diagnostic) => diagnostic.message),
    }
  }

  return {
    kind: 'success',
    title: `${actionType} completed`,
    details: [
      ...(requiresDatasource
        ? [`Datasource updated: ${targetFile}`]
        : []),
      `OSC sent: ${outputResult.command.address}`,
    ],
  }
}

function resolveDatasourceTargetPath(graphic: GraphicInstanceConfig): string {
  const configuredPath = graphic.datasourcePath?.trim()
  if (configuredPath) {
    return configuredPath
  }

  return `datasources/${graphic.dataFileName}`
}
