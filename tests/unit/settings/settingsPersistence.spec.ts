import { describe, expect, it } from 'vitest'
import { appSettingsSchema } from '@/settings/schemas/appConfigSchemas'
import {
  createInMemorySettingsStorage,
  createSettingsRepository,
} from '@/settings/storage/settingsRepository'

const baseSettings = {
  selectedProfileId: 'news-am',
  referenceImages: [
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
  ],
  sourceSchemas: [
    {
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
    },
  ],
  profiles: [
    {
      id: 'news-am',
      label: 'Morning News',
      source: {
        type: 'csv',
        filePath: 'C:\\APlay\\sources\\morning.csv',
        schemaId: 'csv-news-default',
      },
      graphicConfigIds: ['title-main', 'person-lower-third'],
    },
    {
      id: 'news-pm',
      label: 'Evening News',
      source: {
        type: 'csv',
        schemaId: 'csv-news-default',
      },
      graphicConfigIds: ['breaking-main'],
    },
  ],
  graphics: [
    {
      id: 'title-main',
      entityType: 'title',
      dataFileName: 'title-main.json',
      control: {
        play: '/graphics/title/play',
        stop: '/graphics/title/stop',
        resume: '/graphics/title/resume',
      },
      preview: {
        id: 'title-preview',
        designWidth: 1920,
        designHeight: 1080,
        background: {
          referenceImageId: 'ref-title',
        },
        elements: [
          {
            id: 'headline',
            kind: 'text',
            sourceField: 'text',
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
    },
    {
      id: 'person-lower-third',
      entityType: 'person',
      dataFileName: 'person-lower-third.json',
      control: {
        play: '/graphics/person/play',
        stop: '/graphics/person/stop',
        resume: '/graphics/person/resume',
      },
      preview: {
        id: 'person-preview',
        designWidth: 1920,
        designHeight: 1080,
        background: {
          referenceImageId: 'ref-person',
          opacity: 0.5,
          fitMode: 'cover',
        },
        elements: [
          {
            id: 'person-name',
            kind: 'text',
            sourceField: 'name',
            box: {
              x: 100,
              y: 800,
              width: 600,
              height: 120,
            },
          },
        ],
      },
      actions: [{ actionType: 'playGraphic', label: 'Play' }],
    },
    {
      id: 'breaking-main',
      entityType: 'breakingNews',
      dataFileName: 'breaking-main.json',
      control: {
        play: '/graphics/breaking/play',
        stop: '/graphics/breaking/stop',
        resume: '/graphics/breaking/resume',
      },
      preview: {
        id: 'breaking-preview',
        designWidth: 1920,
        designHeight: 1080,
        elements: [
          {
            id: 'breaking-line',
            kind: 'text',
            sourceField: 'value',
            box: {
              x: 100,
              y: 900,
              width: 1000,
              height: 120,
            },
          },
        ],
      },
      actions: [{ actionType: 'playGraphic', label: 'Play' }],
    },
  ],
}

describe('settings storage load/save', () => {
  it('persists and reloads app settings through storage', () => {
    const storage = createInMemorySettingsStorage()
    const repository = createSettingsRepository(storage)

    repository.save(baseSettings)

    expect(repository.load()).toEqual(appSettingsSchema.parse(baseSettings))
  })

  it('persists and reloads configurable CSV source schemas through storage', () => {
    const storage = createInMemorySettingsStorage()
    const repository = createSettingsRepository(storage)

    repository.save(baseSettings)

    expect(repository.load().sourceSchemas).toEqual(appSettingsSchema.parse(baseSettings).sourceSchemas)
  })

  it('stores reusable reference images in the settings document', () => {
    const storage = createInMemorySettingsStorage()
    const repository = createSettingsRepository(storage)

    repository.save(baseSettings)

    expect(repository.load().referenceImages).toEqual([
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
    ])
  })

  it('stores preview background config per graphic config', () => {
    const storage = createInMemorySettingsStorage()
    const repository = createSettingsRepository(storage)

    repository.save(baseSettings)

    expect(repository.load().graphics.find((graphic) => graphic.id === 'title-main')?.preview.background)
      .toEqual({
        referenceImageId: 'ref-title',
        opacity: 1,
        fitMode: 'contain',
        position: 'center',
      })
  })
})

describe('show profile definition and lookup', () => {
  it('looks up a profile by id from the persisted settings', () => {
    const repository = createSettingsRepository(
      createInMemorySettingsStorage(JSON.stringify(baseSettings)),
    )

    expect(repository.getProfile('news-pm')).toEqual({
      id: 'news-pm',
      label: 'Evening News',
      source: {
        type: 'csv',
        schemaId: 'csv-news-default',
      },
      graphicConfigIds: ['breaking-main'],
    })
  })
})

describe('root app settings with multiple profiles', () => {
  it('supports multiple show profiles in the root settings document', () => {
    const repository = createSettingsRepository(
      createInMemorySettingsStorage(JSON.stringify(baseSettings)),
    )

    expect(repository.load().profiles.map((profile) => profile.id)).toEqual([
      'news-am',
      'news-pm',
    ])
  })
})

describe('last selected profile persistence', () => {
  it('persists the last selected profile when it changes', () => {
    const storage = createInMemorySettingsStorage(JSON.stringify(baseSettings))
    const repository = createSettingsRepository(storage)

    repository.save({
      ...baseSettings,
      selectedProfileId: 'news-pm',
    })

    expect(repository.load().selectedProfileId).toBe('news-pm')
  })
})

describe('profile source file persistence', () => {
  it('stores and reloads the source file path per profile', () => {
    const storage = createInMemorySettingsStorage()
    const repository = createSettingsRepository(storage)

    repository.save(baseSettings)

    expect(repository.load().profiles.find((profile) => profile.id === 'news-am')?.source).toEqual({
      type: 'csv',
      filePath: 'C:\\APlay\\sources\\morning.csv',
      schemaId: 'csv-news-default',
    })
  })

  it('switching the active profile changes the active source file path', () => {
    const storage = createInMemorySettingsStorage(JSON.stringify(baseSettings))
    const repository = createSettingsRepository(storage)

    repository.save({
      ...baseSettings,
      selectedProfileId: 'news-pm',
    })

    const loaded = repository.load()

    expect(loaded.selectedProfileId).toBe('news-pm')
    expect(loaded.profiles.find((profile) => profile.id === loaded.selectedProfileId)?.source).toEqual({
      type: 'csv',
      schemaId: 'csv-news-default',
    })
  })

  it('handles a missing source file path safely', () => {
    const storage = createInMemorySettingsStorage()
    const repository = createSettingsRepository(storage)

    repository.save(baseSettings)

    expect(repository.load().profiles.find((profile) => profile.id === 'news-pm')?.source).toEqual({
      type: 'csv',
      schemaId: 'csv-news-default',
    })
  })
})

describe('CSV schema association persistence', () => {
  it('keeps source file path and schema reference as separate persisted concerns', () => {
    const storage = createInMemorySettingsStorage()
    const repository = createSettingsRepository(storage)

    repository.save(baseSettings)

    expect(repository.load().profiles.find((profile) => profile.id === 'news-am')?.source).toEqual({
      type: 'csv',
      filePath: 'C:\\APlay\\sources\\morning.csv',
      schemaId: 'csv-news-default',
    })
    expect(repository.load().sourceSchemas[0]?.id).toBe('csv-news-default')
  })
})

describe('config validation failures', () => {
  it('surfaces invalid persisted settings clearly', () => {
    const repository = createSettingsRepository(
      createInMemorySettingsStorage(JSON.stringify({ selectedProfileId: 'missing' })),
    )

    expect(() => repository.load()).toThrow('selectedProfileId')
  })
})
