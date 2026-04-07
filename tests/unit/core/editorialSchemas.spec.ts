import { describe, expect, it } from 'vitest'
import {
  editorialBlockSchema,
  editorialDocumentSchema,
  phoneEntitySchema,
  personEntitySchema,
  supertitleEntitySchema,
  textValueEntitySchema,
  titleEntitySchema,
} from '@/core/schemas/editorialSchemas'
import { supportedEntityTypes } from '@/core/entities/entityTypes'

describe('EditorialDocument schema', () => {
  it('parses a document containing editorial blocks with independent entity collections', () => {
    const parsed = editorialDocumentSchema.parse({
      blocks: [
        {
          name: 'Opening',
          titles: [{ id: 'title-1', number: '1', text: 'Main title' }],
          supertitles: [{ text: 'Top line' }],
          persons: [{ name: 'Jane Doe', role: 'Anchor' }],
          locations: [{ value: 'Chisinau' }],
          breakingNews: [{ value: 'Breaking line' }],
          waitingTitles: [{ value: 'Waiting title' }],
          waitingLocations: [{ value: 'Waiting location' }],
          phones: [{ label: 'Guest line', number: '+37360000000' }],
        },
      ],
    })

    expect(parsed).toEqual({
      blocks: [
        {
          name: 'Opening',
          titles: [{ id: 'title-1', number: '1', text: 'Main title' }],
          supertitles: [{ text: 'Top line' }],
          persons: [{ name: 'Jane Doe', role: 'Anchor' }],
          locations: [{ value: 'Chisinau' }],
          breakingNews: [{ value: 'Breaking line' }],
          waitingTitles: [{ value: 'Waiting title' }],
          waitingLocations: [{ value: 'Waiting location' }],
          phones: [{ label: 'Guest line', number: '+37360000000' }],
        },
      ],
    })
  })

  it('rejects document payloads without blocks', () => {
    expect(() => editorialDocumentSchema.parse({})).toThrow('blocks')
  })
})

describe('EditorialBlock schema', () => {
  it('fills omitted collections with empty arrays while preserving the block shape', () => {
    const parsed = editorialBlockSchema.parse({
      name: 'Guest block',
      persons: [{ name: 'John Smith' }],
    })

    expect(parsed).toEqual({
      name: 'Guest block',
      titles: [],
      supertitles: [],
      persons: [{ name: 'John Smith' }],
      locations: [],
      breakingNews: [],
      waitingTitles: [],
      waitingLocations: [],
      phones: [],
    })
  })

  it('keeps entity collections independent and does not model row-level relationships', () => {
    const parsed = editorialBlockSchema.parse({
      name: 'Independent collections',
      titles: [{ id: 'title-1', number: '1', text: 'Title A' }, { id: 'title-2', number: '2', text: 'Title B' }],
      persons: [{ name: 'Person A' }],
    })

    expect(Object.keys(parsed)).not.toContain('rows')
    expect(parsed.titles[0]).not.toHaveProperty('person')
    expect(parsed.persons[0]).not.toHaveProperty('title')
  })
})

describe('supported V1 entity types', () => {
  it('exposes only the allowed entity types for APlay V1', () => {
    expect(supportedEntityTypes).toEqual([
      'title',
      'supertitle',
      'person',
      'location',
      'breakingNews',
      'waitingTitle',
      'waitingLocation',
      'phone',
    ])
  })
})

describe('entity schemas', () => {
  it('parses a title entity', () => {
    expect(titleEntitySchema.parse({ id: 'title-7', number: '7', text: 'Headline' })).toEqual({ id: 'title-7', number: '7', text: 'Headline' })
  })

  it('requires title text', () => {
    expect(() => titleEntitySchema.parse({})).toThrow()
  })

  it('parses a supertitle entity', () => {
    expect(supertitleEntitySchema.parse({ text: 'Top strap' })).toEqual({ text: 'Top strap' })
  })

  it('parses a person entity with optional role', () => {
    expect(personEntitySchema.parse({ name: 'Jane Doe', role: 'Reporter' })).toEqual({
      name: 'Jane Doe',
      role: 'Reporter',
    })
  })

  it('parses a text-value entity used for location and waiting/breaking variants', () => {
    expect(textValueEntitySchema.parse({ value: 'Airport' })).toEqual({ value: 'Airport' })
  })

  it('requires a value for text-value entities', () => {
    expect(() => textValueEntitySchema.parse({})).toThrow('value')
  })

  it('parses a phone entity with label and number', () => {
    expect(phoneEntitySchema.parse({ label: 'Desk', number: '+37322000000' })).toEqual({
      label: 'Desk',
      number: '+37322000000',
    })
  })

  it('requires phone number', () => {
    expect(() => phoneEntitySchema.parse({ label: 'Desk' })).toThrow('number')
  })

  it('does not introduce preview reference background fields into editorial entities', () => {
    const parsed = titleEntitySchema.parse({ id: 'title-7', number: '7', text: 'Headline' })

    expect(parsed).toEqual({ id: 'title-7', number: '7', text: 'Headline' })
    expect(parsed).not.toHaveProperty('referenceImageId')
    expect(parsed).not.toHaveProperty('background')
  })
})
