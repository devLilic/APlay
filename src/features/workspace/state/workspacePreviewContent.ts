import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import {
  createSelectedEntityPreviewData,
  resolveGraphicControlForSelectedEntity,
} from '@/features/workspace/state/selectedEntityControl'
import type {
  SelectedEntityContext,
  SelectedMultiEntityContext,
} from '@/features/workspace/state/workspaceSelectionState'

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
