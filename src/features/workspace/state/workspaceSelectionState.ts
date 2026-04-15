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

export type StaticPlayableGraphicItem = GraphicConfigEntityItem & {
  staticPlayableGraphicName: string
  staticAsset?: string
}

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
  getSelectedItemForGroup: (graphicConfigId: string) => SelectedMultiEntityContext | undefined
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
  const reconciledSelection = reconcileWorkspaceSelection(document, selection, graphics)

  return {
    document,
    selection: reconciledSelection,
    selectBlock(blockIndex: number) {
      return createWorkspaceSelectionState(document, graphics, {
        selectedBlockIndex: isValidBlockIndex(document, graphics, blockIndex) ? blockIndex : undefined,
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
        graphics,
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
        graphics,
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
      return deriveSelectedMultiEntityContexts(document, reconciledSelection, graphics)
    },
    getSelectedItemForGroup(graphicConfigId: string) {
      return getSelectedItemForGroup(document, reconciledSelection, graphics, graphicConfigId)
    },
    getSelectedBlock() {
      return getSelectedBlock(document, reconciledSelection, graphics)
    },
  }
}

export function resolveGraphicConfigEntityLists(
  document: EditorialDocument,
  selection: WorkspaceSelection,
  graphics: GraphicInstanceConfig[],
): GraphicConfigEntityList[] {
  const block = getSelectedBlock(document, selection, graphics)
  if (!block) {
    return []
  }

  return graphics
    .filter((graphic) => !isNonCollectionGraphic(graphic))
    .map((graphic) => ({
      graphicConfigId: graphic.id,
      graphic,
      items: resolveGraphicCollectionItems(block, graphic),
    }))
}

export function deriveSelectedEntityContext(
  document: EditorialDocument,
  selection: WorkspaceSelection,
  graphics: GraphicInstanceConfig[] = [],
): SelectedEntityContext | undefined {
  const block = getSelectedBlock(document, selection, graphics)
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

  const graphic = graphics.find((item) => item.id === selectedGraphicConfigId)
  const entity = resolveGraphicCollectionItems(block, graphic)?.[selectedEntityIndex]
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
  graphics: GraphicInstanceConfig[] = [],
): SelectedMultiEntityContext[] {
  const block = getSelectedBlock(document, selection, graphics)
  const selectedBlockIndex = selection.selectedBlockIndex
  const selectedItems = selection.selectedItems ?? []

  if (!block || selectedBlockIndex === undefined) {
    return []
  }

  return selectedItems.flatMap((item) => {
    const graphic = graphics.find((currentGraphic) => currentGraphic.id === item.graphicConfigId)
    const entity = resolveGraphicCollectionItems(block, graphic)?.[item.entityIndex]
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

export function deriveSelectedItemForGroup(
  document: EditorialDocument,
  selection: WorkspaceSelection,
  graphics: GraphicInstanceConfig[],
  graphicConfigId: string,
): SelectedMultiEntityContext | undefined {
  return getSelectedItemForGroup(document, selection, graphics, graphicConfigId)
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
  graphics: GraphicInstanceConfig[] = [],
): WorkspaceSelection {
  const selectedBlockIndex = reconcileSelectedBlockIndex(document, graphics, selection.selectedBlockIndex)
  if (selectedBlockIndex === undefined) {
    return {}
  }

  const selectedItems = reconcileSelectedItems(document, graphics, selectedBlockIndex, selection.selectedItems)

  const selectedGraphicConfigId = selection.selectedGraphicConfigId
  if (!selectedGraphicConfigId) {
    return { selectedBlockIndex, selectedItems }
  }

  const groupedItems = getGraphicConfigItems(document, graphics, selectedBlockIndex, selectedGraphicConfigId)
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
  const workspaceBlocks = resolveWorkspaceBlocks(document, graphics)
  if (workspaceBlocks.length === 0) {
    return {}
  }

  const firstGraphicConfigId = graphics.find((graphic) => !isNonCollectionGraphic(graphic))?.id

  return {
    selectedBlockIndex: 0,
    ...(firstGraphicConfigId ? { selectedGraphicConfigId: firstGraphicConfigId } : {}),
    selectedItems: [],
  }
}

function getSelectedBlock(
  document: EditorialDocument,
  selection: WorkspaceSelection,
  graphics: GraphicInstanceConfig[] = [],
): EditorialBlock | undefined {
  if (selection.selectedBlockIndex === undefined) {
    return undefined
  }

  return resolveWorkspaceBlocks(document, graphics)[selection.selectedBlockIndex]
}

function reconcileSelectedBlockIndex(
  document: EditorialDocument,
  graphics: GraphicInstanceConfig[],
  selectedBlockIndex: number | undefined,
): number | undefined {
  if (selectedBlockIndex !== undefined && isValidBlockIndex(document, graphics, selectedBlockIndex)) {
    return selectedBlockIndex
  }

  return resolveWorkspaceBlocks(document, graphics).length > 0 ? 0 : undefined
}

function isValidBlockIndex(document: EditorialDocument, graphics: GraphicInstanceConfig[], blockIndex: number): boolean {
  return Number.isInteger(blockIndex) && blockIndex >= 0 && blockIndex < resolveWorkspaceBlocks(document, graphics).length
}

function isKnownGraphicConfig(graphics: GraphicInstanceConfig[], graphicConfigId: string): boolean {
  return graphics.some((graphic) => graphic.id === graphicConfigId)
}

function getGraphicConfigItems(
  document: EditorialDocument,
  graphics: GraphicInstanceConfig[],
  blockIndex: number,
  graphicConfigId: string,
): GraphicConfigEntityItem[] | undefined {
  const block = resolveWorkspaceBlocks(document, graphics)[blockIndex]
  const graphic = graphics.find((item) => item.id === graphicConfigId)
  return block && graphic
    ? resolveGraphicCollectionItems(block, graphic)
    : block?.entityCollections?.[graphicConfigId]
}

function addSelectedItemToSelection(
  document: EditorialDocument,
  graphics: GraphicInstanceConfig[],
  selection: WorkspaceSelection,
  graphicConfigId: string,
  entityIndex: number,
): WorkspaceSelection {
  const selectedBlockIndex = selection.selectedBlockIndex
  if (selectedBlockIndex === undefined) {
    return selection
  }

  const groupedItems = getGraphicConfigItems(document, graphics, selectedBlockIndex, graphicConfigId)
  if (!isValidEntityIndex(groupedItems, entityIndex)) {
    return selection
  }

  if (isSelected(selection, graphicConfigId, entityIndex)) {
    return selection
  }

  return {
    ...selection,
    selectedItems: [
      ...(selection.selectedItems ?? []).filter((item) => item.graphicConfigId !== graphicConfigId),
      { graphicConfigId, entityIndex },
    ],
  }
}

function reconcileSelectedItems(
  document: EditorialDocument,
  graphics: GraphicInstanceConfig[],
  selectedBlockIndex: number,
  selectedItems: MultiSelectionItem[] | undefined,
): MultiSelectionItem[] {
  if (!selectedItems || selectedItems.length === 0) {
    return []
  }

  const nextItems: MultiSelectionItem[] = []

  for (const item of selectedItems) {
    const groupedItems = getGraphicConfigItems(document, graphics, selectedBlockIndex, item.graphicConfigId)
    if (!isValidEntityIndex(groupedItems, item.entityIndex)) {
      continue
    }

    const existingIndex = nextItems.findIndex((current) => current.graphicConfigId === item.graphicConfigId)
    if (existingIndex >= 0) {
      nextItems[existingIndex] = item
      continue
    }

    nextItems.push(item)
  }

  return nextItems
}

function getSelectedItemForGroup(
  document: EditorialDocument,
  selection: WorkspaceSelection,
  graphics: GraphicInstanceConfig[],
  graphicConfigId: string,
): SelectedMultiEntityContext | undefined {
  const block = getSelectedBlock(document, selection, graphics)
  const selectedBlockIndex = selection.selectedBlockIndex
  const selectedItem = (selection.selectedItems ?? []).find((item) => item.graphicConfigId === graphicConfigId)

  if (!block || selectedBlockIndex === undefined || !selectedItem) {
    return undefined
  }

  const graphic = graphics.find((item) => item.id === graphicConfigId)
  const entity = resolveGraphicCollectionItems(block, graphic)?.[selectedItem.entityIndex]
  if (entity === undefined) {
    return undefined
  }

  return {
    blockIndex: selectedBlockIndex,
    blockName: block.name,
    graphicConfigId,
    entityIndex: selectedItem.entityIndex,
    entity,
  }
}

function resolveGraphicCollectionItems(
  block: EditorialBlock,
  graphic: GraphicInstanceConfig | undefined,
): GraphicConfigEntityItem[] {
  if (!graphic) {
    return []
  }

  const dynamicItems = block.entityCollections?.[graphic.id]
  if (Array.isArray(dynamicItems)) {
    return dynamicItems
  }

  if (!isStaticPlayableGraphic(graphic)) {
    return []
  }

  return [createStaticPlayableGraphicItem(graphic)]
}

function isNonCollectionGraphic(graphic: GraphicInstanceConfig): boolean {
  return !isStaticPlayableGraphic(graphic) && graphic.entityType === 'image'
}

export function isStaticPlayableGraphic(graphic: Pick<GraphicInstanceConfig, 'kind' | 'entityType' | 'staticAsset'>): boolean {
  return graphic.kind === 'static' || graphic.entityType === 'image' || graphic.staticAsset !== undefined
}

export function createStaticPlayableGraphicItem(
  graphic: Pick<GraphicInstanceConfig, 'name' | 'staticAsset'>,
): StaticPlayableGraphicItem {
  return {
    staticPlayableGraphicName: graphic.name,
    ...(graphic.staticAsset?.assetPath ? { staticAsset: graphic.staticAsset.assetPath } : {}),
  }
}

function isValidEntityIndex(
  items: unknown[] | undefined,
  entityIndex: number,
): boolean {
  return Array.isArray(items) && Number.isInteger(entityIndex) && entityIndex >= 0 && entityIndex < items.length
}

function resolveWorkspaceBlocks(
  document: EditorialDocument,
  graphics: GraphicInstanceConfig[],
): EditorialBlock[] {
  if (document.blocks.length > 0) {
    return document.blocks
  }

  const staticGraphics = graphics.filter(isStaticPlayableGraphic)
  if (staticGraphics.length === 0) {
    return []
  }

  return [createStaticWorkspaceBlock(staticGraphics)]
}

function createStaticWorkspaceBlock(
  graphics: GraphicInstanceConfig[],
): EditorialBlock {
  return {
    name: 'Static graphics',
    titles: [],
    persons: [],
    locations: [],
    phones: [],
    entityCollections: Object.fromEntries(
      graphics.map((graphic) => [graphic.id, [createStaticPlayableGraphicItem(graphic)]]),
    ),
  }
}
