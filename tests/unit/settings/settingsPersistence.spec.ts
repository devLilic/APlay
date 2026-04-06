import { describe, expect, it } from 'vitest'
import { appSettingsSchema } from '@/settings/schemas/appConfigSchemas'
import {
  createInMemorySettingsStorage,
  createSettingsRepository,
} from '@/settings/storage/settingsRepository'

const baseSettings = {
  selectedProfileId: 'news-am',
  profiles: [
    {
      id: 'news-am',
      label: 'Morning News',
      graphicConfigIds: ['title-main', 'person-lower-third'],
    },
    {
      id: 'news-pm',
      label: 'Evening News',
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
})

describe('show profile definition and lookup', () => {
  it('looks up a profile by id from the persisted settings', () => {
    const repository = createSettingsRepository(
      createInMemorySettingsStorage(JSON.stringify(baseSettings)),
    )

    expect(repository.getProfile('news-pm')).toEqual({
      id: 'news-pm',
      label: 'Evening News',
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

describe('config validation failures', () => {
  it('surfaces invalid persisted settings clearly', () => {
    const repository = createSettingsRepository(
      createInMemorySettingsStorage(JSON.stringify({ selectedProfileId: 'missing' })),
    )

    expect(() => repository.load()).toThrow('selectedProfileId')
  })
})
