import { describe, expect, it } from 'vitest'
import type { CsvSourceSchemaConfig } from '@/settings/models/appConfig'
import {
  createCsvEditorialSourceAdapter,
  parseCsvEditorialDocument,
} from '@/adapters/content-source/csvEditorialSource'

const newsCsvSchema: CsvSourceSchemaConfig = {
  id: 'csv-news-default',
  name: 'News rundown CSV',
  type: 'csv',
  delimiter: ';',
  hasHeader: true,
  blockDetection: {
    mode: 'columnRegex',
    sourceColumn: 'Nr',
    pattern: '^---\\s*(.+?)\\s*---$',
  },
  entityMappings: {
    title: {
      enabled: true,
      fields: {
        number: 'Nr',
        title: 'Titlu',
      },
    },
    supertitle: {
      enabled: false,
    },
    person: {
      enabled: true,
      fields: {
        name: 'Nume',
        role: 'Functie',
      },
    },
    location: {
      enabled: true,
      fields: {
        value: 'Locatie',
      },
    },
    breakingNews: {
      enabled: true,
      fields: {
        value: 'Ultima Ora',
      },
    },
    waitingTitle: {
      enabled: true,
      fields: {
        value: 'Titlu Asteptare',
      },
    },
    waitingLocation: {
      enabled: true,
      fields: {
        value: 'Locatie Asteptare',
      },
    },
    phone: {
      enabled: false,
    },
  },
}

const extendedCsvSchema: CsvSourceSchemaConfig = {
  ...newsCsvSchema,
  entityMappings: {
    ...newsCsvSchema.entityMappings,
    supertitle: {
      enabled: true,
      fields: {
        text: 'Supratitlu',
      },
    },
    phone: {
      enabled: true,
      fields: {
        label: 'Telefon Label',
        number: 'Telefon',
      },
    },
  },
}

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

