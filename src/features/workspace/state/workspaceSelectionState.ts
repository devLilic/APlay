import type { EditorialBlock, EditorialDocument, GraphicConfigEntityItem } from '@/core/models/editorial'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'

export interface WorkspaceSelection {
  selectedBlockIndex?: number
  selectedGraphicConfigId?: string
  selectedEntityIndex?: number
}

export interface GraphicConfigEntityList {
  graphicConfigId: string
  graphic: GraphicInstanceConfig
  items: GraphicConfigEntityItem[]
}

export interface SelectedEntityContext {
  blockIndex: number
  blockName: string
  graphicConfigId: string
  entityIndex: number
  entity: GraphicConfigEntityItem
}

export interface WorkspaceSelectionStateController {
  document: EditorialDocument
  selection: WorkspaceSelection
  selectBlock: (blockIndex: number) => WorkspaceSelectionStateController
  selectGraphicConfig: (graphicConfigId: string) => WorkspaceSelectionStateController
  selectEntity: (entityIndex: number) => WorkspaceSelectionStateController
  getSelectedBlock: () => EditorialBlock | undefined
}

export function deriveBlockList(document: EditorialDocument): EditorialBlock[] {
  return document.blocks
}

export function createWorkspaceSelectionState(
  document: EditorialDocument,
  graphics: GraphicInstanceConfig[],
  selection: WorkspaceSelection = createInitialSelection(document, graphics),
): WorkspaceSelectionStateController {
  const reconciledSelection = reconcileWorkspaceSelection(document, selection)

  return {
    document,
    selection: reconciledSelection,
    selectBlock(blockIndex: number) {
      return createWorkspaceSelectionState(document, graphics, {
        selectedBlockIndex: isValidBlockIndex(document, blockIndex) ? blockIndex : undefined,
      })
    },
    selectGraphicConfig(graphicConfigId: string) {
      if (reconciledSelection.selectedBlockIndex === undefined) {
        return createWorkspaceSelectionState(document, graphics, reconciledSelection)
      }

      return createWorkspaceSelectionState(document, graphics, {
        selectedBlockIndex: reconciledSelection.selectedBlockIndex,
        selectedGraphicConfigId: isKnownGraphicConfig(graphics, graphicConfigId) ? graphicConfigId : undefined,
      })
    },
    selectEntity(entityIndex: number) {
      if (
        reconciledSelection.selectedBlockIndex === undefined ||
        reconciledSelection.selectedGraphicConfigId === undefined
      ) {
        return createWorkspaceSelectionState(document, graphics, reconciledSelection)
      }

      const groupedItems = getGraphicConfigItems(
        document,
        reconciledSelection.selectedBlockIndex,
        reconciledSelection.selectedGraphicConfigId,
      )

      return createWorkspaceSelectionState(document, graphics, {
        selectedBlockIndex: reconciledSelection.selectedBlockIndex,
        selectedGraphicConfigId: reconciledSelection.selectedGraphicConfigId,
        selectedEntityIndex: isValidEntityIndex(groupedItems, entityIndex) ? entityIndex : undefined,
      })
    },
    getSelectedBlock() {
      return getSelectedBlock(document, reconciledSelection)
    },
  }
}

export function resolveGraphicConfigEntityLists(
  document: EditorialDocument,
  selection: WorkspaceSelection,
  graphics: GraphicInstanceConfig[],
): GraphicConfigEntityList[] {
  const block = getSelectedBlock(document, selection)
  if (!block) {
    return []
  }

  const collections = block.entityCollections ?? {}

  return graphics
    .filter((graphic) => graphic.kind !== 'static' && graphic.entityType !== 'staticImage')
    .map((graphic) => ({
      graphicConfigId: graphic.id,
      graphic,
      items: collections[graphic.id] ?? [],
    }))
}

