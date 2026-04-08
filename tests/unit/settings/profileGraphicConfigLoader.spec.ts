import { describe, expect, it } from 'vitest'
import {
  createInMemoryGraphicConfigStorage,
  createProfileGraphicConfigLoader,
} from '@/settings/storage/profileGraphicConfigLoader'
import type { AppSettings } from '@/settings/models/appConfig'
import { serializeGraphicConfigExport } from '@/settings/storage/graphicConfigExport'

const settings: AppSettings = {
  selectedProfileId: 'morning',
  referenceImages: [],
  sourceSchemas: [],
  profiles: [
    {
      id: 'morning',
      label: 'Morning Show',
      source: {
        type: 'csv',
        filePath: 'C:\\APlay\\sources\\morning.csv',
      },
      graphicConfigIds: ['title-main', 'person-main'],
    },
    {
      id: 'special',
      label: 'Special Edition',
      source: {
        type: 'csv',
        filePath: 'C:\\APlay\\sources\\special.csv',
      },
      graphicConfigIds: ['location-main', 'phone-main'],
    },
  ],
  graphics: [],
}

const graphicFiles = {
  'title-main.json': JSON.stringify({
    id: 'title-main',
    name: 'Title main',
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
  }),
  'person-main.json': JSON.stringify({
    id: 'person-main',
    name: 'Person main',
    entityType: 'person',
    dataFileName: 'person-main.json',
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
            width: 700,
            height: 120,
          },
        },
      ],
    },
    actions: [
      { actionType: 'playGraphic', label: 'Play' },
      { actionType: 'stopGraphic', label: 'Stop' },
    ],
  }),
  'location-main.json': JSON.stringify({
    id: 'location-main',
    name: 'Location main',
    entityType: 'location',
    dataFileName: 'location-main.json',
    control: {
      play: '/graphics/location/play',
      stop: '/graphics/location/stop',
      resume: '/graphics/location/resume',
    },
    preview: {
      id: 'location-preview',
      designWidth: 1920,
      designHeight: 1080,
      elements: [
        {
          id: 'location-line',
          kind: 'text',
          sourceField: 'value',
          box: {
            x: 100,
            y: 900,
            width: 1200,
            height: 120,
          },
        },
      ],
    },
    actions: [{ actionType: 'playGraphic', label: 'Play' }],
  }),
  'phone-main.json': JSON.stringify({
    id: 'phone-main',
    name: 'Phone main',
    entityType: 'phone',
    dataFileName: 'phone-main.json',
    control: {
      play: '/graphics/phone/play',
      stop: '/graphics/phone/stop',
      resume: '/graphics/phone/resume',
    },
    preview: {
      id: 'phone-preview',
      designWidth: 1920,
      designHeight: 1080,
      elements: [
        {
          id: 'phone-number',
          kind: 'text',
          sourceField: 'number',
          box: {
            x: 100,
            y: 820,
            width: 700,
            height: 120,
          },
        },
      ],
    },
    actions: [{ actionType: 'playGraphic', label: 'Play' }],
  }),
}

