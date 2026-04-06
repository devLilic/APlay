import type { EditorialDocument } from '@/core/models/editorial'
import type { SelectedEntityContext } from '@/features/workspace/state/workspaceSelectionState'
import { parseCsvEditorialDocument } from '@/adapters/content-source/csvEditorialSource'
import { createOscGraphicOutputAdapter } from '@/adapters/graphic-output/oscGraphicOutput'
import { createJsonDatasourcePublishTargetAdapter } from '@/adapters/publish-target/jsonDatasourcePublishTarget'
import { createInMemoryGraphicConfigStorage, createProfileGraphicConfigLoader } from '@/settings/storage/profileGraphicConfigLoader'
import type { AppSettings, GraphicInstanceConfig } from '@/settings/models/appConfig'
import type { WorkspaceConfigSnapshot } from '@/settings/storage/workspaceConfigRepository'
import { sampleGraphicFiles, sampleSettings } from '@/features/workspace/data/sampleWorkspaceConfig'
import { sampleEditorialCsv } from '@/features/workspace/data/sampleEditorialCsv'
import {
  createSelectedEntityControlOrchestrator,
  createSelectedEntityPreviewData,
  resolveGraphicControlForSelectedEntity,
  type SelectedEntityControlFeedback,
} from '@/features/workspace/state/selectedEntityControl'

export interface WorkspaceShellData {
  document: EditorialDocument
  activeProfileLabel: string
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
  const parsedDocument = parseCsvEditorialDocument(sampleEditorialCsv)
  const profileLoader = createProfileGraphicConfigLoader(
    createInMemoryGraphicConfigStorage(snapshot.graphicFiles),
  )
  const profileResult = profileLoader.loadForProfile(
    snapshot.settings,
    snapshot.settings.selectedProfileId,
  )

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
      settings.graphics.map((graphic) => [`${graphic.id}.json`, JSON.stringify(graphic)]),
    ),
  }
}
