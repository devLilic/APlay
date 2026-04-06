import { describe, expect, it } from 'vitest'
import {
  createCsvEditorialSourceAdapter,
  parseCsvEditorialDocument,
} from '@/adapters/content-source/csvEditorialSource'

const sampleCsv = [
  'Nr;Titlu;Nume;Functie;Locatie;Ultima Ora;Titlu Asteptare;Locatie Asteptare',
  '--- beta 1 - Maia Sandu UE ---;;;;;;;',
  '1.;MAIA SANDU FACE DECLARATII IN CONSILIUL UE;MAIA SANDU;presedinte RM;;;;',
  ';;IGOR GROSU;presedintele Parlamentului;;;;',
  '--- beta 2 - NATO ---;;;;;;;',
  '1.;EXERCITII MILITARE NATO;MARK RUTTE;sef NATO;;;;',
  '2.;MEMBRII NATO FAC ANTRENAMENTE COMUNE;;;;;;',
  '--- INVITATI ---;;;;;;;',
  '1.;INTRA PE CALEA INTEGRARII IN UE;IRINA BEJENARU;jurnalist TVR Moldova;CHISINAU;ULTIMA ORA;DECLARATII IMPORTANTE;PIATA MARII ADUNARI NATIONALE',
  '2.;GROSU: CINE ESTE ACASA?;IGOR GROSU;presedintele Parlamentului;;;;',
  '3.;PRIMA ZI LA SCOALA;;;;;;',
].join('\n')

describe('CSV editorial parser', () => {
  it('handles semicolon-delimited CSV and recognizes the header', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv)

    expect(parsed.document.blocks).toHaveLength(3)
    expect(parsed.diagnostics).toEqual([])
  })

  it('recognizes block delimiters from the first column', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv)

    expect(parsed.document.blocks.map((block) => block.name)).toEqual([
      'beta 1 - Maia Sandu UE',
      'beta 2 - NATO',
      'INVITATI',
    ])
  })

  it('skips blank lines safely', () => {
    const parsed = parseCsvEditorialDocument([
      'Nr;Titlu;Nume;Functie;Locatie;Ultima Ora;Titlu Asteptare;Locatie Asteptare',
      '',
      '--- Block ---;;;;;;;',
      '',
      '1.;Alpha Title;Alice Alpha;Anchor;;;;',
      '',
    ].join('\n'))

    expect(parsed.document.blocks).toEqual([
      {
        name: 'Block',
        titles: [{ number: '1.', text: 'Alpha Title' }],
        supertitles: [],
        persons: [{ name: 'Alice Alpha', role: 'Anchor' }],
        locations: [],
        breakingNews: [],
        waitingTitles: [],
        waitingLocations: [],
        phones: [],
      },
    ])
  })

  it('creates an EditorialDocument with EditorialBlock objects', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv)

    expect(parsed.document).toEqual({
      blocks: [
        {
          name: 'beta 1 - Maia Sandu UE',
          titles: [{ number: '1.', text: 'MAIA SANDU FACE DECLARATII IN CONSILIUL UE' }],
          supertitles: [],
          persons: [
            { name: 'MAIA SANDU', role: 'presedinte RM' },
            { name: 'IGOR GROSU', role: 'presedintele Parlamentului' },
          ],
          locations: [],
          breakingNews: [],
          waitingTitles: [],
          waitingLocations: [],
          phones: [],
        },
        {
          name: 'beta 2 - NATO',
          titles: [
            { number: '1.', text: 'EXERCITII MILITARE NATO' },
            { number: '2.', text: 'MEMBRII NATO FAC ANTRENAMENTE COMUNE' },
          ],
          supertitles: [],
          persons: [{ name: 'MARK RUTTE', role: 'sef NATO' }],
          locations: [],
          breakingNews: [],
          waitingTitles: [],
          waitingLocations: [],
          phones: [],
        },
        {
          name: 'INVITATI',
          titles: [
            { number: '1.', text: 'INTRA PE CALEA INTEGRARII IN UE' },
            { number: '2.', text: 'GROSU: CINE ESTE ACASA?' },
            { number: '3.', text: 'PRIMA ZI LA SCOALA' },
          ],
          supertitles: [],
          persons: [
            { name: 'IRINA BEJENARU', role: 'jurnalist TVR Moldova' },
            { name: 'IGOR GROSU', role: 'presedintele Parlamentului' },
          ],
          locations: [{ value: 'CHISINAU' }],
          breakingNews: [{ value: 'ULTIMA ORA' }],
          waitingTitles: [{ value: 'DECLARATII IMPORTANTE' }],
          waitingLocations: [{ value: 'PIATA MARII ADUNARI NATIONALE' }],
          phones: [],
        },
      ],
    })
  })

  it('extracts titles[] from Nr + Titlu', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv)

    expect(parsed.document.blocks[2]?.titles).toEqual([
      { number: '1.', text: 'INTRA PE CALEA INTEGRARII IN UE' },
      { number: '2.', text: 'GROSU: CINE ESTE ACASA?' },
      { number: '3.', text: 'PRIMA ZI LA SCOALA' },
    ])
  })

  it('extracts persons[] from Nume + Functie', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv)

    expect(parsed.document.blocks[0]?.persons).toEqual([
      { name: 'MAIA SANDU', role: 'presedinte RM' },
      { name: 'IGOR GROSU', role: 'presedintele Parlamentului' },
    ])
  })

  it('extracts locations[] from Locatie', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv)

    expect(parsed.document.blocks[2]?.locations).toEqual([
      { value: 'CHISINAU' },
    ])
  })

  it('extracts breakingNews[] from Ultima Ora', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv)

    expect(parsed.document.blocks[2]?.breakingNews).toEqual([
      { value: 'ULTIMA ORA' },
    ])
  })

  it('extracts waitingTitles[] from Titlu Asteptare', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv)

    expect(parsed.document.blocks[2]?.waitingTitles).toEqual([
      { value: 'DECLARATII IMPORTANTE' },
    ])
  })

  it('extracts waitingLocations[] from Locatie Asteptare', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv)

    expect(parsed.document.blocks[2]?.waitingLocations).toEqual([
      { value: 'PIATA MARII ADUNARI NATIONALE' },
    ])
  })

  it('preserves source order inside each collection', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv)

    expect(parsed.document.blocks[1]?.titles).toEqual([
      { number: '1.', text: 'EXERCITII MILITARE NATO' },
      { number: '2.', text: 'MEMBRII NATO FAC ANTRENAMENTE COMUNE' },
    ])
  })

  it('does not create false relationships between titles[] and persons[] from the same row', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv)

    expect(parsed.document.blocks[2]?.titles[0]).not.toHaveProperty('person')
    expect(parsed.document.blocks[2]?.persons[0]).not.toHaveProperty('title')
  })

  it('handles partially empty rows safely', () => {
    const parsed = parseCsvEditorialDocument([
      'Nr;Titlu;Nume;Functie;Locatie;Ultima Ora;Titlu Asteptare;Locatie Asteptare',
      '--- Block ---;;;;;;;',
      '1.;Standalone Title;;;;;;',
      ';;Solo Guest;Analyst;;;;',
    ].join('\n'))

    expect(parsed.document.blocks[0]).toEqual({
      name: 'Block',
      titles: [{ number: '1.', text: 'Standalone Title' }],
      supertitles: [],
      persons: [{ name: 'Solo Guest', role: 'Analyst' }],
      locations: [],
      breakingNews: [],
      waitingTitles: [],
      waitingLocations: [],
      phones: [],
    })
  })

  it('preserves blocks with empty collections', () => {
    const parsed = parseCsvEditorialDocument([
      'Nr;Titlu;Nume;Functie;Locatie;Ultima Ora;Titlu Asteptare;Locatie Asteptare',
      '--- Empty Block ---;;;;;;;',
      ';;; ;;;;',
      '--- Titles ---;;;;;;;',
      '1.;Only Title;;;;;;',
    ].join('\n'))

    expect(parsed.document.blocks[0]).toEqual({
      name: 'Empty Block',
      titles: [],
      supertitles: [],
      persons: [],
      locations: [],
      breakingNews: [],
      waitingTitles: [],
      waitingLocations: [],
      phones: [],
    })
  })

  it('handles malformed CSV safely', () => {
    const parsed = parseCsvEditorialDocument([
      'Nr;Titlu;Nume;Functie;Locatie;Ultima Ora;Titlu Asteptare;Locatie Asteptare',
      '--- Block ---;;;;;;;',
      '"unterminated;title;row',
    ].join('\n'))

    expect(parsed.document).toEqual({
      blocks: [{ name: 'Block', titles: [], supertitles: [], persons: [], locations: [], breakingNews: [], waitingTitles: [], waitingLocations: [], phones: [] }],
    })
    expect(parsed.diagnostics[0]).toMatchObject({
      severity: 'error',
      code: 'malformed-csv-row',
    })
  })

  it('returns internal domain format, not raw rows', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv)

    expect(parsed.document.blocks[0]).toHaveProperty('titles')
    expect(parsed.document).not.toHaveProperty('rows')
  })
})