describe('profile-based graphic config loading', () => {
  it('loads only graphic configs referenced by the selected show profile', () => {
    const loader = createProfileGraphicConfigLoader(
      createInMemoryGraphicConfigStorage(graphicFiles),
    )

    const result = loader.loadForProfile(settings, 'morning')

    expect(result.graphics.map((graphic) => graphic.id)).toEqual([
      'title-main',
      'person-main',
    ])
    expect(result.profile.source).toEqual({
      type: 'csv',
      filePath: 'C:\\APlay\\sources\\morning.csv',
    })
  })

  it('behaves safely when a referenced graphic config file is missing', () => {
    const loader = createProfileGraphicConfigLoader(
      createInMemoryGraphicConfigStorage({
        'title-main.json': graphicFiles['title-main.json'],
      }),
    )

    const result = loader.loadForProfile(settings, 'morning')

    expect(result.graphics.map((graphic) => graphic.id)).toEqual(['title-main'])
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'missing-graphic-config',
        message: 'Graphic config file not found for "person-main"',
        details: {
          graphicConfigId: 'person-main',
          fileName: 'person-main.json',
        },
      },
    ])
  })

  it('behaves safely when a config file is invalid', () => {
    const loader = createProfileGraphicConfigLoader(
      createInMemoryGraphicConfigStorage({
        'title-main.json': '{invalid-json',
        'person-main.json': graphicFiles['person-main.json'],
      }),
    )

    const result = loader.loadForProfile(settings, 'morning')

    expect(result.graphics.map((graphic) => graphic.id)).toEqual(['person-main'])
    expect(result.diagnostics[0]).toMatchObject({
      severity: 'error',
      code: 'invalid-graphic-config',
    })
  })

  it('supports multiple graphic control configs per show profile', () => {
    const loader = createProfileGraphicConfigLoader(
      createInMemoryGraphicConfigStorage(graphicFiles),
    )

    const result = loader.loadForProfile(settings, 'special')

    expect(result.graphics).toHaveLength(2)
    expect(result.graphics.map((graphic) => graphic.control.play)).toEqual([
      '/graphics/location/play',
      '/graphics/phone/play',
    ])
  })

  it('loads the new wrapped export format as an import-ready graphic config', () => {
    const loader = createProfileGraphicConfigLoader(
      createInMemoryGraphicConfigStorage({
        'title-main.json': serializeGraphicConfigExport(JSON.parse(graphicFiles['title-main.json'])),
      }),
    )

    const result = loader.loadForProfile({
      ...settings,
      profiles: [
        {
          id: 'morning',
          label: 'Morning Show',
          graphicConfigIds: ['title-main'],
        },
      ],
    }, 'morning')

    expect(result.graphics).toHaveLength(1)
    expect(result.graphics[0]?.id).toBe('title-main')
    expect(result.diagnostics).toEqual([])
  })

  it('selecting a different profile changes the loaded graphic config set', () => {
    const loader = createProfileGraphicConfigLoader(
      createInMemoryGraphicConfigStorage(graphicFiles),
    )

    const morning = loader.loadForProfile(settings, 'morning')
    const special = loader.loadForProfile(settings, 'special')

    expect(morning.graphics.map((graphic) => graphic.id)).toEqual([
      'title-main',
      'person-main',
    ])
    expect(special.graphics.map((graphic) => graphic.id)).toEqual([
      'location-main',
      'phone-main',
    ])
    expect(morning.profile.source?.filePath).toBe('C:\\APlay\\sources\\morning.csv')
    expect(special.profile.source?.filePath).toBe('C:\\APlay\\sources\\special.csv')
  })

  it('keeps source file configuration independent from graphic config loading', () => {
    const loader = createProfileGraphicConfigLoader(
      createInMemoryGraphicConfigStorage(graphicFiles),
    )

    const result = loader.loadForProfile({
      ...settings,
      profiles: [
        {
          id: 'morning',
          label: 'Morning Show',
          source: {
            type: 'csv',
            filePath: 'C:\\APlay\\sources\\updated-morning.csv',
          },
          graphicConfigIds: ['title-main', 'person-main'],
        },
      ],
    }, 'morning')

    expect(result.profile.source).toEqual({
      type: 'csv',
      filePath: 'C:\\APlay\\sources\\updated-morning.csv',
    })
    expect(result.graphics.map((graphic) => graphic.id)).toEqual([
      'title-main',
      'person-main',
    ])
  })

  it('surfaces config validation failures clearly', () => {
    const loader = createProfileGraphicConfigLoader(
      createInMemoryGraphicConfigStorage({
        'title-main.json': JSON.stringify({
          id: 'title-main',
          entityType: 'ticker',
        }),
        'person-main.json': graphicFiles['person-main.json'],
      }),
    )

    const result = loader.loadForProfile(settings, 'morning')

    expect(result.graphics.map((graphic) => graphic.id)).toEqual(['person-main'])
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'invalid-graphic-config',
        message: 'Invalid graphic config file for "title-main"',
        details: {
          graphicConfigId: 'title-main',
          fileName: 'title-main.json',
          reason: expect.stringContaining('entityType'),
        },
      },
    ])
  })

  it('fails clearly when the selected show profile does not exist', () => {
    const loader = createProfileGraphicConfigLoader(
      createInMemoryGraphicConfigStorage(graphicFiles),
    )

    expect(() => loader.loadForProfile(settings, 'missing-profile')).toThrow('Unknown show profile')
  })

  it('reports an invalid profile that references a non-existing graphic config file', () => {
    const loader = createProfileGraphicConfigLoader(
      createInMemoryGraphicConfigStorage(graphicFiles),
    )

    const result = loader.loadForProfile({
      ...settings,
      selectedProfileId: 'broken',
      profiles: [
        {
          id: 'broken',
          label: 'Broken Profile',
          graphicConfigIds: ['does-not-exist'],
        },
      ],
    }, 'broken')

    expect(result.graphics).toEqual([])
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'missing-graphic-config',
        message: 'Graphic config file not found for "does-not-exist"',
        details: {
          graphicConfigId: 'does-not-exist',
          fileName: 'does-not-exist.json',
        },
      },
    ])
  })
})
