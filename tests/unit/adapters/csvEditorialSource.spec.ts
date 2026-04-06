import { describe, expect, it } from 'vitest'
import {
  createCsvEditorialSourceAdapter,
  parseCsvEditorialDocument,
} from '@/adapters/content-source/csvEditorialSource'

const validCsv = [
  'type,number,title,supertitle,name,role,location,breakingNews,waitingTitle,waitingLocation,phoneLabel,phoneNumber',
  'title,1,Alpha Title,,,,,,,,',
  'supertitle,,,Alpha Super,,,,,,,',
  'person,,,,Alice Alpha,Anchor,,,,,,',
  'location,,,,,,Chisinau,,,,,',
  'breakingNews,,,,,,,Breaking First,,,,',
  'waitingTitle,,,,,,,,Waiting First,,,',
  'waitingLocation,,,,,,,,,Desk One,,',
  'phone,,,,,,,,,,Studio,111',
  'title,2,Beta Title,,,,,,,,',
  'supertitle,,,Beta Super,,,,,,,',
  'person,,,,Bob Beta,Reporter,,,,,,',
  'location,,,,,,Balti,,,,,',
  'breakingNews,,,,,,,Breaking Second,,,,',
  'waitingTitle,,,,,,,,Waiting Second,,,',
  'waitingLocation,,,,,,,,,Desk Two,,',
  'phone,,,,,,,,,,Mobile,222',
].join('\n')

