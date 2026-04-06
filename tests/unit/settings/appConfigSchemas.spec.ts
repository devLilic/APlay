import { describe, expect, it } from 'vitest'
import {
  actionButtonConfigSchema,
  appSettingsSchema,
  graphicControlConfigSchema,
  graphicInstanceConfigSchema,
  previewElementDefinitionSchema,
  previewTemplateDefinitionSchema,
  showProfileConfigSchema,
} from '@/settings/schemas/appConfigSchemas'

describe('GraphicControlConfig schema', () => {
  it('parses OSC graphic control configuration', () => {
    expect(
      graphicControlConfigSchema.parse({
        play: '/graphics/title/play',
        stop: '/graphics/title/stop',
        resume: '/graphics/title/resume',
      }),
    ).toEqual({
      play: '/graphics/title/play',
      stop: '/graphics/title/stop',
      resume: '/graphics/title/resume',
    })
  })

  it('rejects missing required commands', () => {
    expect(() => graphicControlConfigSchema.parse({ play: '/play', stop: '/stop' })).toThrow('resume')
  })
})

describe('ActionButtonConfig schema', () => {
  it('parses an action button bound to a fixed action type', () => {
    expect(
      actionButtonConfigSchema.parse({
        actionType: 'playGraphic',
        label: 'Play',
      }),
    ).toEqual({
      actionType: 'playGraphic',
      label: 'Play',
    })
  })

  it('rejects invalid action types', () => {
    expect(() =>
      actionButtonConfigSchema.parse({
        actionType: 'customAction',
        label: 'Custom',
      }),
    ).toThrow('actionType')
  })
})

describe('PreviewElementDefinition schema', () => {
  it('defaults transformOrigin to top-left and keeps text behavior flags explicit', () => {
    expect(
      previewElementDefinitionSchema.parse({
        id: 'headline',
        kind: 'text',
        sourceField: 'text',
        box: {
          x: 120,
          y: 160,
          width: 840,
          height: 180,
        },
        text: {
          allCaps: true,
          fitInBox: false,
        },
      }),
    ).toEqual({
      id: 'headline',
      kind: 'text',
      sourceField: 'text',
      transformOrigin: 'top-left',
      box: {
        x: 120,
        y: 160,
        width: 840,
        height: 180,
      },
      text: {
        allCaps: true,
        fitInBox: false,
      },
    })
  })

  it('accepts supported transform origin enum values', () => {
    expect(
      previewElementDefinitionSchema.parse({
        id: 'strap',
        kind: 'text',
        sourceField: 'text',
        transformOrigin: 'center',
        box: {
          x: 0,
          y: 0,
          width: 100,
          height: 40,
        },
      }).transformOrigin,
    ).toBe('center')
  })

  it('rejects invalid transform origin values', () => {
    expect(() =>
      previewElementDefinitionSchema.parse({
        id: 'strap',
        kind: 'text',
        sourceField: 'text',
        transformOrigin: 'middle',
        box: {
          x: 0,
          y: 0,
          width: 100,
          height: 40,
        },
      }),
    ).toThrow('transformOrigin')
  })
})

describe('PreviewTemplateDefinition schema', () => {
  it('parses a 16:9 preview template definition', () => {
    expect(
      previewTemplateDefinitionSchema.parse({
        id: 'title-template',
        designWidth: 1920,
        designHeight: 1080,
        elements: [
          {
            id: 'headline',
            kind: 'text',
            sourceField: 'text',
            box: {
              x: 120,
              y: 180,
              width: 900,
              height: 160,
            },
          },
        ],
      }),
    ).toEqual({
      id: 'title-template',
      designWidth: 1920,
      designHeight: 1080,
      elements: [
        {
          id: 'headline',
          kind: 'text',
          sourceField: 'text',
          transformOrigin: 'top-left',
          box: {
            x: 120,
            y: 180,
            width: 900,
            height: 160,
          },
        },
      ],
    })
  })

  it('rejects templates without elements', () => {
    expect(() =>
      previewTemplateDefinitionSchema.parse({
        id: 'empty',
        designWidth: 1920,
        designHeight: 1080,
        elements: [],
      }),
    ).toThrow('elements')
  })
})

