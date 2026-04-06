import { describe, expect, it, vi } from 'vitest'
import type { AppSettings, CsvSourceSchemaConfig } from '@/settings/models/appConfig'
import type {
  ContentSourceAdapter,
  ContentSourceDiagnostic,
  ContentSourceInput,
  ContentSourceLoadResult,
} from '@/adapters/content-source/contracts'
import {
  createProfileContentSourceLoader,
  resolveActiveProfileSourceConfig,
} from '@/adapters/content-source/profileContentSourceLoader'

const csvDocument = {
  blocks: [
    {
      name: 'Opening Headlines',
      titles: [
        { id: 'title-1', number: '1', text: 'Morning Briefing' },
      ],
      supertitles: [
        { id: 'supertitle-1', text: 'Top Story' },
      ],
      persons: [
        { id: 'person-1', name: 'Jane Doe', role: 'Reporter' },
      ],
      locations: [
        { id: 'location-1', value: 'Chisinau' },
      ],
      breakingNews: [],
      waitingTitles: [],
      waitingLocations: [],
      phones: [],
    },
  ],
}

const defaultCsvSchema: CsvSourceSchemaConfig = {
  id: 'csv-default-news',
  name: 'Default News CSV',
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

const csvSettings: AppSettings = {
  selectedProfileId: 'morning',
  referenceImages: [],
  sourceSchemas: [
    defaultCsvSchema,
  ],
  profiles: [
    {
      id: 'morning',
      label: 'Morning Show',
      source: {
        type: 'csv',
        filePath: 'C:\\APlay\\sources\\morning.csv',
        schemaId: 'csv-default-news',
      },
      graphicConfigIds: [],
    },
    {
      id: 'special',
      label: 'Special Edition',
      source: {
        type: 'csv',
        filePath: 'C:\\APlay\\sources\\special.csv',
        schemaId: 'csv-default-news',
      },
      graphicConfigIds: [],
    },
    {
      id: 'draft',
      label: 'Draft Show',
      source: {
        type: 'csv',
      },
      graphicConfigIds: [],
    },
  ],
  graphics: [],
}

function createAdapter(
  format: ContentSourceAdapter['format'],
  loader: (source: ContentSourceInput) => Omit<ContentSourceLoadResult, 'source'>,
): ContentSourceAdapter {
  return {
    id: `${format}-adapter`,
    format,
    load(source) {
      return {
        ...loader(source),
        source,
      }
    },
  }
}

describe('active profile source resolution', () => {
  it('resolves the correct source configuration for the active profile', () => {
    expect(resolveActiveProfileSourceConfig(csvSettings)).toEqual({
      profile: csvSettings.profiles[0],
      source: {
        type: 'csv',
        filePath: 'C:\\APlay\\sources\\morning.csv',
        schemaId: 'csv-default-news',
      },
      activeSourceFilePath: 'C:\\APlay\\sources\\morning.csv',
      sourceSchema: defaultCsvSchema,
      diagnostics: [],
    })
  })

  it('keeps source file path and schema association as separate concerns', () => {
    const resolution = resolveActiveProfileSourceConfig(csvSettings)

    expect(resolution.activeSourceFilePath).toBe('C:\\APlay\\sources\\morning.csv')
    expect(resolution.source?.schemaId).toBe('csv-default-news')
    expect(resolution.sourceSchema).toEqual(defaultCsvSchema)
  })
})

describe('profile content source loader', () => {
  it('selects the correct adapter based on source type', () => {
    const csvLoad = vi.fn(() => ({
      document: csvDocument,
      diagnostics: [],
    }))
    const jsonLoad = vi.fn(() => ({
      document: { blocks: [] },
      diagnostics: [],
    }))
    const loader = createProfileContentSourceLoader({
      adapters: [
        createAdapter('csv', csvLoad),
        createAdapter('json', jsonLoad),
      ],
      readSourceFile: () => 'number,title\n1,Morning Briefing',
    })

    loader.loadActiveProfileSource(csvSettings)

    expect(csvLoad).toHaveBeenCalledTimes(1)
    expect(jsonLoad).not.toHaveBeenCalled()
  })

  it('loads CSV source through the adapter, not directly by the consumer', () => {
    const csvLoad = vi.fn(() => ({
      document: csvDocument,
      diagnostics: [],
    }))
    const loader = createProfileContentSourceLoader({
      adapters: [createAdapter('csv', csvLoad)],
      readSourceFile: () => 'number,title\n1,Morning Briefing',
    })

    loader.loadActiveProfileSource(csvSettings)

    expect(csvLoad).toHaveBeenCalledWith({
      fileName: 'morning.csv',
      content: 'number,title\n1,Morning Briefing',
      schema: defaultCsvSchema,
    })
  })

  it('switching active profile switches both the source file and the resolved schema', () => {
    const alternateSchema: CsvSourceSchemaConfig = {
      ...defaultCsvSchema,
      id: 'csv-special',
      name: 'Special CSV',
      delimiter: ',',
    }
    const settings: AppSettings = {
      ...csvSettings,
      sourceSchemas: [defaultCsvSchema, alternateSchema],
      profiles: [
        csvSettings.profiles[0],
        {
          ...csvSettings.profiles[1],
          source: {
            type: 'csv',
            filePath: 'C:\\APlay\\sources\\special.csv',
            schemaId: 'csv-special',
          },
        },
        csvSettings.profiles[2],
      ],
    }
    const csvLoad = vi.fn(() => ({
      document: csvDocument,
      diagnostics: [],
    }))
    const loader = createProfileContentSourceLoader({
      adapters: [createAdapter('csv', csvLoad)],
      readSourceFile: (filePath) => `loaded:${filePath}`,
    })

    loader.loadActiveProfileSource(settings)
    loader.loadActiveProfileSource({
      ...settings,
      selectedProfileId: 'special',
    })

    expect(csvLoad).toHaveBeenNthCalledWith(1, {
      fileName: 'morning.csv',
      content: 'loaded:C:\\APlay\\sources\\morning.csv',
      schema: defaultCsvSchema,
    })
    expect(csvLoad).toHaveBeenNthCalledWith(2, {
      fileName: 'special.csv',
      content: 'loaded:C:\\APlay\\sources\\special.csv',
      schema: alternateSchema,
    })
  })

  it('returns EditorialDocument in internal domain format with grouped independent collections', () => {
    const loader = createProfileContentSourceLoader({
      adapters: [createAdapter('csv', () => ({
        document: csvDocument,
        diagnostics: [],
      }))],
      readSourceFile: () => 'number,title\n1,Morning Briefing',
    })

    const result = loader.loadActiveProfileSource(csvSettings)

    expect(result.document).toEqual(csvDocument)
    expect(result.document.blocks[0]?.titles).toEqual([
      { id: 'title-1', number: '1', text: 'Morning Briefing' },
    ])
    expect(result.document.blocks[0]?.persons).toEqual([
      { id: 'person-1', name: 'Jane Doe', role: 'Reporter' },
    ])
  })

  it('handles an empty but valid source safely', () => {
    const loader = createProfileContentSourceLoader({
      adapters: [createAdapter('csv', () => ({
        document: { blocks: [] },
        diagnostics: [],
      }))],
      readSourceFile: () => '',
    })

    const result = loader.loadActiveProfileSource(csvSettings)

    expect(result.document).toEqual({ blocks: [] })
    expect(result.diagnostics).toEqual([])
  })

  it('handles an invalid source file safely', () => {
    const loader = createProfileContentSourceLoader({
      adapters: [createAdapter('csv', () => ({
        document: { blocks: [] },
        diagnostics: [
          {
            severity: 'error',
            code: 'malformed-csv-row',
            message: 'Malformed CSV row detected.',
          } satisfies ContentSourceDiagnostic,
        ],
      }))],
      readSourceFile: () => 'broken,csv',
    })

    const result = loader.loadActiveProfileSource(csvSettings)

    expect(result.document).toEqual({ blocks: [] })
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'malformed-csv-row',
        message: 'Malformed CSV row detected.',
      },
    ])
  })

  it('handles a missing source file path safely', () => {
    const loader = createProfileContentSourceLoader({
      adapters: [createAdapter('csv', () => ({
        document: { blocks: [] },
        diagnostics: [],
      }))],
      readSourceFile: vi.fn(),
    })

    const result = loader.loadActiveProfileSource({
      ...csvSettings,
      selectedProfileId: 'draft',
    })

    expect(result.document).toEqual({ blocks: [] })
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'missing-source-file-path',
        message: 'Show profile "draft" has no source file selected.',
      },
    ])
  })

  it('handles a missing schema safely for a CSV profile', () => {
    const loader = createProfileContentSourceLoader({
      adapters: [createAdapter('csv', () => ({
        document: csvDocument,
        diagnostics: [],
      }))],
      readSourceFile: vi.fn(),
    })

    const result = loader.loadActiveProfileSource({
      ...csvSettings,
      sourceSchemas: [],
    })

    expect(result.document).toEqual({ blocks: [] })
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'missing-source-schema',
        message: 'CSV schema could not be resolved for profile "morning".',
        details: {
          schemaId: 'csv-default-news',
          sourceType: 'csv',
        },
      },
    ])
  })

  it('reloads the active source through the adapter when switching profiles', () => {
    const csvLoad = vi.fn((source: ContentSourceInput) => ({
      document: {
        blocks: [{
          name: source.fileName,
          titles: [],
          supertitles: [],
          persons: [],
          locations: [],
          breakingNews: [],
          waitingTitles: [],
          waitingLocations: [],
          phones: [],
        }],
      },
      diagnostics: [],
    }))
    const readSourceFile = vi.fn((filePath: string) => `loaded:${filePath}`)
    const loader = createProfileContentSourceLoader({
      adapters: [createAdapter('csv', csvLoad)],
      readSourceFile,
    })

    const morning = loader.loadActiveProfileSource(csvSettings)
    const special = loader.loadActiveProfileSource({
      ...csvSettings,
      selectedProfileId: 'special',
    })

    expect(readSourceFile).toHaveBeenNthCalledWith(1, 'C:\\APlay\\sources\\morning.csv')
    expect(readSourceFile).toHaveBeenNthCalledWith(2, 'C:\\APlay\\sources\\special.csv')
    expect(morning.profile.id).toBe('morning')
    expect(special.profile.id).toBe('special')
  })

  it('returns an application-facing, format-agnostic domain result instead of CSV rows', () => {
    const loader = createProfileContentSourceLoader({
      adapters: [createAdapter('csv', () => ({
        document: csvDocument,
        diagnostics: [],
      }))],
      readSourceFile: () => 'number,title\n1,Morning Briefing',
    })

    const result = loader.loadActiveProfileSource(csvSettings)

    expect(result).toEqual(expect.objectContaining({
      document: csvDocument,
      profile: csvSettings.profiles[0],
    }))
    expect(result).not.toHaveProperty('rows')
  })

  it('remains open for future JsonContentSourceAdapter without changing the consumer contract', () => {
    const jsonAdapter = createAdapter('json', () => ({
      document: { blocks: [] },
      diagnostics: [],
    }))
    const loader = createProfileContentSourceLoader({
      adapters: [
        createAdapter('csv', () => ({
          document: csvDocument,
          diagnostics: [],
        })),
        jsonAdapter,
      ],
      readSourceFile: () => 'number,title\n1,Morning Briefing',
    })

    const result = loader.loadActiveProfileSource(csvSettings)

    expect(result).toEqual(expect.objectContaining({
      document: csvDocument,
      diagnostics: [],
    }))
    expect(jsonAdapter.format).toBe('json')
  })
})