describe('CSV content source adapter', () => {
  it('loads the CSV through the adapter contract and returns domain output', () => {
    const adapter = createCsvEditorialSourceAdapter()
    const result = adapter.load({
      fileName: 'editorial.csv',
      content: sampleCsv,
    })

    expect(adapter.format).toBe('csv')
    expect(result.document.blocks.map((block) => block.name)).toEqual([
      'beta 1 - Maia Sandu UE',
      'beta 2 - NATO',
      'INVITATI',
    ])
  })

  it('surfaces missing expected columns clearly while remaining safe', () => {
    const parsed = parseCsvEditorialDocument([
      'Nr;Titlu;Nume;Functie',
      '--- Block ---;;;',
      '1.;Alpha;Alice;Anchor',
    ].join('\n'), {
      expectedColumnsByGraphicId: {
        locationGraphic: ['Locatie'],
        waitingGraphic: ['Titlu Asteptare', 'Locatie Asteptare'],
      },
    })

    expect(parsed.diagnostics).toEqual([
      {
        severity: 'warning',
        code: 'missing-column',
        message: 'Missing expected columns for graphic "locationGraphic": Locatie',
        details: {
          graphicId: 'locationGraphic',
          missingColumns: ['Locatie'],
        },
      },
      {
        severity: 'warning',
        code: 'missing-column',
        message: 'Missing expected columns for graphic "waitingGraphic": Titlu Asteptare, Locatie Asteptare',
        details: {
          graphicId: 'waitingGraphic',
          missingColumns: ['Titlu Asteptare', 'Locatie Asteptare'],
        },
      },
    ])
  })
})
