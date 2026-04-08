import { describe, expect, it } from 'vitest'
import type { EditorialDocument } from '@/core/models/editorial'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import {
  createWorkspaceSelectionState,
  deriveSelectedEntityContext,
  reconcileWorkspaceSelection,
  resolveGraphicConfigEntityLists,
} from '@/features/workspace/state/workspaceSelectionState'

const documentFixture: EditorialDocument = {
  blocks: [
    {
      name: 'Opening',
      titles: [{ id: 'title-1', number: '1', text: 'Title One' }, { id: 'title-2', number: '2', text: 'Title Two' }],
      persons: [{ name: 'Jane Doe', role: 'Anchor' }],
      locations: [{ value: 'Chisinau' }],
      phones: [{ label: 'Desk', number: '111' }],
      entityCollections: {
        pa_title_main: [{ text: 'Title One', number: '1' }, { text: 'Title Two', number: '2' }],
        pa_title_waiting: [{ text: 'Waiting title', location: 'Chisinau' }],
      },
    },
    {
      name: 'Closing',
      titles: [],
      persons: [{ name: 'John Smith' }],
      locations: [],
      phones: [],
      entityCollections: {
        pa_title_main: [{ text: 'Closing title', number: '1' }],
        pa_title_waiting: [],
      },
    },
  ],
}

const graphicsFixture: GraphicInstanceConfig[] = [
  {
    id: 'pa_title_main',
    entityType: 'title',
    dataFileName: 'pa_title_main.json',
    datasourcePath: 'datasources/pa_title_main.json',
    control: { templateName: 'PA_TITLE_MAIN' },
    bindings: [{ sourceField: 'Titlu', targetField: 'text', required: true }],
    preview: {
      id: 'pa-title-main-preview',
      designWidth: 1920,
      designHeight: 1080,
      elements: [{ id: 'title-text', kind: 'text', sourceField: 'text', box: { x: 0, y: 0, width: 100, height: 20 } }],
    },
    actions: [],
  },
  {
    id: 'pa_title_waiting',
    entityType: 'title',
    dataFileName: 'pa_title_waiting.json',
    datasourcePath: 'datasources/pa_title_waiting.json',
    control: { templateName: 'PA_TITLE_WAITING' },
    bindings: [{ sourceField: 'Titlu Asteptare', targetField: 'text', required: true }],
    preview: {
      id: 'pa-title-waiting-preview',
      designWidth: 1920,
      designHeight: 1080,
      elements: [{ id: 'waiting-text', kind: 'text', sourceField: 'text', box: { x: 0, y: 0, width: 100, height: 20 } }],
    },
    actions: [],
  },
]

describe('block selection', () => {
  it('selects a block from the left panel by index', () => {
    const state = createWorkspaceSelectionState(documentFixture, graphicsFixture)
    const next = state.selectBlock(1)

    expect(next.selection.selectedBlockIndex).toBe(1)
    expect(next.getSelectedBlock()?.name).toBe('Closing')
  })

  it('clears selected entity when the block changes', () => {
    const state = createWorkspaceSelectionState(documentFixture, graphicsFixture)
      .selectGraphicConfig('pa_title_main')
      .selectEntity(1)

    const next = state.selectBlock(1)

    expect(next.selection.selectedGraphicConfigId).toBeUndefined()
    expect(next.selection.selectedEntityIndex).toBeUndefined()
  })
})

describe('grouped entity lists', () => {
  it('selecting a graphic config shows its collection', () => {
    const state = createWorkspaceSelectionState(documentFixture, graphicsFixture)
      .selectGraphicConfig('pa_title_main')
    const groupedLists = resolveGraphicConfigEntityLists(state.document, state.selection, graphicsFixture)

    expect(groupedLists).toEqual([
      {
        graphicConfigId: 'pa_title_main',
        graphic: graphicsFixture[0],
        items: [{ text: 'Title One', number: '1' }, { text: 'Title Two', number: '2' }],
      },
      {
        graphicConfigId: 'pa_title_waiting',
        graphic: graphicsFixture[1],
        items: [{ text: 'Waiting title', location: 'Chisinau' }],
      },
    ])
  })

  it('different graphic configs show different collections', () => {
    const state = createWorkspaceSelectionState(documentFixture, graphicsFixture)
    const groupedLists = resolveGraphicConfigEntityLists(state.document, state.selection, graphicsFixture)

    expect(groupedLists[0]?.items).not.toEqual(groupedLists[1]?.items)
  })

  it('switching graphic config updates visible data', () => {
    const state = createWorkspaceSelectionState(documentFixture, graphicsFixture)
      .selectGraphicConfig('pa_title_waiting')
      .selectEntity(1)

    expect(state.selection.selectedGraphicConfigId).toBe('pa_title_waiting')
    expect(state.selection.selectedEntityIndex).toBeUndefined()

    const next = state.selectGraphicConfig('pa_title_main').selectEntity(1)

    expect(next.selection.selectedGraphicConfigId).toBe('pa_title_main')
    expect(next.selection.selectedEntityIndex).toBe(1)
  })

  it('does not rely on entityType-based grouping when multiple title graphics exist', () => {
    const state = createWorkspaceSelectionState(documentFixture, graphicsFixture)
    const groupedLists = resolveGraphicConfigEntityLists(state.document, state.selection, graphicsFixture)

    expect(groupedLists.map((group) => group.graphicConfigId)).toEqual(['pa_title_main', 'pa_title_waiting'])
    expect(groupedLists.every((group) => group.graphic.entityType === 'title')).toBe(true)
  })
})