describe('CSV editorial parser with configurable schema', () => {
  it('receives CsvSourceSchemaConfig and uses it', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
    })

    expect(parsed.document.blocks).toHaveLength(3)
    expect(parsed.document.blocks[0]?.titles[0]).toEqual({
      number: '1.',
      text: 'MAIA SANDU FACE DECLARATII IN CONSILIUL UE',
    })
  })

  it('uses delimiter from schema config', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
    })

    expect(parsed.document.blocks.map((block) => block.name)).toEqual([
      'beta 1 - Maia Sandu UE',
      'beta 2 - NATO',
      'INVITATI',
    ])
  })

  it('uses hasHeader from schema config', () => {
    const csvWithoutHeader = [
      '--- Block One ---,,,',
      '1,Alpha Title,Alice Alpha,Anchor',
    ].join('\n')

    const parsed = parseCsvEditorialDocument(csvWithoutHeader, {
      schema: {
        ...newsCsvSchema,
        delimiter: ',',
        hasHeader: false,
        blockDetection: {
          mode: 'columnRegex',
          sourceColumn: '0',
          pattern: '^---\\s*(.+?)\\s*---$',
        },
        entityMappings: {
          ...newsCsvSchema.entityMappings,
          title: {
            enabled: true,
            fields: {
              number: '0',
              title: '1',
            },
          },
          person: {
            enabled: true,
            fields: {
              name: '2',
              role: '3',
            },
          },
          location: { enabled: false },
          breakingNews: { enabled: false },
          waitingTitle: { enabled: false },
          waitingLocation: { enabled: false },
        },
      },
    })

    expect(parsed.document.blocks).toEqual([
      {
        name: 'Block One',
        titles: [{ number: '1', text: 'Alpha Title' }],
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

  it('uses configured source column and regex for block detection', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
    })

    expect(parsed.document.blocks[1]?.name).toBe('beta 2 - NATO')
  })

  it('uses configured source fields for title extraction', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
    })

    expect(parsed.document.blocks[2]?.titles).toEqual([
      { number: '1.', text: 'INTRA PE CALEA INTEGRARII IN UE' },
      { number: '2.', text: 'GROSU: CINE ESTE ACASA?' },
      { number: '3.', text: 'PRIMA ZI LA SCOALA' },
    ])
  })

  it('uses configured source fields for person extraction', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
    })

    expect(parsed.document.blocks[0]?.persons).toEqual([
      { name: 'MAIA SANDU', role: 'presedinte RM' },
      { name: 'IGOR GROSU', role: 'presedintele Parlamentului' },
    ])
  })

  it('uses configured source field for location extraction', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
    })

    expect(parsed.document.blocks[2]?.locations).toEqual([{ value: 'CHISINAU' }])
  })

  it('uses configured source field for breakingNews extraction', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
    })

    expect(parsed.document.blocks[2]?.breakingNews).toEqual([{ value: 'ULTIMA ORA' }])
  })

  it('uses configured source field for waitingTitle extraction', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
    })

    expect(parsed.document.blocks[2]?.waitingTitles).toEqual([{ value: 'DECLARATII IMPORTANTE' }])
  })

  it('uses configured source field for waitingLocation extraction', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
    })

    expect(parsed.document.blocks[2]?.waitingLocations).toEqual([{ value: 'PIATA MARII ADUNARI NATIONALE' }])
  })

  it('extracts supertitles from configured source field when enabled', () => {
    const parsed = parseCsvEditorialDocument([
      'Nr;Titlu;Supratitlu',
      '--- Block ---;;',
      '1.;Alpha;Top Strap',
    ].join('\n'), {
      schema: {
        ...extendedCsvSchema,
        entityMappings: {
          ...extendedCsvSchema.entityMappings,
          title: {
            enabled: true,
            fields: {
              number: 'Nr',
              title: 'Titlu',
            },
          },
          person: { enabled: false },
          location: { enabled: false },
          breakingNews: { enabled: false },
          waitingTitle: { enabled: false },
          waitingLocation: { enabled: false },
          phone: { enabled: false },
        },
      },
    })

    expect(parsed.document.blocks[0]?.supertitles).toEqual([{ text: 'Top Strap' }])
  })

  it('extracts phones from configured source fields when enabled', () => {
    const parsed = parseCsvEditorialDocument([
      'Nr;Titlu;Telefon Label;Telefon',
      '--- Block ---;;;',
      '; ;Guest line;+37322000000',
    ].join('\n'), {
      schema: {
        ...extendedCsvSchema,
        entityMappings: {
          title: { enabled: false },
          supertitle: { enabled: false },
          person: { enabled: false },
          location: { enabled: false },
          breakingNews: { enabled: false },
          waitingTitle: { enabled: false },
          waitingLocation: { enabled: false },
          phone: {
            enabled: true,
            fields: {
              label: 'Telefon Label',
              number: 'Telefon',
            },
          },
        },
      },
    })

    expect(parsed.document.blocks[0]?.phones).toEqual([{ label: 'Guest line', number: '+37322000000' }])
  })

  it('ignores disabled entity mappings', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: {
        ...newsCsvSchema,
        entityMappings: {
          ...newsCsvSchema.entityMappings,
          person: { enabled: false },
          location: { enabled: false },
          breakingNews: { enabled: false },
          waitingTitle: { enabled: false },
          waitingLocation: { enabled: false },
        },
      },
    })

    expect(parsed.document.blocks[2]?.persons).toEqual([])
    expect(parsed.document.blocks[2]?.locations).toEqual([])
    expect(parsed.document.blocks[2]?.breakingNews).toEqual([])
  })

  it('reports missing configured source columns safely', () => {
    const parsed = parseCsvEditorialDocument([
      'Nr;Titlu',
      '--- Block ---;',
      '1.;Alpha',
    ].join('\n'), {
      schema: newsCsvSchema,
    })

    expect(parsed.diagnostics).toEqual([
      {
        severity: 'warning',
        code: 'missing-column',
        message: 'Missing configured source columns: Nume, Functie, Locatie, Ultima Ora, Titlu Asteptare, Locatie Asteptare',
        details: {
          missingColumns: ['Nume', 'Functie', 'Locatie', 'Ultima Ora', 'Titlu Asteptare', 'Locatie Asteptare'],
          schemaId: 'csv-news-default',
        },
      },
    ])
  })

  it('still returns internal domain format, not raw row output', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
    })

    expect(parsed.document.blocks[0]).toHaveProperty('titles')
    expect(parsed.document).not.toHaveProperty('rows')
  })
})

describe('CSV content source adapter', () => {
  it('loads the CSV through the adapter contract and returns domain output', () => {
    const adapter = createCsvEditorialSourceAdapter({
      schema: newsCsvSchema,
    })
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
})
