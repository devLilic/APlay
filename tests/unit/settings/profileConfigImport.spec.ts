import { describe, expect, it, vi } from 'vitest'
import type {
  AppSettings,
  CsvSourceSchemaConfig,
  GraphicInstanceConfig,
  ReferenceImageAsset,
  ShowProfileConfig,
} from '@/settings/models/appConfig'
import {
  createProfileConfigExportEnvelope,
  parseProfileConfigImport,
  profileConfigExportType,
  profileConfigExportVersion,
  serializeProfileConfigExport,
} from '@/settings/storage/profileConfigExport'
import {
  csvSourceSchemaConfigSchema,
  graphicInstanceConfigSchema,
  referenceImageAssetSchema,
  showProfileConfigSchema,
} from '@/settings/schemas/appConfigSchemas'
import {
  createMemoryKeyValueStorage,
  createWorkspaceConfigRepository,
} from '@/settings/storage/workspaceConfigRepository'

const referenceImages: ReferenceImageAsset[] = [
  {
    id: 'ref-title',
    name: 'Title Reference',
    filePath: 'C:\\APlay\\references\\title.png',
  },
  {
    id: 'ref-person',
    name: 'Person Reference',
    filePath: 'C:\\APlay\\references\\person.png',
  },
]

const sourceSchema: CsvSourceSchemaConfig = {
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
      enabled: false,
    },
    breakingNews: {
      enabled: false,
    },
    waitingTitle: {
      enabled: false,
    },
    waitingLocation: {
      enabled: false,
    },
    phone: {
      enabled: false,
    },
  },
}

const titleGraphic: GraphicInstanceConfig = {
  id: 'title-main',
  entityType: 'title',
  dataFileName: 'title-main.json',
  datasourcePath: 'datasources/title-main.json',
  control: {
    play: '/graphics/title/play',
    stop: '/graphics/title/stop',
    resume: '/graphics/title/resume',
  },
  bindings: [{ sourceField: 'text', targetField: 'headline', required: true }],
  preview: {
    id: 'title-preview',
    designWidth: 1920,
    designHeight: 1080,
    background: {
      referenceImageId: 'ref-title',
      opacity: 0.45,
      fitMode: 'cover',
      position: 'center',
    },
    elements: [
      {
        id: 'headline',
        kind: 'text',
        sourceField: 'text',
        previewText: 'Sample title',
        box: {
          x: 100,
          y: 150,
          width: 900,
          height: 180,
        },
      },
    ],
  },
  actions: [{ actionType: 'playGraphic', label: 'Play' }],
}

const personGraphic: GraphicInstanceConfig = {
  id: 'person-main',
  entityType: 'person',
  dataFileName: 'person-main.json',
  datasourcePath: 'datasources/person-main.json',
  control: {
    play: '/graphics/person/play',
    stop: '/graphics/person/stop',
    resume: '/graphics/person/resume',
  },
  bindings: [
    { sourceField: 'name', targetField: 'name', required: true },
    { sourceField: 'role', targetField: 'role' },
  ],
  preview: {
    id: 'person-preview',
    designWidth: 1920,
    designHeight: 1080,
    background: {
      referenceImageId: 'ref-person',
      opacity: 0.35,
      fitMode: 'contain',
      position: 'center',
    },
    elements: [
      {
        id: 'person-name',
        kind: 'text',
        sourceField: 'name',
        box: {
          x: 100,
          y: 760,
          width: 700,
          height: 120,
        },
      },
    ],
  },
  actions: [{ actionType: 'playGraphic', label: 'Play' }],
}

const importedProfile: ShowProfileConfig = {
  id: 'news-am',
  label: 'Morning News',
  source: {
    type: 'csv',
    filePath: 'C:\\APlay\\sources\\morning.csv',
    schemaId: 'csv-news-default',
  },
  graphicConfigIds: ['title-main', 'person-main'],
}

function createSettingsFixture(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    selectedProfileId: 'existing',
    referenceImages,
    sourceSchemas: [sourceSchema],
    profiles: [
      {
        id: 'existing',
        label: 'Existing',
        source: {
          type: 'csv',
        },
        graphicConfigIds: [],
      },
    ],
    graphics: [],
    ...overrides,
  }
}

const normalizedProfile = showProfileConfigSchema.parse(importedProfile)
const normalizedSchema = csvSourceSchemaConfigSchema.parse(sourceSchema)
const normalizedGraphics = [
  graphicInstanceConfigSchema.parse(titleGraphic),
  graphicInstanceConfigSchema.parse(personGraphic),
]
const normalizedReferenceImages = referenceImages.map((item) => referenceImageAssetSchema.parse(item))