describe('selected entity context', () => {
  it('derives selected entity context for the right panel', () => {
    const state = createWorkspaceSelectionState(documentFixture, graphicsFixture)
      .selectGraphicConfig('pa_title_waiting')
      .selectEntity(0)

    expect(deriveSelectedEntityContext(state.document, state.selection)).toEqual({
      blockIndex: 0,
      blockName: 'Opening',
      graphicConfigId: 'pa_title_waiting',
      entityIndex: 0,
      entity: { text: 'Waiting title', location: 'Chisinau' },
    })
  })
})

describe('empty and sparse documents', () => {
  it('handles empty documents safely', () => {
    const state = createWorkspaceSelectionState({ blocks: [] }, graphicsFixture)

    expect(state.selection.selectedBlockIndex).toBeUndefined()
    expect(resolveGraphicConfigEntityLists(state.document, state.selection, graphicsFixture)).toEqual([])
    expect(deriveSelectedEntityContext(state.document, state.selection)).toBeUndefined()
  })

  it('handles blocks with empty collections safely', () => {
    const state = createWorkspaceSelectionState({
      blocks: [
        {
          name: 'Empty',
          titles: [],
          persons: [],
          locations: [],
          phones: [],
          entityCollections: {
            pa_title_main: [],
            pa_title_waiting: [],
          },
        },
      ],
    }, graphicsFixture)

    expect(resolveGraphicConfigEntityLists(state.document, state.selection, graphicsFixture)).toEqual([
      { graphicConfigId: 'pa_title_main', graphic: graphicsFixture[0], items: [] },
      { graphicConfigId: 'pa_title_waiting', graphic: graphicsFixture[1], items: [] },
    ])
  })
})

describe('selection reconciliation after source reload', () => {
  it('clears selected entity when it disappears after source reload', () => {
    const previous = createWorkspaceSelectionState(documentFixture, graphicsFixture)
      .selectGraphicConfig('pa_title_main')
      .selectEntity(1)

    const reloaded: EditorialDocument = {
      blocks: [
        {
          ...documentFixture.blocks[0]!,
          entityCollections: {
            pa_title_main: [{ text: 'Title One', number: '1' }],
            pa_title_waiting: [{ text: 'Waiting title', location: 'Chisinau' }],
          },
        },
        documentFixture.blocks[1]!,
      ],
    }

    const reconciled = reconcileWorkspaceSelection(reloaded, previous.selection)

    expect(reconciled.selectedBlockIndex).toBe(0)
    expect(reconciled.selectedGraphicConfigId).toBe('pa_title_main')
    expect(reconciled.selectedEntityIndex).toBeUndefined()
  })

  it('preserves a valid selection when possible after source reload', () => {
    const previous = createWorkspaceSelectionState(documentFixture, graphicsFixture)
      .selectBlock(1)
      .selectGraphicConfig('pa_title_main')
      .selectEntity(0)

    const reloaded: EditorialDocument = {
      blocks: [
        documentFixture.blocks[0]!,
        {
          ...documentFixture.blocks[1]!,
          entityCollections: {
            pa_title_main: [{ text: 'Closing title', number: '1' }, { text: 'Ready title', number: '2' }],
            pa_title_waiting: [],
          },
        },
      ],
    }

    const reconciled = reconcileWorkspaceSelection(reloaded, previous.selection)

    expect(reconciled).toEqual({
      selectedBlockIndex: 1,
      selectedGraphicConfigId: 'pa_title_main',
      selectedEntityIndex: 0,
    })
  })
})
