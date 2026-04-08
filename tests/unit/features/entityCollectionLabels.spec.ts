import { describe, expect, it } from 'vitest'
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
})
