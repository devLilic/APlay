import { describe, expect, it } from 'vitest'
import type { CsvSourceSchemaConfig } from '@/settings/models/appConfig'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
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
    phone: {
      enabled: false,
    },
  },
}

const extendedCsvSchema: CsvSourceSchemaConfig = {
  ...newsCsvSchema,
  entityMappings: {
    ...newsCsvSchema.entityMappings,
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

const profileGraphics: GraphicInstanceConfig[] = [
  {
    id: 'title-main',
    name: 'Title main',
    entityType: 'title',
    dataFileName: 'title-main.json',
    datasourcePath: 'datasources/title-main.json',
    control: { templateName: 'TITLE_MAIN' },
    bindings: [
      { sourceField: 'Titlu Asteptare', targetField: 'text', required: true },
      { sourceField: 'Nr', targetField: 'number' },
    ],
    preview: {
      id: 'title-main-preview',
      designWidth: 1920,
      designHeight: 1080,
      elements: [
        { id: 'title-text', kind: 'text', sourceField: 'text', box: { x: 0, y: 0, width: 100, height: 50 } },
      ],
    },
    actions: [],
  },
  {
    id: 'location-main',
    name: 'Location main',
    entityType: 'location',
    dataFileName: 'location-main.json',
    datasourcePath: 'datasources/location-main.json',
    control: { templateName: 'LOCATION_MAIN' },
    bindings: [
      { sourceField: 'Locatie Asteptare', targetField: 'value', required: true },
    ],
    preview: {
      id: 'location-main-preview',
      designWidth: 1920,
      designHeight: 1080,
      elements: [
        { id: 'location-text', kind: 'text', sourceField: 'value', box: { x: 0, y: 0, width: 100, height: 50 } },
      ],
    },
    actions: [],
  },
]

const graphicConfigCollectionGraphics: GraphicInstanceConfig[] = [
  {
    id: 'pa_title_main',
    name: 'PA title main',
    entityType: 'title',
    dataFileName: 'pa_title_main.json',
    datasourcePath: 'datasources/pa_title_main.json',
    control: { templateName: 'PA_TITLE_MAIN' },
    bindings: [
      { sourceField: 'Titlu', targetField: 'text', required: true },
      { sourceField: 'Nr', targetField: 'number' },
    ],
    preview: {
      id: 'pa-title-main-preview',
      designWidth: 1920,
      designHeight: 1080,
      elements: [
        { id: 'title-text', kind: 'text', sourceField: 'text', box: { x: 0, y: 0, width: 100, height: 50 } },
      ],
    },
    actions: [],
  },
  {
    id: 'pa_title_waiting',
    name: 'PA title waiting',
    entityType: 'title',
    dataFileName: 'pa_title_waiting.json',
    datasourcePath: 'datasources/pa_title_waiting.json',
    control: { templateName: 'PA_TITLE_WAITING' },
    bindings: [
      { sourceField: 'Titlu Asteptare', targetField: 'text', required: true },
      { sourceField: 'Locatie Asteptare', targetField: 'location' },
    ],
    preview: {
      id: 'pa-title-waiting-preview',
      designWidth: 1920,
      designHeight: 1080,
      elements: [
        { id: 'waiting-text', kind: 'text', sourceField: 'text', box: { x: 0, y: 0, width: 100, height: 50 } },
      ],
    },
    actions: [],
  },
  {
    id: 'static-bug',
    name: 'Static bug',
    entityType: 'image',
    kind: 'static',
    dataFileName: 'static-bug.json',
    control: { templateName: 'STATIC_BUG' },
    staticAsset: { assetPath: 'assets/bug.png', assetType: 'image' },
    preview: {
      id: 'static-bug-preview',
      designWidth: 1920,
      designHeight: 1080,
      elements: [
        { id: 'static-image', kind: 'image', sourceField: 'staticAsset', box: { x: 0, y: 0, width: 100, height: 50 } },
      ],
    },
    actions: [],
  },
]

const windowBoxGraphic: GraphicInstanceConfig = {
  id: 'window-box',
  name: 'Window Box',
  entityType: 'title',
  dataFileName: 'window-box.json',
  datasourcePath: 'datasources/window-box.json',
  control: { templateName: 'WINDOW_BOX' },
  bindings: [
    { sourceField: 'Titlu Asteptare', targetField: 'title' },
    { sourceField: 'Locatie Asteptare', targetField: 'location' },
  ],
  preview: {
    id: 'window-box-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      { id: 'window-box-title', kind: 'text', sourceField: 'title', box: { x: 0, y: 0, width: 100, height: 50 } },
      { id: 'window-box-location', kind: 'text', sourceField: 'location', box: { x: 0, y: 50, width: 100, height: 50 } },
    ],
  },
  actions: [],
}

const windowBoxCsv = [
  'Nr;Titlu Asteptare;Locatie Asteptare',
  '--- INVITATI ---;;',
  '1.;Declaratii importante;Piata Marii Adunari Nationale',
  '2.;Doar titlu;',
  '3.;;Doar locatie',
  '4.;;',
].join('\n')

describe('CSV editorial parser with configurable schema', () => {
  it('receives CsvSourceSchemaConfig and uses it', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
    })

    expect(parsed.document.blocks).toHaveLength(3)
    expect(parsed.document.blocks[0]?.titles[0]).toEqual({
      id: 'title-1',
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
        },
      },
    })

    expect(parsed.document.blocks).toEqual([
      {
        name: 'Block One',
        titles: [{ id: 'title-1', number: '1', text: 'Alpha Title' }],
        persons: [{ name: 'Alice Alpha', role: 'Anchor' }],
        locations: [],
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
      { id: 'title-1', number: '1.', text: 'INTRA PE CALEA INTEGRARII IN UE' },
      { id: 'title-2', number: '2.', text: 'GROSU: CINE ESTE ACASA?' },
      { id: 'title-3', number: '3.', text: 'PRIMA ZI LA SCOALA' },
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
          person: { enabled: false },
          location: { enabled: false },
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
        },
      },
    })

    expect(parsed.document.blocks[2]?.persons).toEqual([])
    expect(parsed.document.blocks[2]?.locations).toEqual([])
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
        message: 'Missing configured source columns: Nume, Functie, Locatie',
        details: {
          missingColumns: ['Nume', 'Functie', 'Locatie'],
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

  it('builds entity collections from manual profile graphic bindings when graphics are provided', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: {
        ...newsCsvSchema,
        entityMappings: {
          title: { enabled: false },
          person: { enabled: false },
          location: { enabled: false },
          phone: { enabled: false },
        },
      },
      graphics: profileGraphics,
    })

    expect(parsed.document.blocks[2]?.titles).toEqual([
      { id: 'title-1', number: '1.', text: 'DECLARATII IMPORTANTE' },
    ])
    expect(parsed.document.blocks[2]?.locations).toEqual([
      { value: 'PIATA MARII ADUNARI NATIONALE' },
    ])
    expect(parsed.document.blocks[2]?.persons).toEqual([])
  })

  it('does not depend on automatic entityMappings when manual profile graphic bindings are present', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
      graphics: profileGraphics,
    })

    expect(parsed.document.blocks[2]?.titles).toEqual([
      { id: 'title-1', number: '1.', text: 'DECLARATII IMPORTANTE' },
    ])
    expect(parsed.document.blocks[2]?.locations).toEqual([
      { value: 'PIATA MARII ADUNARI NATIONALE' },
    ])
    expect(parsed.document.blocks[2]?.persons).toEqual([])
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

