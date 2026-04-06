import type { EditorialBlock, EditorialDocument } from '@/core/models/editorial'

export const entityGroupKeys = [
  'titles',
  'supertitles',
  'persons',
  'locations',
  'breakingNews',
  'waitingTitles',
  'waitingLocations',
  'phones',
] as const

export type EntityGroupKey = typeof entityGroupKeys[number]

export interface WorkspaceSelection {
  selectedBlockIndex?: number
  selectedEntityGroup?: EntityGroupKey
  selectedEntityIndex?: number
}

export interface GroupedEntityList {
  entityType: EntityGroupKey
  items: EditorialBlock[EntityGroupKey]
}

export interface SelectedEntityContext {
  blockIndex: number
  blockName: string
  entityGroup: EntityGroupKey
  entityIndex: number
  entity: EditorialBlock[EntityGroupKey][number]
}

export interface WorkspaceSelectionStateController {
  document: EditorialDocument
  selection: WorkspaceSelection
  selectBlock: (blockIndex: number) => WorkspaceSelectionStateController
  selectEntityGroup: (entityGroup: EntityGroupKey) => WorkspaceSelectionStateController
  selectEntity: (entityIndex: number) => WorkspaceSelectionStateController
  getSelectedBlock: () => EditorialBlock | undefined
}

export function deriveBlockList(document: EditorialDocument): EditorialBlock[] {
  return document.blocks
}

export function createWorkspaceSelectionState(
  document: EditorialDocument,
  selection: WorkspaceSelection = createInitialSelection(document),
): WorkspaceSelectionStateController {
  const reconciledSelection = reconcileWorkspaceSelection(document, selection)

  return {
    document,
    selection: reconciledSelection,
    selectBlock(blockIndex: number) {
      return createWorkspaceSelectionState(document, {
        selectedBlockIndex: isValidBlockIndex(document, blockIndex) ? blockIndex : undefined,
      })
    },
    selectEntityGroup(entityGroup: EntityGroupKey) {
      if (reconciledSelection.selectedBlockIndex === undefined) {
        return createWorkspaceSelectionState(document, reconciledSelection)
      }

      return createWorkspaceSelectionState(document, {
        selectedBlockIndex: reconciledSelection.selectedBlockIndex,
        selectedEntityGroup: entityGroup,
      })
    },
    selectEntity(entityIndex: number) {
      if (
        reconciledSelection.selectedBlockIndex === undefined ||
        reconciledSelection.selectedEntityGroup === undefined
      ) {
        return createWorkspaceSelectionState(document, reconciledSelection)
      }

      const groupedItems = getGroupItems(
        document,
        reconciledSelection.selectedBlockIndex,
        reconciledSelection.selectedEntityGroup,
      )

      return createWorkspaceSelectionState(document, {
        selectedBlockIndex: reconciledSelection.selectedBlockIndex,
        selectedEntityGroup: reconciledSelection.selectedEntityGroup,
        selectedEntityIndex: isValidEntityIndex(groupedItems, entityIndex) ? entityIndex : undefined,
      })
    },
    getSelectedBlock() {
      return getSelectedBlock(document, reconciledSelection)
    },
  }
}

export function resolveGroupedEntityLists(
  document: EditorialDocument,
  selection: WorkspaceSelection,
): GroupedEntityList[] {
  const block = getSelectedBlock(document, selection)
  if (!block) {
    return []
  }

  return entityGroupKeys.map((entityType) => ({
    entityType,
    items: block[entityType],
  }))
}

export function deriveSelectedEntityContext(
  document: EditorialDocument,
  selection: WorkspaceSelection,
): SelectedEntityContext | undefined {
  const block = getSelectedBlock(document, selection)
  const selectedBlockIndex = selection.selectedBlockIndex
  const selectedEntityGroup = selection.selectedEntityGroup
  const selectedEntityIndex = selection.selectedEntityIndex

  if (
    !block ||
    selectedBlockIndex === undefined ||
    selectedEntityGroup === undefined ||
    selectedEntityIndex === undefined
  ) {
    return undefined
  }

  const entity = block[selectedEntityGroup][selectedEntityIndex]
  if (entity === undefined) {
    return undefined
  }

  return {
    blockIndex: selectedBlockIndex,
    blockName: block.name,
    entityGroup: selectedEntityGroup,
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

  const selectedEntityGroup = selection.selectedEntityGroup
  if (!selectedEntityGroup) {
    return { selectedBlockIndex }
  }

  const groupedItems = getGroupItems(document, selectedBlockIndex, selectedEntityGroup)
  if (!groupedItems) {
    return { selectedBlockIndex }
  }

  const selectedEntityIndex = selection.selectedEntityIndex
  if (selectedEntityIndex === undefined) {
    return {
      selectedBlockIndex,
      selectedEntityGroup,
    }
  }

  if (!isValidEntityIndex(groupedItems, selectedEntityIndex)) {
    return { selectedBlockIndex }
  }

  return {
    selectedBlockIndex,
    selectedEntityGroup,
    selectedEntityIndex,
  }
}

function createInitialSelection(document: EditorialDocument): WorkspaceSelection {
  if (document.blocks.length === 0) {
    return {}
  }

  return {
    selectedBlockIndex: 0,
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

function getGroupItems(
  document: EditorialDocument,
  blockIndex: number,
  entityGroup: EntityGroupKey,
): EditorialBlock[EntityGroupKey] | undefined {
  const block = document.blocks[blockIndex]
  return block?.[entityGroup]
}

function isValidEntityIndex(
  items: unknown[] | undefined,
  entityIndex: number,
): boolean {
  return Array.isArray(items) && Number.isInteger(entityIndex) && entityIndex >= 0 && entityIndex < items.length
}
