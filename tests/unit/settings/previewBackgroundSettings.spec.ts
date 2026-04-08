import { describe, expect, it } from 'vitest'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import {
  createInMemorySettingsStorage,
  createSettingsRepository,
} from '@/settings/storage/settingsRepository'
import {
  getActivePreviewBackgroundConfig,
  resolveActivePreviewBackground,
} from '@/settings/utils/previewBackgrounds'
import { createJsonDatasourcePublishTargetAdapter } from '@/adapters/publish-target/jsonDatasourcePublishTarget'
import { createOscGraphicOutputAdapter } from '@/adapters/graphic-output/oscGraphicOutput'

const titleGraphic: GraphicInstanceConfig = {
  id: 'title-main',
  name: 'Title main',
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
    elements: [
      {
        id: 'headline',
        kind: 'text',
        sourceField: 'text',
        box: {
          x: 100,
          y: 100,
          width: 800,
          height: 180,
        },
      },
    ],
  },
  actions: [{ actionType: 'playGraphic', label: 'Play' }],
}

const baseSettings = {
  selectedProfileId: 'news',
  referenceImages: [],
  profiles: [
    {
      id: 'news',
      label: 'News',
      graphicConfigIds: ['title-main'],
    },
  ],
  graphics: [titleGraphic],
}

describe('reference background images in settings', () => {
  it('adds a reference image to settings', () => {
    const repository = createSettingsRepository(createInMemorySettingsStorage())

    repository.save({
      ...baseSettings,
      referenceImages: [
        {
          id: 'bg-title',
          name: 'Title Background',
          filePath: 'C:\\APlay\\references\\title.png',
        },
      ],
    })

    expect(repository.load().referenceImages).toEqual([
      {
        id: 'bg-title',
        name: 'Title Background',
        filePath: 'C:\\APlay\\references\\title.png',
      },
    ])
  })

  it('removes a reference image from settings', () => {
    const storage = createInMemorySettingsStorage()
    const repository = createSettingsRepository(storage)

    repository.save({
      ...baseSettings,
      referenceImages: [
        {
          id: 'bg-title',
          name: 'Title Background',
          filePath: 'C:\\APlay\\references\\title.png',
        },
      ],
    })

    repository.save(baseSettings)

    expect(repository.load().referenceImages).toEqual([])
  })

  it('selects a reference image for a graphic config', () => {
    const repository = createSettingsRepository(createInMemorySettingsStorage())

    repository.save({
      ...baseSettings,
      referenceImages: [
        {
          id: 'bg-title',
          name: 'Title Background',
          filePath: 'C:\\APlay\\references\\title.png',
        },
      ],
      graphics: [
        {
          ...titleGraphic,
          preview: {
            ...titleGraphic.preview,
            background: {
              referenceImageId: 'bg-title',
            },
          },
        },
      ],
    })

    expect(
      getActivePreviewBackgroundConfig(repository.load().graphics[0]),
    ).toEqual({
      referenceImageId: 'bg-title',
      opacity: 1,
      fitMode: 'contain',
      position: 'center',
    })
  })

  it('updates background config values such as opacity and fitMode', () => {
    const repository = createSettingsRepository(createInMemorySettingsStorage())

    repository.save({
      ...baseSettings,
      referenceImages: [
        {
          id: 'bg-title',
          name: 'Title Background',
          filePath: 'C:\\APlay\\references\\title.png',
        },
      ],
      graphics: [
        {
          ...titleGraphic,
          preview: {
            ...titleGraphic.preview,
            background: {
              referenceImageId: 'bg-title',
              opacity: 0.35,
              fitMode: 'cover',
            },
          },
        },
      ],
    })

    expect(repository.load().graphics[0].preview.background).toEqual({
      referenceImageId: 'bg-title',
      opacity: 0.35,
      fitMode: 'cover',
      position: 'center',
    })
  })

  it('persists background selection across save and reload', () => {
    const storage = createInMemorySettingsStorage()
    const repository = createSettingsRepository(storage)

    repository.save({
      ...baseSettings,
      referenceImages: [
        {
          id: 'bg-title',
          name: 'Title Background',
          filePath: 'C:\\APlay\\references\\title.png',
        },
      ],
      graphics: [
        {
          ...titleGraphic,
          preview: {
            ...titleGraphic.preview,
            background: {
              referenceImageId: 'bg-title',
              opacity: 0.6,
              fitMode: 'contain',
            },
          },
        },
      ],
    })

    const reloadedRepository = createSettingsRepository(
      createInMemorySettingsStorage(storage.read()),
    )

    expect(reloadedRepository.load().graphics[0].preview.background).toEqual({
      referenceImageId: 'bg-title',
      opacity: 0.6,
      fitMode: 'contain',
      position: 'center',
    })
  })

  it('handles a missing image file safely', () => {
    const repository = createSettingsRepository(createInMemorySettingsStorage())

    repository.save({
      ...baseSettings,
      graphics: [
        {
          ...titleGraphic,
          preview: {
            ...titleGraphic.preview,
            background: {
              referenceImageId: 'missing-bg',
            },
          },
        },
      ],
    })

    expect(resolveActivePreviewBackground(repository.load(), repository.load().graphics[0])).toEqual({
      config: {
        referenceImageId: 'missing-bg',
        opacity: 1,
        fitMode: 'contain',
        position: 'center',
      },
      diagnostics: [
        'Preview background image "missing-bg" is not available in settings.',
      ],
    })
  })

  it('rejects invalid background config safely', () => {
    const repository = createSettingsRepository(createInMemorySettingsStorage())

    expect(() =>
      repository.save({
        ...baseSettings,
        referenceImages: [
          {
            id: 'bg-title',
            name: 'Title Background',
            filePath: 'C:\\APlay\\references\\title.png',
          },
        ],
        graphics: [
          {
            ...titleGraphic,
            preview: {
              ...titleGraphic.preview,
              background: {
                referenceImageId: 'bg-title',
                opacity: 2,
                fitMode: 'contain',
              },
            },
          },
        ],
      })
    ).toThrow('previewBackgroundConfig.opacity')
  })

  it('does not let background selection affect JSON publishing', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()

    const result = adapter.publishEntity(
      {
        entityType: 'title',
        entity: { id: 'title-1', text: 'Main Title' },
        targetFile: 'datasources/title-main.json',
        bindings: [{ sourceField: 'text', targetField: 'headline', required: true }],
      },
      createInMemoryTargetFileWriter(),
    )

    expect(result.payload).toEqual({ headline: 'Main Title' })
    expect(result.payload).not.toHaveProperty('background')
    expect(result.payload).not.toHaveProperty('referenceImageId')
  })

  it('does not let background selection affect OSC mapping', () => {
    const adapter = createOscGraphicOutputAdapter()
    const result = adapter.buildCommand({
      actionType: 'playGraphic',
      graphic: {
        ...titleGraphic,
        preview: {
          ...titleGraphic.preview,
          background: {
            referenceImageId: 'bg-title',
            opacity: 0.5,
            fitMode: 'cover',
          },
        },
      },
    })

    expect(result).toEqual({
      actionType: 'playGraphic',
      address: '/graphics/title/play',
      args: [],
    })
  })
})

function createInMemoryTargetFileWriter() {
  return {
    write(_targetFile: string, _content: string) {
      return undefined
    },
  }
}