export function deriveSelectedEntityContext(
  document: EditorialDocument,
  selection: WorkspaceSelection,
): SelectedEntityContext | undefined {
  const block = getSelectedBlock(document, selection)
  const selectedBlockIndex = selection.selectedBlockIndex
  const selectedGraphicConfigId = selection.selectedGraphicConfigId
  const selectedEntityIndex = selection.selectedEntityIndex

  if (
    !block ||
    selectedBlockIndex === undefined ||
    selectedGraphicConfigId === undefined ||
    selectedEntityIndex === undefined
  ) {
    return undefined
  }

  const entity = block.entityCollections?.[selectedGraphicConfigId]?.[selectedEntityIndex]
  if (entity === undefined) {
    return undefined
  }

  return {
    blockIndex: selectedBlockIndex,
    blockName: block.name,
    graphicConfigId: selectedGraphicConfigId,
    entityIndex: selectedEntityIndex,
    entity,
  }
}

export function reconcileWorkspaceSelection(
  document: EditorialDocument,
  selection: WorkspaceSelection,
): WorkspaceSelection {
  const selectedBlockIndex = reconcileSelectedBlockIndex(document, selection.selectedBlockIndex)
  if (selectedBlockIndex === undefined) {
    return {}
  }

  const selectedGraphicConfigId = selection.selectedGraphicConfigId
  if (!selectedGraphicConfigId) {
    return { selectedBlockIndex }
  }

  const groupedItems = getGraphicConfigItems(document, selectedBlockIndex, selectedGraphicConfigId)
  if (!groupedItems) {
    return { selectedBlockIndex }
  }

  const selectedEntityIndex = selection.selectedEntityIndex
  if (selectedEntityIndex === undefined) {
    return {
      selectedBlockIndex,
      selectedGraphicConfigId,
    }
  }

  if (!isValidEntityIndex(groupedItems, selectedEntityIndex)) {
    return {
      selectedBlockIndex,
      selectedGraphicConfigId,
    }
  }

  return {
    selectedBlockIndex,
    selectedGraphicConfigId,
    selectedEntityIndex,
  }
}

function createInitialSelection(
  document: EditorialDocument,
  graphics: GraphicInstanceConfig[],
): WorkspaceSelection {
  if (document.blocks.length === 0) {
    return {}
  }

  const firstGraphicConfigId = graphics.find((graphic) => graphic.kind !== 'static' && graphic.entityType !== 'staticImage')?.id

  return {
    selectedBlockIndex: 0,
    ...(firstGraphicConfigId ? { selectedGraphicConfigId: firstGraphicConfigId } : {}),
  }
}

function getSelectedBlock(
  document: EditorialDocument,
  selection: WorkspaceSelection,
): EditorialBlock | undefined {
  if (selection.selectedBlockIndex === undefined) {
    return undefined
  }

  return document.blocks[selection.selectedBlockIndex]
}

function reconcileSelectedBlockIndex(
  document: EditorialDocument,
  selectedBlockIndex: number | undefined,
): number | undefined {
  if (selectedBlockIndex !== undefined && isValidBlockIndex(document, selectedBlockIndex)) {
    return selectedBlockIndex
  }

  return document.blocks.length > 0 ? 0 : undefined
}

function isValidBlockIndex(document: EditorialDocument, blockIndex: number): boolean {
  return Number.isInteger(blockIndex) && blockIndex >= 0 && blockIndex < document.blocks.length
}

function isKnownGraphicConfig(graphics: GraphicInstanceConfig[], graphicConfigId: string): boolean {
  return graphics.some((graphic) => graphic.id === graphicConfigId)
}

function getGraphicConfigItems(
  document: EditorialDocument,
  blockIndex: number,
  graphicConfigId: string,
): GraphicConfigEntityItem[] | undefined {
  const block = document.blocks[blockIndex]
  return block?.entityCollections?.[graphicConfigId]
}

function isValidEntityIndex(
  items: unknown[] | undefined,
  entityIndex: number,
): boolean {
  return Array.isArray(items) && Number.isInteger(entityIndex) && entityIndex >= 0 && entityIndex < items.length
}