describe('GraphicInstanceConfig schema', () => {
  it('parses one graphic instance and its preview/action config', () => {
    expect(
      graphicInstanceConfigSchema.parse({
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
                width: 800,
                height: 180,
              },
              text: {
                allCaps: false,
                fitInBox: true,
              },
            },
          ],
        },
        actions: [
          { actionType: 'playGraphic', label: 'Play' },
          { actionType: 'stopGraphic', label: 'Stop' },
          { actionType: 'resumeGraphic', label: 'Resume' },
        ],
      }),
    ).toEqual({
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
            transformOrigin: 'top-left',
            box: {
              x: 100,
              y: 150,
              width: 800,
              height: 180,
            },
            text: {
              allCaps: false,
              fitInBox: true,
            },
          },
        ],
      },
      actions: [
        { actionType: 'playGraphic', label: 'Play' },
        { actionType: 'stopGraphic', label: 'Stop' },
        { actionType: 'resumeGraphic', label: 'Resume' },
      ],
    })
  })

  it('rejects invalid entity type values', () => {
    expect(() =>
      graphicInstanceConfigSchema.parse({
        id: 'ticker',
        entityType: 'ticker',
        dataFileName: 'ticker.json',
        control: {
          play: '/play',
          stop: '/stop',
          resume: '/resume',
        },
        preview: {
          id: 'ticker-preview',
          designWidth: 1920,
          designHeight: 1080,
          elements: [
            {
              id: 'line',
              kind: 'text',
              sourceField: 'text',
              box: {
                x: 0,
                y: 0,
                width: 100,
                height: 20,
              },
            },
          ],
        },
        actions: [{ actionType: 'playGraphic', label: 'Play' }],
      }),
    ).toThrow('entityType')
  })
})

describe('ShowProfileConfig schema', () => {
  it('parses a show profile that loads separate graphic element configs', () => {
    expect(
      showProfileConfigSchema.parse({
        id: 'news-evening',
        label: 'Evening News',
        graphicConfigIds: ['title-main', 'person-lower-third'],
      }),
    ).toEqual({
      id: 'news-evening',
      label: 'Evening News',
      graphicConfigIds: ['title-main', 'person-lower-third'],
    })
  })
})

describe('AppSettings/AppConfig schema', () => {
  it('loads multiple graphic element configs through the selected profile', () => {
    const parsed = appSettingsSchema.parse({
      selectedProfileId: 'news-evening',
      profiles: [
        {
          id: 'news-evening',
          label: 'Evening News',
          graphicConfigIds: ['title-main', 'person-lower-third'],
        },
      ],
      graphics: [
        {
          id: 'title-main',
          entityType: 'title',
          dataFileName: 'title.json',
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
                  y: 100,
                  width: 800,
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
          dataFileName: 'person.json',
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
                  x: 120,
                  y: 860,
                  width: 640,
                  height: 120,
                },
                text: {
                  allCaps: true,
                  fitInBox: true,
                },
              },
            ],
          },
          actions: [{ actionType: 'playGraphic', label: 'Play' }],
        },
      ],
    })

    expect(parsed.selectedProfileId).toBe('news-evening')
    expect(parsed.profiles[0]?.graphicConfigIds).toEqual(['title-main', 'person-lower-third'])
    expect(parsed.graphics.map((graphic) => graphic.id)).toEqual(['title-main', 'person-lower-third'])
  })

  it('rejects a selected profile id that does not exist', () => {
    expect(() =>
      appSettingsSchema.parse({
        selectedProfileId: 'missing',
        profiles: [
          {
            id: 'news-evening',
            label: 'Evening News',
            graphicConfigIds: ['title-main'],
          },
        ],
        graphics: [
          {
            id: 'title-main',
            entityType: 'title',
            dataFileName: 'title.json',
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
                    y: 100,
                    width: 800,
                    height: 180,
                  },
                },
              ],
            },
            actions: [{ actionType: 'playGraphic', label: 'Play' }],
          },
        ],
      }),
    ).toThrow('selectedProfileId')
  })

  it('rejects profiles referencing missing graphic configs', () => {
    expect(() =>
      appSettingsSchema.parse({
        selectedProfileId: 'news-evening',
        profiles: [
          {
            id: 'news-evening',
            label: 'Evening News',
            graphicConfigIds: ['missing-graphic'],
          },
        ],
        graphics: [],
      }),
    ).toThrow('missing-graphic')
  })
})
