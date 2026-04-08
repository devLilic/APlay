import type { EditorialBlock, EditorialDocument, GraphicConfigEntityItem } from '@/core/models/editorial'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'

export interface WorkspaceSelection {
  selectedBlockIndex?: number
  selectedGraphicConfigId?: string
  selectedEntityIndex?: number
  selectedItems?: MultiSelectionItem[]
}

export interface MultiSelectionItem {
  graphicConfigId: string
  entityIndex: number
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

export interface SelectedMultiEntityContext extends SelectedEntityContext {}

export interface WorkspaceSelectionStateController {
  document: EditorialDocument
  selection: WorkspaceSelection
  selectBlock: (blockIndex: number) => WorkspaceSelectionStateController
  selectGraphicConfig: (graphicConfigId: string) => WorkspaceSelectionStateController
  selectEntity: (entityIndex: number) => WorkspaceSelectionStateController
  addSelectedItem: (graphicConfigId: string, entityIndex: number) => WorkspaceSelectionStateController
  removeSelectedItem: (graphicConfigId: string, entityIndex: number) => WorkspaceSelectionStateController
  clearSelectedItems: () => WorkspaceSelectionStateController
  isSelected: (graphicConfigId: string, entityIndex: number) => boolean
  selectedCount: () => number
  getSelectedItems: () => SelectedMultiEntityContext[]
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
        selectedItems: [],
      })
    },
    selectGraphicConfig(graphicConfigId: string) {
      if (reconciledSelection.selectedBlockIndex === undefined) {
        return createWorkspaceSelectionState(document, graphics, reconciledSelection)
      }

      return createWorkspaceSelectionState(document, graphics, {
        selectedBlockIndex: reconciledSelection.selectedBlockIndex,
        selectedGraphicConfigId: isKnownGraphicConfig(graphics, graphicConfigId) ? graphicConfigId : undefined,
        selectedItems: reconciledSelection.selectedItems,
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
        selectedItems: reconciledSelection.selectedItems,
      })
    },
    addSelectedItem(graphicConfigId: string, entityIndex: number) {
      if (reconciledSelection.selectedBlockIndex === undefined) {
        return createWorkspaceSelectionState(document, graphics, reconciledSelection)
      }

      const nextSelection = addSelectedItemToSelection(
        document,
        reconciledSelection,
        graphicConfigId,
        entityIndex,
      )

      return createWorkspaceSelectionState(document, graphics, nextSelection)
    },
    removeSelectedItem(graphicConfigId: string, entityIndex: number) {
      return createWorkspaceSelectionState(document, graphics, {
        ...reconciledSelection,
        selectedItems: (reconciledSelection.selectedItems ?? []).filter(
          (item) => item.graphicConfigId !== graphicConfigId || item.entityIndex !== entityIndex,
        ),
      })
    },
    clearSelectedItems() {
      return createWorkspaceSelectionState(document, graphics, {
        ...reconciledSelection,
        selectedItems: [],
      })
    },
    isSelected(graphicConfigId: string, entityIndex: number) {
      return isSelected(reconciledSelection, graphicConfigId, entityIndex)
    },
    selectedCount() {
      return deriveSelectedItemCount(reconciledSelection)
    },
    getSelectedItems() {
      return deriveSelectedMultiEntityContexts(document, reconciledSelection)
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

export function deriveSelectedMultiEntityContexts(
  document: EditorialDocument,
  selection: WorkspaceSelection,
): SelectedMultiEntityContext[] {
  const block = getSelectedBlock(document, selection)
  const selectedBlockIndex = selection.selectedBlockIndex
  const selectedItems = selection.selectedItems ?? []

  if (!block || selectedBlockIndex === undefined) {
    return []
  }

  return selectedItems.flatMap((item) => {
    const entity = block.entityCollections?.[item.graphicConfigId]?.[item.entityIndex]
    if (entity === undefined) {
      return []
    }

    return [{
      blockIndex: selectedBlockIndex,
      blockName: block.name,
      graphicConfigId: item.graphicConfigId,
      entityIndex: item.entityIndex,
      entity,
    }]
  })
}

export function deriveSelectedItemCount(selection: WorkspaceSelection): number {
  return selection.selectedItems?.length ?? 0
}

export function isSelected(
  selection: WorkspaceSelection,
  graphicConfigId: string,
  entityIndex: number,
): boolean {
  return (selection.selectedItems ?? []).some(
    (item) => item.graphicConfigId === graphicConfigId && item.entityIndex === entityIndex,
  )
}

export function reconcileWorkspaceSelection(
  document: EditorialDocument,
  selection: WorkspaceSelection,
): WorkspaceSelection {
  const selectedBlockIndex = reconcileSelectedBlockIndex(document, selection.selectedBlockIndex)
  if (selectedBlockIndex === undefined) {
    return {}
  }

  const selectedItems = reconcileSelectedItems(document, selectedBlockIndex, selection.selectedItems)

  const selectedGraphicConfigId = selection.selectedGraphicConfigId
  if (!selectedGraphicConfigId) {
    return { selectedBlockIndex, selectedItems }
  }

  const groupedItems = getGraphicConfigItems(document, selectedBlockIndex, selectedGraphicConfigId)
  if (!groupedItems) {
    return { selectedBlockIndex, selectedItems }
  }

  const selectedEntityIndex = selection.selectedEntityIndex
  if (selectedEntityIndex === undefined) {
    return {
      selectedBlockIndex,
      selectedGraphicConfigId,
      selectedItems,
    }
  }

  if (!isValidEntityIndex(groupedItems, selectedEntityIndex)) {
    return {
      selectedBlockIndex,
      selectedGraphicConfigId,
      selectedItems,
    }
  }

  return {
    selectedBlockIndex,
    selectedGraphicConfigId,
    selectedEntityIndex,
    selectedItems,
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
    selectedItems: [],
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

function addSelectedItemToSelection(
  document: EditorialDocument,
  selection: WorkspaceSelection,
  graphicConfigId: string,
  entityIndex: number,
): WorkspaceSelection {
  const selectedBlockIndex = selection.selectedBlockIndex
  if (selectedBlockIndex === undefined) {
    return selection
  }

  const groupedItems = getGraphicConfigItems(document, selectedBlockIndex, graphicConfigId)
  if (!isValidEntityIndex(groupedItems, entityIndex)) {
    return selection
  }

  if (isSelected(selection, graphicConfigId, entityIndex)) {
    return selection
  }

  return {
    ...selection,
    selectedItems: [
      ...(selection.selectedItems ?? []),
      { graphicConfigId, entityIndex },
    ],
  }
}

function reconcileSelectedItems(
  document: EditorialDocument,
  selectedBlockIndex: number,
  selectedItems: MultiSelectionItem[] | undefined,
): MultiSelectionItem[] {
  if (!selectedItems || selectedItems.length === 0) {
    return []
  }

  return selectedItems.filter((item) => {
    const groupedItems = getGraphicConfigItems(document, selectedBlockIndex, item.graphicConfigId)
    return isValidEntityIndex(groupedItems, item.entityIndex)
  })
}

function isValidEntityIndex(
  items: unknown[] | undefined,
  entityIndex: number,
): boolean {
  return Array.isArray(items) && Number.isInteger(entityIndex) && entityIndex >= 0 && entityIndex < items.length
}