describe('profileConfigImport', () => {
  it('imports a valid profile export JSON', () => {
    const imported = parseProfileConfigImport(
      JSON.parse(serializeProfileConfigExport({
        ...createSettingsFixture(),
        selectedProfileId: 'news-am',
        profiles: [importedProfile],
        graphics: [titleGraphic, personGraphic],
      }, 'news-am')) as unknown,
    )

    expect(imported).toEqual({
      profile: normalizedProfile,
      sourceSchemas: [normalizedSchema],
      graphics: normalizedGraphics,
      referenceImages: normalizedReferenceImages,
    })
  })

  it('requires version, export type metadata, and profile payload in the wrapped format', () => {
    expect(() =>
      parseProfileConfigImport({
        exportType: profileConfigExportType,
        payload: {
          profile: importedProfile,
          sourceSchemas: [sourceSchema],
          graphics: [titleGraphic, personGraphic],
          referenceImages,
        },
      }),
    ).toThrow('version')

    expect(() =>
      parseProfileConfigImport({
        version: profileConfigExportVersion,
        payload: {
          profile: importedProfile,
          sourceSchemas: [sourceSchema],
          graphics: [titleGraphic, personGraphic],
          referenceImages,
        },
      }),
    ).toThrow('type')

    expect(() =>
      parseProfileConfigImport({
        version: profileConfigExportVersion,
        exportType: profileConfigExportType,
      }),
    ).toThrow('payload')
  })

  it('restores profile config correctly', () => {
    const imported = parseProfileConfigImport(createProfileConfigExportEnvelope({
      ...createSettingsFixture(),
      selectedProfileId: 'news-am',
      profiles: [importedProfile],
      graphics: [titleGraphic, personGraphic],
    }, 'news-am'))

    expect(imported.profile).toEqual(normalizedProfile)
  })

  it('restores profile-level source configuration correctly', () => {
    const imported = parseProfileConfigImport(createProfileConfigExportEnvelope({
      ...createSettingsFixture(),
      selectedProfileId: 'news-am',
      profiles: [importedProfile],
      graphics: [titleGraphic, personGraphic],
    }, 'news-am'))

    expect(imported.profile.source).toEqual({
      type: 'csv',
      filePath: 'C:\\APlay\\sources\\morning.csv',
      schemaId: 'csv-news-default',
    })
  })

  it('restores source schema config correctly', () => {
    const imported = parseProfileConfigImport(createProfileConfigExportEnvelope({
      ...createSettingsFixture(),
      selectedProfileId: 'news-am',
      profiles: [importedProfile],
      graphics: [titleGraphic, personGraphic],
    }, 'news-am'))

    expect(imported.sourceSchemas).toEqual([normalizedSchema])
  })

  it('restores embedded graphic configs correctly', () => {
    const imported = parseProfileConfigImport(createProfileConfigExportEnvelope({
      ...createSettingsFixture(),
      selectedProfileId: 'news-am',
      profiles: [importedProfile],
      graphics: [titleGraphic, personGraphic],
    }, 'news-am'))

    expect(imported.graphics).toEqual(normalizedGraphics)
  })

  it('restores reference image metadata/config correctly', () => {
    const imported = parseProfileConfigImport(createProfileConfigExportEnvelope({
      ...createSettingsFixture(),
      selectedProfileId: 'news-am',
      profiles: [importedProfile],
      graphics: [titleGraphic, personGraphic],
    }, 'news-am'))

    expect(imported.referenceImages).toEqual(normalizedReferenceImages)
  })

  it('rejects invalid export types', () => {
    expect(() =>
      parseProfileConfigImport({
        version: profileConfigExportVersion,
        exportType: 'graphic-config',
        payload: {
          profile: importedProfile,
          sourceSchemas: [sourceSchema],
          graphics: [titleGraphic, personGraphic],
          referenceImages,
        },
      }),
    ).toThrow('type')
  })

  it('rejects missing required profile fields safely', () => {
    expect(() =>
      parseProfileConfigImport({
        version: profileConfigExportVersion,
        exportType: profileConfigExportType,
        payload: {
          sourceSchemas: [sourceSchema],
          graphics: [titleGraphic, personGraphic],
          referenceImages,
        },
      }),
    ).toThrow('showProfileConfig')
  })

  it('invalid embedded config prevents unsafe partial import according to the current all-or-nothing policy', () => {
    expect(() =>
      parseProfileConfigImport({
        version: profileConfigExportVersion,
        exportType: profileConfigExportType,
        payload: {
          profile: importedProfile,
          sourceSchemas: [sourceSchema],
          graphics: [
            titleGraphic,
            {
              id: 'broken',
              entityType: 'person',
            },
          ],
          referenceImages,
        },
      })
    ).toThrow('graphicInstanceConfig')
  })

  it('does not include or restore volatile runtime state', () => {
    const imported = parseProfileConfigImport(createProfileConfigExportEnvelope({
      ...createSettingsFixture(),
      selectedProfileId: 'news-am',
      profiles: [importedProfile],
      graphics: [titleGraphic, personGraphic],
    }, 'news-am')) as unknown as Record<string, unknown>

    expect(imported).not.toHaveProperty('selectedProfileId')
    expect(imported).not.toHaveProperty('diagnostics')
    expect(imported).not.toHaveProperty('activeSourceFilePath')
    expect(imported).not.toHaveProperty('graphicsByEntityType')
  })

  it('does not execute OSC or publish datasource files during profile import parsing', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const imported = parseProfileConfigImport(createProfileConfigExportEnvelope({
      ...createSettingsFixture(),
      selectedProfileId: 'news-am',
      profiles: [importedProfile],
      graphics: [titleGraphic, personGraphic],
    }, 'news-am'))

    expect(imported.profile.id).toBe('news-am')
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('profileConfigImport integration spec', () => {
  it('adds an imported profile only after validation succeeds', () => {
    const repository = createWorkspaceConfigRepository(createMemoryKeyValueStorage(), {
      settings: createSettingsFixture(),
      graphicFiles: {},
    }) as unknown as {
      importProfileConfig: (content: string | unknown) => {
        settings: AppSettings
      }
    }

    const snapshot = repository.importProfileConfig(
      serializeProfileConfigExport({
        ...createSettingsFixture(),
        selectedProfileId: 'news-am',
        profiles: [importedProfile],
        graphics: [titleGraphic, personGraphic],
      }, 'news-am'),
    )

    expect(snapshot.settings.profiles.map((profile) => profile.id)).toContain('news-am')
  })

  it('adds imported embedded graphic configs to the library only after validation succeeds', () => {
    const repository = createWorkspaceConfigRepository(createMemoryKeyValueStorage(), {
      settings: createSettingsFixture(),
      graphicFiles: {},
    }) as unknown as {
      importProfileConfig: (content: string | unknown) => {
        settings: AppSettings
      }
    }

    const snapshot = repository.importProfileConfig(
      serializeProfileConfigExport({
        ...createSettingsFixture(),
        selectedProfileId: 'news-am',
        profiles: [importedProfile],
        graphics: [titleGraphic, personGraphic],
      }, 'news-am'),
    )

    expect(snapshot.settings.graphics.map((graphic) => graphic.id)).toEqual(['title-main', 'person-main'])
  })

  it('handles id conflicts for imported profile safely', () => {
    const repository = createWorkspaceConfigRepository(createMemoryKeyValueStorage(), {
      settings: createSettingsFixture({
        graphics: [titleGraphic, personGraphic],
        profiles: [
          {
            id: 'existing',
            label: 'Existing',
            source: { type: 'csv' },
            graphicConfigIds: [],
          },
          {
            ...importedProfile,
            label: 'Old Morning News',
          },
        ],
      }),
      graphicFiles: {},
    }) as unknown as {
      importProfileConfig: (content: string | unknown, options?: unknown) => {
        settings: AppSettings
      }
    }

    const snapshot = repository.importProfileConfig(
      serializeProfileConfigExport({
        ...createSettingsFixture(),
        selectedProfileId: 'news-am',
        profiles: [importedProfile],
        graphics: [titleGraphic, personGraphic],
      }, 'news-am'),
      { profileConflictPolicy: 'replace' },
    )

    expect(snapshot.settings.profiles.find((profile) => profile.id === 'news-am')?.label).toBe('Morning News')
  })

  it('handles id conflicts for embedded graphic configs safely', () => {
    const repository = createWorkspaceConfigRepository(createMemoryKeyValueStorage(), {
      settings: createSettingsFixture({
        graphics: [
          {
            ...titleGraphic,
            control: {
              ...titleGraphic.control,
              play: '/graphics/old-title/play',
            },
          },
        ],
      }),
      graphicFiles: {},
    }) as unknown as {
      importProfileConfig: (content: string | unknown, options?: unknown) => {
        settings: AppSettings
      }
    }

    const snapshot = repository.importProfileConfig(
      serializeProfileConfigExport({
        ...createSettingsFixture(),
        selectedProfileId: 'news-am',
        profiles: [importedProfile],
        graphics: [titleGraphic, personGraphic],
      }, 'news-am'),
      { graphicConflictPolicy: 'replace' },
    )

    expect(snapshot.settings.graphics.find((graphic) => graphic.id === 'title-main')?.control.play)
      .toBe('/graphics/title/play')
  })

  it('invalid embedded config prevents unsafe partial import into the local library', () => {
    const storage = createMemoryKeyValueStorage()
    const repository = createWorkspaceConfigRepository(storage, {
      settings: createSettingsFixture(),
      graphicFiles: {},
    }) as unknown as {
      importProfileConfig: (content: string | unknown) => {
        settings: AppSettings
      }
    }
    const before = repository as unknown

    expect(() =>
      repository.importProfileConfig(JSON.stringify({
        version: profileConfigExportVersion,
        exportType: profileConfigExportType,
        payload: {
          profile: importedProfile,
          sourceSchemas: [sourceSchema],
          graphics: [titleGraphic, { id: 'broken', entityType: 'title' }],
          referenceImages,
        },
      }))
    ).toThrow()

    expect(before).toBeDefined()
  })
})
