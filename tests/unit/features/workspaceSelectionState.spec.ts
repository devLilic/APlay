import { describe, expect, it } from 'vitest'
import type { EditorialDocument } from '@/core/models/editorial'
import {
  createWorkspaceSelectionState,
  deriveSelectedEntityContext,
  reconcileWorkspaceSelection,
  resolveGroupedEntityLists,
} from '@/features/workspace/state/workspaceSelectionState'

const documentFixture: EditorialDocument = {
  blocks: [
    {
      name: 'Opening',
      titles: [{ id: 'title-1', number: '1', text: 'Title One' }, { id: 'title-2', number: '2', text: 'Title Two' }],
      supertitles: [{ text: 'Super One' }],
      persons: [{ name: 'Jane Doe', role: 'Anchor' }],
      locations: [{ value: 'Chisinau' }],
      breakingNews: [{ value: 'Breaking One' }],
      waitingTitles: [],
      waitingLocations: [],
      phones: [{ label: 'Desk', number: '111' }],
    },
    {
      name: 'Closing',
      titles: [],
      supertitles: [],
      persons: [{ name: 'John Smith' }],
      locations: [],
      breakingNews: [],
      waitingTitles: [{ value: 'Stand by' }],
      waitingLocations: [{ value: 'Studio B' }],
      phones: [],
    },
  ],
}

describe('block selection', () => {
  it('selects a block from the left panel by index', () => {
    const state = createWorkspaceSelectionState(documentFixture)
    const next = state.selectBlock(1)

    expect(next.selection.selectedBlockIndex).toBe(1)
    expect(next.getSelectedBlock()?.name).toBe('Closing')
  })

  it('clears selected entity when the block changes', () => {
    const state = createWorkspaceSelectionState(documentFixture)
      .selectEntityGroup('titles')
      .selectEntity(1)

    const next = state.selectBlock(1)

    expect(next.selection.selectedEntityGroup).toBeUndefined()
    expect(next.selection.selectedEntityIndex).toBeUndefined()
  })
})

describe('grouped entity lists', () => {
  it('resolves grouped entity lists for the selected block', () => {
    const state = createWorkspaceSelectionState(documentFixture)
    const groupedLists = resolveGroupedEntityLists(state.document, state.selection)

    expect(groupedLists).toEqual([
      { entityType: 'titles', items: [{ id: 'title-1', number: '1', text: 'Title One' }, { id: 'title-2', number: '2', text: 'Title Two' }] },
      { entityType: 'supertitles', items: [{ text: 'Super One' }] },
      { entityType: 'persons', items: [{ name: 'Jane Doe', role: 'Anchor' }] },
      { entityType: 'locations', items: [{ value: 'Chisinau' }] },
      { entityType: 'breakingNews', items: [{ value: 'Breaking One' }] },
      { entityType: 'waitingTitles', items: [] },
      { entityType: 'waitingLocations', items: [] },
      { entityType: 'phones', items: [{ label: 'Desk', number: '111' }] },
    ])
  })

  it('selects an entity type group from the middle panel', () => {
    const state = createWorkspaceSelectionState(documentFixture)
    const next = state.selectEntityGroup('persons')

    expect(next.selection.selectedEntityGroup).toBe('persons')
    expect(next.selection.selectedEntityIndex).toBeUndefined()
  })

  it('selects a specific entity by index inside the active group', () => {
    const state = createWorkspaceSelectionState(documentFixture)
      .selectEntityGroup('titles')
      .selectEntity(1)

    expect(state.selection.selectedEntityGroup).toBe('titles')
    expect(state.selection.selectedEntityIndex).toBe(1)
  })
})

describe('selected entity context', () => {
  it('derives selected entity context for the right panel', () => {
    const state = createWorkspaceSelectionState(documentFixture)
      .selectEntityGroup('persons')
      .selectEntity(0)

    expect(deriveSelectedEntityContext(state.document, state.selection)).toEqual({
      blockIndex: 0,
      blockName: 'Opening',
      entityGroup: 'persons',
      entityIndex: 0,
      entity: { name: 'Jane Doe', role: 'Anchor' },
    })
  })
})

describe('empty and sparse documents', () => {
  it('handles empty documents safely', () => {
    const state = createWorkspaceSelectionState({ blocks: [] })

    expect(state.selection.selectedBlockIndex).toBeUndefined()
    expect(resolveGroupedEntityLists(state.document, state.selection)).toEqual([])
    expect(deriveSelectedEntityContext(state.document, state.selection)).toBeUndefined()
  })

  it('handles blocks with empty collections safely', () => {
    const state = createWorkspaceSelectionState({
      blocks: [
        {
          name: 'Empty',
          titles: [],
          supertitles: [],
          persons: [],
          locations: [],
          breakingNews: [],
          waitingTitles: [],
          waitingLocations: [],
          phones: [],
        },
      ],
    })

    expect(resolveGroupedEntityLists(state.document, state.selection)).toEqual([
      { entityType: 'titles', items: [] },
      { entityType: 'supertitles', items: [] },
      { entityType: 'persons', items: [] },
      { entityType: 'locations', items: [] },
      { entityType: 'breakingNews', items: [] },
      { entityType: 'waitingTitles', items: [] },
      { entityType: 'waitingLocations', items: [] },
      { entityType: 'phones', items: [] },
    ])
  })
})

describe('selection reconciliation after source reload', () => {
  it('clears selected entity when it disappears after source reload', () => {
    const previous = createWorkspaceSelectionState(documentFixture)
      .selectEntityGroup('titles')
      .selectEntity(1)

    const reloaded: EditorialDocument = {
      blocks: [
        {
          ...documentFixture.blocks[0]!,
          titles: [{ id: 'title-1', number: '1', text: 'Title One' }],
        },
        documentFixture.blocks[1]!,
      ],
    }

    const reconciled = reconcileWorkspaceSelection(reloaded, previous.selection)

    expect(reconciled.selectedBlockIndex).toBe(0)
    expect(reconciled.selectedEntityGroup).toBeUndefined()
    expect(reconciled.selectedEntityIndex).toBeUndefined()
  })

  it('preserves a valid selection when possible after source reload', () => {
    const previous = createWorkspaceSelectionState(documentFixture)
      .selectBlock(1)
      .selectEntityGroup('waitingTitles')
      .selectEntity(0)

    const reloaded: EditorialDocument = {
      blocks: [
        documentFixture.blocks[0]!,
        {
          ...documentFixture.blocks[1]!,
          waitingTitles: [{ value: 'Stand by' }, { value: 'Ready' }],
        },
      ],
    }

    const reconciled = reconcileWorkspaceSelection(reloaded, previous.selection)

    expect(reconciled).toEqual({
      selectedBlockIndex: 1,
      selectedEntityGroup: 'waitingTitles',
      selectedEntityIndex: 0,
    })
  })
})
