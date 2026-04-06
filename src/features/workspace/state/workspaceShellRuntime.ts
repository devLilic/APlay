import type { ActionType } from '@/core/actions/actionTypes'
import type { EditorialDocument } from '@/core/models/editorial'
import type { EntityGroupKey, SelectedEntityContext } from '@/features/workspace/state/workspaceSelectionState'
import { parseCsvEditorialDocument } from '@/adapters/content-source/csvEditorialSource'
import { createOscGraphicOutputAdapter } from '@/adapters/graphic-output/oscGraphicOutput'
import { createJsonDatasourcePublishTargetAdapter } from '@/adapters/publish-target/jsonDatasourcePublishTarget'
import { createInMemoryGraphicConfigStorage, createProfileGraphicConfigLoader } from '@/settings/storage/profileGraphicConfigLoader'
import { createInMemorySettingsStorage, createSettingsRepository } from '@/settings/storage/settingsRepository'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import { graphicBindingsByEntityType, sampleGraphicFiles, sampleSettings } from '@/features/workspace/data/sampleWorkspaceConfig'
import { sampleEditorialCsv } from '@/features/workspace/data/sampleEditorialCsv'

export interface WorkspaceShellData {
  document: EditorialDocument
  activeProfileLabel: string
  graphicsByEntityType: Partial<Record<string, GraphicInstanceConfig>>
  diagnostics: string[]
}

export interface WorkspaceActionFeedback {
  kind: 'success' | 'error'
  title: string
  details: string[]
}

const datasourceFiles = new Map<string, string>()
const sentOscAddresses: string[] = []

export function loadWorkspaceShellData(): WorkspaceShellData {
  const parsedDocument = parseCsvEditorialDocument(sampleEditorialCsv)
  const settingsRepository = createSettingsRepository(
    createInMemorySettingsStorage(JSON.stringify(sampleSettings)),
  )
  const settings = settingsRepository.load()
  const profileLoader = createProfileGraphicConfigLoader(
    createInMemoryGraphicConfigStorage(sampleGraphicFiles),
  )
  const profileResult = profileLoader.loadForProfile(settings, settings.selectedProfileId)

  return {
    document: parsedDocument.document,
    activeProfileLabel: profileResult.profile.label,
    graphicsByEntityType: Object.fromEntries(
      profileResult.graphics.map((graphic) => [graphic.entityType, graphic]),
    ),
    diagnostics: [
      ...parsedDocument.diagnostics.map((diagnostic) => diagnostic.message),
      ...profileResult.diagnostics.map((diagnostic) => diagnostic.message),
    ],
  }
}

export function createEntityPreviewContent(
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

export function resolveGraphicForSelection(
  graphicsByEntityType: Partial<Record<string, GraphicInstanceConfig>>,
  selectedEntity: SelectedEntityContext | undefined,
): GraphicInstanceConfig | undefined {
  if (!selectedEntity) {
    return undefined
  }

  return graphicsByEntityType[entityGroupToEntityType(selectedEntity.entityGroup)]
}

export function runWorkspaceGraphicAction(
  actionType: ActionType,
  graphic: GraphicInstanceConfig | undefined,
  selectedEntity: SelectedEntityContext | undefined,
): WorkspaceActionFeedback {
  if (!graphic || !selectedEntity) {
    return {
      kind: 'error',
      title: 'No entity selected',
      details: ['Select an entity before sending commands to LiveBoard.'],
    }
  }

  const publisher = createJsonDatasourcePublishTargetAdapter()
  const output = createOscGraphicOutputAdapter()
  const entityType = entityGroupToEntityType(selectedEntity.entityGroup)
  const bindings = graphicBindingsByEntityType[entityType]

  const publishResult = actionType === 'playGraphic'
    ? publisher.publishEntity(
      {
        entityType,
        entity: selectedEntity.entity as never,
        targetFile: `datasources/${graphic.dataFileName}`,
        bindings,
      },
      {
        write(targetFile, content) {
          datasourceFiles.set(targetFile, content)
        },
      },
    )
    : null

  const outputResult = output.sendForGraphic(
    { actionType, graphic },
    {
      send(command) {
        sentOscAddresses.push(command.address)
      },
    },
  )

  const diagnostics = [
    ...(publishResult?.diagnostics ?? []),
    ...outputResult.diagnostics,
  ]

  if ((publishResult && !publishResult.success) || !outputResult.success) {
    return {
      kind: 'error',
      title: 'Command failed',
      details: diagnostics.map((diagnostic) => diagnostic.message),
    }
  }

  return {
    kind: 'success',
    title: `${actionType} completed`,
    details: [
      ...(publishResult ? [`Datasource updated: datasources/${graphic.dataFileName}`] : []),
      `OSC sent: ${outputResult.command.address}`,
    ],
  }
}

function entityGroupToEntityType(group: EntityGroupKey) {
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
