import type { ActionType } from '@/core/actions/actionTypes'
import type { SelectedEntityContext } from '@/features/workspace/state/workspaceSelectionState'
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
  graphicsByEntityType: Partial<Record<string, GraphicInstanceConfig>>
  bindingsByEntityType: Partial<Record<string, FieldBinding[]>>
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
  graphicsByEntityType: Partial<Record<string, GraphicInstanceConfig>>,
  selectedEntity: SelectedEntityContext | undefined,
): GraphicInstanceConfig | undefined {
  if (!selectedEntity) {
    return undefined
  }

  return graphicsByEntityType[entityGroupToEntityType(selectedEntity.entityGroup)]
}

export function createSelectedEntityPreviewData(
  selectedEntity: SelectedEntityContext | undefined,
): Record<string, string | undefined> {
  if (!selectedEntity) {
    return {}
  }

  const entity = selectedEntity.entity as unknown as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(entity).map(([key, value]) => [key, typeof value === 'string' ? value : undefined]),
  )
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

  const entityType = entityGroupToEntityType(selectedEntity.entityGroup)
  const graphic = resolveGraphicControlForSelectedEntity(dependencies.graphicsByEntityType, selectedEntity)
  if (!graphic) {
    return {
      kind: 'error',
      title: 'Graphic unavailable',
      details: [`No graphic configuration is loaded for entity type "${entityType}".`],
    }
  }

  if (actionType === 'playGraphic') {
    const bindings = graphic.bindings ?? dependencies.bindingsByEntityType[entityType] ?? []
    const targetFile = graphic.datasourcePath ?? `datasources/${graphic.dataFileName}`
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
      ...(actionType === 'playGraphic'
        ? [`Datasource updated: ${graphic.datasourcePath ?? `datasources/${graphic.dataFileName}`}`]
        : []),
      `OSC sent: ${outputResult.command.address}`,
    ],
  }
}

function entityGroupToEntityType(group: SelectedEntityContext['entityGroup']) {
  switch (group) {
    case 'titles':
      return 'title'
    case 'supertitles':
      return 'supertitle'
    case 'persons':
      return 'person'
    case 'locations':
      return 'location'
    case 'breakingNews':
      return 'breakingNews'
    case 'waitingTitles':
      return 'waitingTitle'
    case 'waitingLocations':
      return 'waitingLocation'
    case 'phones':
      return 'phone'
  }
}
