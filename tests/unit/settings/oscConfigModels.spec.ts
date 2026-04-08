import { describe, expect, it } from 'vitest'
import {
  appSettingsSchema,
  graphicInstanceConfigSchema,
} from '@/settings/schemas/appConfigSchemas'
import {
  oscArgConfigSchema,
  oscCommandConfigSchema,
  oscTargetConfigSchema,
} from '@/settings/schemas/oscConfigSchemas'
import {
  createInMemorySettingsStorage,
  createSettingsRepository,
} from '@/settings/storage/settingsRepository'

const baseSettingsWithOsc = {
  selectedProfileId: 'news-am',
  osc: {
    target: {
      host: '127.0.0.1',
      port: 53000,
    },
    commands: {
      play: {
        address: '/liveboard/play',
        args: [
          { type: 's', value: '{{templateName}}' },
          { type: 'i', value: 1 },
          { type: 'f', value: 0.5 },
        ],
      },
      stop: {
        address: '/liveboard/stop',
        args: [],
      },
      resume: {
        address: '/liveboard/resume',
        args: [],
      },
    },
  },
  referenceImages: [],
  sourceSchemas: [],
  profiles: [
    {
      id: 'news-am',
      label: 'Morning News',
      graphicConfigIds: ['title-main'],
    },
  ],
  graphics: [
    {
      id: 'title-main',
      name: 'Title main',
      entityType: 'title',
      dataFileName: 'title-main.json',
      control: {
        templateName: 'TemplateName',
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
  ],
}

describe('OSC configuration models', () => {
  it('OscTargetConfig parses host and port', () => {
    expect(oscTargetConfigSchema.parse({
      host: '127.0.0.1',
      port: 53000,
    })).toEqual({
      host: '127.0.0.1',
      port: 53000,
    })
  })

  it('OscCommandConfig parses address and args[]', () => {
    expect(oscCommandConfigSchema.parse({
      address: '/liveboard/title/play',
      args: [
        { type: 's', value: 'TemplateName' },
      ],
    })).toEqual({
      address: '/liveboard/title/play',
      args: [
        { type: 's', value: 'TemplateName' },
      ],
    })
  })

  it('accepts valid typed arg config for string, integer, and float values', () => {
    expect(oscArgConfigSchema.parse({ type: 's', value: 'TemplateName' })).toEqual({
      type: 's',
      value: 'TemplateName',
    })
    expect(oscArgConfigSchema.parse({ type: 'i', value: 1 })).toEqual({
      type: 'i',
      value: 1,
    })
    expect(oscArgConfigSchema.parse({ type: 'f', value: 0.5 })).toEqual({
      type: 'f',
      value: 0.5,
    })
  })

  it('rejects invalid arg type values', () => {
    expect(() =>
      oscArgConfigSchema.parse({ type: 'b', value: true }),
    ).toThrow('type')
  })

  it('rejects invalid value type for arg config', () => {
    expect(() =>
      oscArgConfigSchema.parse({ type: 'i', value: '1' }),
    ).toThrow('value')
  })

  it('app settings can define play command globally', () => {
    const parsed = appSettingsSchema.parse(baseSettingsWithOsc)

    expect(parsed).toMatchObject({
      osc: {
        commands: {
          play: {
            address: '/liveboard/play',
            args: [
              { type: 's', value: '{{templateName}}' },
              { type: 'i', value: 1 },
              { type: 'f', value: 0.5 },
            ],
          },
        },
      },
    })
  })

  it('graphic config can define only the LiveBoard template argument value', () => {
    const parsed = graphicInstanceConfigSchema.parse(baseSettingsWithOsc.graphics[0])

    expect(parsed).toMatchObject({
      control: {
        templateName: 'TemplateName',
      },
    })
  })

  it('missing global command config is handled safely', () => {
    expect(() =>
      appSettingsSchema.parse({
        ...baseSettingsWithOsc,
        osc: {
          ...baseSettingsWithOsc.osc,
          commands: {
            play: {
              address: '/liveboard/play',
              args: [],
            },
            stop: {
              address: '/liveboard/stop',
              args: [],
            },
          },
        },
      }),
    ).toThrow('resume')
  })

  it('settings persistence can save and load OSC config', () => {
    const repository = createSettingsRepository(createInMemorySettingsStorage())

    repository.save(baseSettingsWithOsc)

    expect(repository.load()).toEqual(appSettingsSchema.parse(baseSettingsWithOsc))
  })
})
