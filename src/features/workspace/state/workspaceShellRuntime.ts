import type { EditorialDocument } from '@/core/models/editorial'
import type { SelectedEntityContext } from '@/features/workspace/state/workspaceSelectionState'
import { parseCsvEditorialDocument } from '@/adapters/content-source/csvEditorialSource'
import { createOscGraphicOutputAdapter } from '@/adapters/graphic-output/oscGraphicOutput'
import { createJsonDatasourcePublishTargetAdapter } from '@/adapters/publish-target/jsonDatasourcePublishTarget'
import { createInMemoryGraphicConfigStorage, createProfileGraphicConfigLoader } from '@/settings/storage/profileGraphicConfigLoader'
import { createInMemorySettingsStorage, createSettingsRepository } from '@/settings/storage/settingsRepository'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import { graphicBindingsByEntityType, sampleGraphicFiles, sampleSettings } from '@/features/workspace/data/sampleWorkspaceConfig'
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

const datasourceFiles = new Map<string, string>()
const sentOscAddresses: string[] = []

export const workspaceControlOrchestrator = createSelectedEntityControlOrchestrator({
  graphicsByEntityType: Object.fromEntries(sampleSettings.graphics.map((graphic) => [graphic.entityType, graphic])),
  bindingsByEntityType: graphicBindingsByEntityType,
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
): SelectedEntityControlFeedback {
  switch (actionType) {
    case 'playGraphic':
      return workspaceControlOrchestrator.play(selectedEntity)
    case 'stopGraphic':
      return workspaceControlOrchestrator.stop(selectedEntity)
    case 'resumeGraphic':
      return workspaceControlOrchestrator.resume(selectedEntity)
  }
}