describe('GraphicConfig-based entity collections', () => {
  it('stores entity collections under entityCollections keyed by graphicConfigId', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
      graphics: graphicConfigCollectionGraphics,
    })

    const blockCollections = parsed.document.blocks[2]?.entityCollections ?? {}

    expect(Object.keys(blockCollections ?? {})).toContain('pa_title_main')
    expect(Object.keys(blockCollections ?? {})).toContain('pa_title_waiting')
    expect(Array.isArray(blockCollections?.pa_title_main)).toBe(true)
    expect(Array.isArray(blockCollections?.pa_title_waiting)).toBe(true)
  })

  it('builds independent collections for multiple graphic configs sharing the same entityType', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
      graphics: graphicConfigCollectionGraphics,
    })

    const blockCollections = parsed.document.blocks[2]?.entityCollections ?? {}

    expect(blockCollections.pa_title_main).toEqual([
      { text: 'INTRA PE CALEA INTEGRARII IN UE', number: '1.' },
      { text: 'GROSU: CINE ESTE ACASA?', number: '2.' },
      { text: 'PRIMA ZI LA SCOALA', number: '3.' },
    ])
    expect(blockCollections.pa_title_waiting).toEqual([
      { text: 'DECLARATII IMPORTANTE', location: 'PIATA MARII ADUNARI NATIONALE' },
    ])
  })

  it('keeps collections independent when one collection is modified in memory', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
      graphics: graphicConfigCollectionGraphics,
    })

    const blockCollections = parsed.document.blocks[2]?.entityCollections ?? {}
    expect(blockCollections.pa_title_waiting).toEqual([
      { text: 'DECLARATII IMPORTANTE', location: 'PIATA MARII ADUNARI NATIONALE' },
    ])
    const waitingSnapshot = JSON.parse(JSON.stringify(blockCollections.pa_title_waiting))

    blockCollections.pa_title_main?.push({ text: 'Injected item' })

    expect(blockCollections.pa_title_waiting).toEqual(waitingSnapshot)
  })

  it('allows empty collections for a graphic config within a block', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
      graphics: graphicConfigCollectionGraphics,
    })

    const firstBlockCollections = parsed.document.blocks[0]?.entityCollections ?? {}

    expect(firstBlockCollections.pa_title_waiting).toEqual([])
  })

  it('does not generate entityCollections entries for static graphic configs', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
      graphics: graphicConfigCollectionGraphics,
    })

    const blockCollections = parsed.document.blocks[2]?.entityCollections ?? {}

    expect(blockCollections['static-bug']).toBeUndefined()
  })

  it('respects block context and keeps collections scoped to each block', () => {
    const parsed = parseCsvEditorialDocument(sampleCsv, {
      schema: newsCsvSchema,
      graphics: graphicConfigCollectionGraphics,
    })

    const firstBlockCollections = parsed.document.blocks[0]?.entityCollections ?? {}
    const thirdBlockCollections = parsed.document.blocks[2]?.entityCollections ?? {}

    expect(firstBlockCollections.pa_title_main).toEqual([
      { text: 'MAIA SANDU FACE DECLARATII IN CONSILIUL UE', number: '1.' },
    ])
    expect(thirdBlockCollections.pa_title_main).toEqual([
      { text: 'INTRA PE CALEA INTEGRARII IN UE', number: '1.' },
      { text: 'GROSU: CINE ESTE ACASA?', number: '2.' },
      { text: 'PRIMA ZI LA SCOALA', number: '3.' },
    ])
  })

  it('builds one composite window-box item when both title and location are present', () => {
    const parsed = parseCsvEditorialDocument(windowBoxCsv, {
      schema: {
        ...newsCsvSchema,
        entityMappings: {
          title: { enabled: false },
          person: { enabled: false },
          location: { enabled: false },
          phone: { enabled: false },
        },
      },
      graphics: [windowBoxGraphic],
    })

    expect(parsed.document.blocks[0]?.entityCollections?.['window-box']?.[0]).toEqual({
      title: 'Declaratii importante',
      location: 'Piata Marii Adunari Nationale',
    })
  })

  it('keeps a title-only window-box row as one playable item', () => {
    const parsed = parseCsvEditorialDocument(windowBoxCsv, {
      schema: {
        ...newsCsvSchema,
        entityMappings: {
          title: { enabled: false },
          person: { enabled: false },
          location: { enabled: false },
          phone: { enabled: false },
        },
      },
      graphics: [windowBoxGraphic],
    })

    expect(parsed.document.blocks[0]?.entityCollections?.['window-box']?.[1]).toEqual({
      title: 'Doar titlu',
    })
  })

  it('keeps a location-only window-box row as one playable item', () => {
    const parsed = parseCsvEditorialDocument(windowBoxCsv, {
      schema: {
        ...newsCsvSchema,
        entityMappings: {
          title: { enabled: false },
          person: { enabled: false },
          location: { enabled: false },
          phone: { enabled: false },
        },
      },
      graphics: [windowBoxGraphic],
    })

    expect(parsed.document.blocks[0]?.entityCollections?.['window-box']?.[2]).toEqual({
      location: 'Doar locatie',
    })
  })

  it('rejects an empty window-box row where both title and location are missing', () => {
    const parsed = parseCsvEditorialDocument(windowBoxCsv, {
      schema: {
        ...newsCsvSchema,
        entityMappings: {
          title: { enabled: false },
          person: { enabled: false },
          location: { enabled: false },
          phone: { enabled: false },
        },
      },
      graphics: [windowBoxGraphic],
    })

    expect(parsed.document.blocks[0]?.entityCollections?.['window-box']).toEqual([
      { title: 'Declaratii importante', location: 'Piata Marii Adunari Nationale' },
      { title: 'Doar titlu' },
      { location: 'Doar locatie' },
    ])
  })
})