describe('CSV editorial parser', () => {
  it('creates an EditorialDocument with blocks and independent entity collections', () => {
    const parsed = parseCsvEditorialDocument([
      'type,number,title,supertitle,name,role,location,breakingNews,waitingTitle,waitingLocation,phoneLabel,phoneNumber',
      '---Opening Headlines---',
      'title,1,Main Title,,,,,,,,',
      'person,,,,Jane Doe,Anchor,,,,,,',
      '---Second Block---',
      'location,,,,,,Chisinau,,,,,',
    ].join('\n'))

    expect(parsed.document).toEqual({
      blocks: [
        {
          name: 'Opening Headlines',
          titles: [{ text: '1 Main Title' }],
          supertitles: [],
          persons: [{ name: 'Jane Doe', role: 'Anchor' }],
          locations: [],
          breakingNews: [],
          waitingTitles: [],
          waitingLocations: [],
          phones: [],
        },
        {
          name: 'Second Block',
          titles: [],
          supertitles: [],
          persons: [],
          locations: [{ value: 'Chisinau' }],
          breakingNews: [],
          waitingTitles: [],
          waitingLocations: [],
          phones: [],
        },
      ],
    })
  })

  it('detects block delimiters using the ---Block Name--- format', () => {
    const parsed = parseCsvEditorialDocument([
      'type,number,title,supertitle,name,role,location,breakingNews,waitingTitle,waitingLocation,phoneLabel,phoneNumber',
      '---Block One---',
      'title,1,Alpha,,,,,,,,',
      '---Block Two---',
      'title,2,Beta,,,,,,,,',
    ].join('\n'))

    expect(parsed.document.blocks.map((block) => block.name)).toEqual(['Block One', 'Block Two'])
  })

  it('ignores blank lines around headers, blocks, and content', () => {
    const parsed = parseCsvEditorialDocument([
      '',
      'type,number,title,supertitle,name,role,location,breakingNews,waitingTitle,waitingLocation,phoneLabel,phoneNumber',
      '',
      '---Block One---',
      '',
      'title,1,Alpha,,,,,,,,',
      '',
      'person,,,,Alice Alpha,Anchor,,,,,,',
      '',
    ].join('\n'))

    expect(parsed.document.blocks).toHaveLength(1)
    expect(parsed.document.blocks[0]?.titles).toEqual([{ text: '1 Alpha' }])
    expect(parsed.document.blocks[0]?.persons).toEqual([{ name: 'Alice Alpha', role: 'Anchor' }])
  })

  it('builds titles[] in source order', () => {
    const parsed = parseCsvEditorialDocument(['---Opening---', validCsv].join('\n'))

    expect(parsed.document.blocks[0]?.titles).toEqual([
      { text: '1 Alpha Title' },
      { text: '2 Beta Title' },
    ])
  })

  it('builds supertitles[] in source order', () => {
    const parsed = parseCsvEditorialDocument(['---Opening---', validCsv].join('\n'))

    expect(parsed.document.blocks[0]?.supertitles).toEqual([
      { text: 'Alpha Super' },
      { text: 'Beta Super' },
    ])
  })

  it('builds persons[] in source order', () => {
    const parsed = parseCsvEditorialDocument(['---Opening---', validCsv].join('\n'))

    expect(parsed.document.blocks[0]?.persons).toEqual([
      { name: 'Alice Alpha', role: 'Anchor' },
      { name: 'Bob Beta', role: 'Reporter' },
    ])
  })

  it('builds locations[] in source order', () => {
    const parsed = parseCsvEditorialDocument(['---Opening---', validCsv].join('\n'))

    expect(parsed.document.blocks[0]?.locations).toEqual([
      { value: 'Chisinau' },
      { value: 'Balti' },
    ])
  })

  it('builds breakingNews[] in source order', () => {
    const parsed = parseCsvEditorialDocument(['---Opening---', validCsv].join('\n'))

    expect(parsed.document.blocks[0]?.breakingNews).toEqual([
      { value: 'Breaking First' },
      { value: 'Breaking Second' },
    ])
  })

  it('builds waitingTitles[] in source order', () => {
    const parsed = parseCsvEditorialDocument(['---Opening---', validCsv].join('\n'))

    expect(parsed.document.blocks[0]?.waitingTitles).toEqual([
      { value: 'Waiting First' },
      { value: 'Waiting Second' },
    ])
  })

  it('builds waitingLocations[] in source order', () => {
    const parsed = parseCsvEditorialDocument(['---Opening---', validCsv].join('\n'))

    expect(parsed.document.blocks[0]?.waitingLocations).toEqual([
      { value: 'Desk One' },
      { value: 'Desk Two' },
    ])
  })

  it('builds phones[] in source order', () => {
    const parsed = parseCsvEditorialDocument(['---Opening---', validCsv].join('\n'))

    expect(parsed.document.blocks[0]?.phones).toEqual([
      { label: 'Studio', number: '111' },
      { label: 'Mobile', number: '222' },
    ])
  })

  it('builds a person entity from name + role columns', () => {
    const parsed = parseCsvEditorialDocument([
      'type,number,title,supertitle,name,role,location,breakingNews,waitingTitle,waitingLocation,phoneLabel,phoneNumber',
      '---Guests---',
      'person,,,,Maria Ionescu,Producer,,,,,,',
    ].join('\n'))

    expect(parsed.document.blocks[0]?.persons[0]).toEqual({
      name: 'Maria Ionescu',
      role: 'Producer',
    })
  })

  it('builds a title entity from number + title columns', () => {
    const parsed = parseCsvEditorialDocument([
      'type,number,title,supertitle,name,role,location,breakingNews,waitingTitle,waitingLocation,phoneLabel,phoneNumber',
      '---Titles---',
      'title,7,Market Update,,,,,,,,',
    ].join('\n'))

    expect(parsed.document.blocks[0]?.titles[0]).toEqual({
      text: '7 Market Update',
    })
  })

  it('does not fail when optional values are missing', () => {
    const parsed = parseCsvEditorialDocument([
      'type,number,title,supertitle,name,role,location,breakingNews,waitingTitle,waitingLocation,phoneLabel,phoneNumber',
      '---Block---',
      'person,,,,Solo Guest,,,,,,,',
      'title,,Standalone Title,,,,,,,,',
    ].join('\n'))

    expect(parsed.document.blocks[0]?.persons).toEqual([{ name: 'Solo Guest' }])
    expect(parsed.document.blocks[0]?.titles).toEqual([{ text: 'Standalone Title' }])
    expect(parsed.diagnostics).toEqual([])
  })

  it('surfaces missing expected columns as structured diagnostics', () => {
    const parsed = parseCsvEditorialDocument([
      'type,title',
      '---Block---',
      'title,Main Title',
    ].join('\n'), {
      expectedColumnsByGraphicId: {
        titleMain: ['number', 'title'],
        personLowerThird: ['name', 'role'],
      },
    })

    expect(parsed.diagnostics).toEqual([
      {
        severity: 'warning',
        code: 'missing-column',
        message: 'Missing expected columns for graphic "titleMain": number',
        details: {
          graphicId: 'titleMain',
          missingColumns: ['number'],
        },
      },
      {
        severity: 'warning',
        code: 'missing-column',
        message: 'Missing expected columns for graphic "personLowerThird": name, role',
        details: {
          graphicId: 'personLowerThird',
          missingColumns: ['name', 'role'],
        },
      },
    ])
  })

  it('handles malformed CSV safely without throwing uncaught errors', () => {
    expect(() =>
      parseCsvEditorialDocument([
        'type,number,title',
        '---Block---',
        '"unterminated,title row',
      ].join('\n')),
    ).not.toThrow()

    const parsed = parseCsvEditorialDocument([
      'type,number,title',
      '---Block---',
      '"unterminated,title row',
    ].join('\n'))

    expect(parsed.document.blocks[0]?.titles).toEqual([])
    expect(parsed.diagnostics[0]).toMatchObject({
      severity: 'error',
      code: 'malformed-csv-row',
    })
  })

  it('does not create false relationships between entity types from adjacent rows', () => {
    const parsed = parseCsvEditorialDocument([
      'type,number,title,supertitle,name,role,location,breakingNews,waitingTitle,waitingLocation,phoneLabel,phoneNumber',
      '---Block---',
      'title,1,Main Title,,,,,,,,',
      'person,,,,Jane Doe,Anchor,,,,,,',
    ].join('\n'))

    expect(parsed.document.blocks[0]?.titles[0]).not.toHaveProperty('person')
    expect(parsed.document.blocks[0]?.persons[0]).not.toHaveProperty('title')
  })

  it('preserves empty collections on blocks that only contain some entity types', () => {
    const parsed = parseCsvEditorialDocument([
      'type,number,title,supertitle,name,role,location,breakingNews,waitingTitle,waitingLocation,phoneLabel,phoneNumber',
      '---Locations---',
      'location,,,,,,Chisinau,,,,,',
    ].join('\n'))

    expect(parsed.document.blocks[0]).toEqual({
      name: 'Locations',
      titles: [],
      supertitles: [],
      persons: [],
      locations: [{ value: 'Chisinau' }],
      breakingNews: [],
      waitingTitles: [],
      waitingLocations: [],
      phones: [],
    })
  })
})

describe('CSV content source adapter', () => {
  it('wraps the CSV parser behind the source adapter contract', () => {
    const adapter = createCsvEditorialSourceAdapter()
    const result = adapter.load({
      fileName: 'editorial.csv',
      content: [
        'type,number,title,supertitle,name,role,location,breakingNews,waitingTitle,waitingLocation,phoneLabel,phoneNumber',
        '---Block---',
        'title,1,Alpha,,,,,,,,',
      ].join('\n'),
    })

    expect(adapter.format).toBe('csv')
    expect(result.document.blocks[0]?.titles).toEqual([{ text: '1 Alpha' }])
  })
})
