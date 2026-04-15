import { describe, expect, it } from 'vitest'
import * as entityCollectionLabels from '@/features/workspace/state/entityCollectionLabels'
import {
  formatEntityCollectionLabel,
  formatEntityLabel,
} from '@/features/workspace/state/entityCollectionLabels'

describe('composite entity collection labels', () => {
  it('formats a window-box item with title and location as one row label', () => {
    expect(
      formatEntityCollectionLabel({
        title: 'Declaratii importante',
        location: 'Piata Marii Adunari Nationale',
      }),
    ).toBe('Declaratii importante | Piata Marii Adunari Nationale')
  })

  it('formats a title-only window-box item as one row label', () => {
    expect(
      formatEntityCollectionLabel({
        title: 'Declaratii importante',
      }),
    ).toBe('Declaratii importante')
  })

  it('formats a location-only window-box item as one row label', () => {
    expect(
      formatEntityCollectionLabel({
        location: 'Piata Marii Adunari Nationale',
      }),
    ).toBe('Piata Marii Adunari Nationale')
  })

  it('formats selected entity text for composite window-box items', () => {
    expect(
      formatEntityLabel({
        title: 'Declaratii importante',
        location: 'Piata Marii Adunari Nationale',
      }),
    ).toBe('Declaratii importante | Piata Marii Adunari Nationale')
  })

  it('resolves configured primary and secondary display fields from the mapped source fields for graphic collections', () => {
    const resolveGraphicCollectionItemDisplay = (
      entityCollectionLabels as Record<string, unknown>
    ).resolveGraphicCollectionItemDisplay as undefined | ((
      entity: unknown,
      graphic: unknown,
    ) => { primary: string; secondary?: string })

    expect(resolveGraphicCollectionItemDisplay).toBeTypeOf('function')
    if (!resolveGraphicCollectionItemDisplay) {
      return
    }

    expect(resolveGraphicCollectionItemDisplay(
      {
        Nr: '12',
        Nume: 'Ana Rusu',
        Functie: 'Moderator',
        Locatie: 'Chisinau',
      },
      {
        id: 'person-main',
        entityType: 'person',
        bindings: [
          { sourceField: 'Nr', targetField: 'number', required: true },
          { sourceField: 'Nume', targetField: 'name', required: true },
          { sourceField: 'Functie', targetField: 'role' },
          { sourceField: 'Locatie', targetField: 'location' },
        ],
        collectionDisplay: {
          primarySourceField: 'Nume',
          secondarySourceField: 'Functie',
        },
      },
    )).toEqual({
      primary: 'Ana Rusu',
      secondary: 'Moderator',
    })
  })

  it('omits secondary metadata when only a primary display field is configured', () => {
    const resolveGraphicCollectionItemDisplay = (
      entityCollectionLabels as Record<string, unknown>
    ).resolveGraphicCollectionItemDisplay as undefined | ((
      entity: unknown,
      graphic: unknown,
    ) => { primary: string; secondary?: string })

    expect(resolveGraphicCollectionItemDisplay).toBeTypeOf('function')
    if (!resolveGraphicCollectionItemDisplay) {
      return
    }

    expect(resolveGraphicCollectionItemDisplay(
      {
        Nr: '12',
        Nume: 'Ana Rusu',
        Functie: 'Moderator',
        Locatie: 'Chisinau',
      },
      {
        id: 'person-main',
        entityType: 'person',
        bindings: [
          { sourceField: 'Nr', targetField: 'number', required: true },
          { sourceField: 'Nume', targetField: 'name', required: true },
          { sourceField: 'Functie', targetField: 'role' },
          { sourceField: 'Locatie', targetField: 'location' },
        ],
        collectionDisplay: {
          primarySourceField: 'Nume',
        },
      },
    )).toEqual({
      primary: 'Ana Rusu',
    })
  })

  it('falls back coherently when no explicit display field configuration exists', () => {
    const resolveGraphicCollectionItemDisplay = (
      entityCollectionLabels as Record<string, unknown>
    ).resolveGraphicCollectionItemDisplay as undefined | ((
      entity: unknown,
      graphic: unknown,
    ) => { primary: string; secondary?: string })

    expect(resolveGraphicCollectionItemDisplay).toBeTypeOf('function')
    if (!resolveGraphicCollectionItemDisplay) {
      return
    }

    expect(resolveGraphicCollectionItemDisplay(
      {
        name: 'Ana Rusu',
        role: 'Moderator',
      },
      {
        id: 'person-main',
        entityType: 'person',
      },
    )).toEqual({
      primary: 'Ana Rusu',
      secondary: 'Moderator',
    })
  })

  it('does not duplicate the secondary line when primary and secondary resolve to the same value', () => {
    const resolveGraphicCollectionItemDisplay = (
      entityCollectionLabels as Record<string, unknown>
    ).resolveGraphicCollectionItemDisplay as undefined | ((
      entity: unknown,
      graphic: unknown,
    ) => { primary: string; secondary?: string })

    expect(resolveGraphicCollectionItemDisplay).toBeTypeOf('function')
    if (!resolveGraphicCollectionItemDisplay) {
      return
    }

    expect(resolveGraphicCollectionItemDisplay(
      {
        Nume: 'Ana Rusu',
      },
      {
        id: 'person-main',
        bindings: [
          { sourceField: 'Nume', targetField: 'name', required: true },
        ],
        collectionDisplay: {
          primarySourceField: 'Nume',
          secondarySourceField: 'Nume',
        },
      },
    )).toEqual({
      primary: 'Ana Rusu',
    })
  })

  it('falls back when a configured display field no longer exists in the current mapping', () => {
    const resolveGraphicCollectionItemDisplay = (
      entityCollectionLabels as Record<string, unknown>
    ).resolveGraphicCollectionItemDisplay as undefined | ((
      entity: unknown,
      graphic: unknown,
    ) => { primary: string; secondary?: string })

    expect(resolveGraphicCollectionItemDisplay).toBeTypeOf('function')
    if (!resolveGraphicCollectionItemDisplay) {
      return
    }

    expect(resolveGraphicCollectionItemDisplay(
      {
        name: 'Ana Rusu',
        role: 'Moderator',
        Locatie: 'Chisinau',
      },
      {
        id: 'person-main',
        bindings: [
          { sourceField: 'Nume', targetField: 'name', required: true },
          { sourceField: 'Functie', targetField: 'role' },
        ],
        collectionDisplay: {
          primarySourceField: 'Locatie',
          secondarySourceField: 'Functie',
        },
      },
    )).toEqual({
      primary: 'Ana Rusu',
      secondary: 'Moderator',
    })
  })

  it('falls back when configured values are empty', () => {
    const resolveGraphicCollectionItemDisplay = (
      entityCollectionLabels as Record<string, unknown>
    ).resolveGraphicCollectionItemDisplay as undefined | ((
      entity: unknown,
      graphic: unknown,
    ) => { primary: string; secondary?: string })

    expect(resolveGraphicCollectionItemDisplay).toBeTypeOf('function')
    if (!resolveGraphicCollectionItemDisplay) {
      return
    }

    expect(resolveGraphicCollectionItemDisplay(
      {
        name: 'Ana Rusu',
        role: 'Moderator',
        Nume: '   ',
        Functie: '',
      },
      {
        id: 'person-main',
        bindings: [
          { sourceField: 'Nume', targetField: 'name', required: true },
          { sourceField: 'Functie', targetField: 'role' },
        ],
        collectionDisplay: {
          primarySourceField: 'Nume',
          secondarySourceField: 'Functie',
        },
      },
    )).toEqual({
      primary: 'Ana Rusu',
      secondary: 'Moderator',
    })
  })

  it('uses secondary as primary when it has a value and primary is empty', () => {
    const resolveGraphicCollectionItemDisplay = (
      entityCollectionLabels as Record<string, unknown>
    ).resolveGraphicCollectionItemDisplay as undefined | ((
      entity: unknown,
      graphic: unknown,
    ) => { primary: string; secondary?: string })

    expect(resolveGraphicCollectionItemDisplay).toBeTypeOf('function')
    if (!resolveGraphicCollectionItemDisplay) {
      return
    }

    expect(resolveGraphicCollectionItemDisplay(
      {
        Nume: '',
        Functie: 'Moderator',
      },
      {
        id: 'person-main',
        bindings: [
          { sourceField: 'Nume', targetField: 'name', required: true },
          { sourceField: 'Functie', targetField: 'role' },
        ],
        collectionDisplay: {
          primarySourceField: 'Nume',
          secondarySourceField: 'Functie',
        },
      },
    )).toEqual({
      primary: 'Moderator',
    })
  })
})
