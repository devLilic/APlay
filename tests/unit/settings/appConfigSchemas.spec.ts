import { describe, expect, it } from 'vitest'
import {
  actionButtonConfigSchema,
  appSettingsSchema,
  graphicControlConfigSchema,
  graphicInstanceConfigSchema,
  previewElementDefinitionSchema,
  previewBackgroundConfigSchema,
  previewTemplateDefinitionSchema,
  referenceImageAssetSchema,
  showProfileConfigSchema,
} from '@/settings/schemas/appConfigSchemas'

describe('ReferenceImageAsset schema', () => {
  it('parses a reusable reference background image asset', () => {
    expect(referenceImageAssetSchema.parse({
      id: 'lb-title-reference',
      name: 'Title Graphic Reference',
      filePath: 'C:\\APlay\\references\\title.png',
    })).toEqual({
      id: 'lb-title-reference',
      name: 'Title Graphic Reference',
      filePath: 'C:\\APlay\\references\\title.png',
    })
  })

  it('handles invalid image paths safely', () => {
    expect(() => referenceImageAssetSchema.parse({
      id: 'broken-reference',
      name: 'Broken Reference',
      filePath: '',
    })).toThrow('filePath')
  })
})

describe('PreviewBackgroundConfig schema', () => {
  it('defaults to no selected background, opacity 1, contain fit mode, and center position', () => {
    expect(previewBackgroundConfigSchema.parse({})).toEqual({
      opacity: 1,
      fitMode: 'contain',
      position: 'center',
    })
  })

  it('parses an explicit preview background configuration', () => {
    expect(previewBackgroundConfigSchema.parse({
      referenceImageId: 'lb-title-reference',
      opacity: 0.45,
      fitMode: 'cover',
      position: 'center',
    })).toEqual({
      referenceImageId: 'lb-title-reference',
      opacity: 0.45,
      fitMode: 'cover',
      position: 'center',
    })
  })

  it('does not break preview when referenceImageId is missing', () => {
    expect(previewBackgroundConfigSchema.parse({
      opacity: 0.6,
    })).toEqual({
      opacity: 0.6,
      fitMode: 'contain',
      position: 'center',
    })
  })

  it('rejects invalid opacity values', () => {
    expect(() => previewBackgroundConfigSchema.parse({
      opacity: 2,
    })).toThrow('opacity')
  })
})

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
      behavior: {
        allCaps: true,
        fitInBox: false,
        textAlign: 'center',
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
      behavior: {
        allCaps: true,
        fitInBox: false,
        textAlign: 'center',
      },
    })
  })

  it('accepts behavior config for fitInBox, allCaps, minScaleX, and transformOrigin', () => {
    expect(
      previewElementDefinitionSchema.parse({
        id: 'headline',
        kind: 'text',
        sourceField: 'text',
        transformOrigin: 'center',
        box: {
          x: 10,
          y: 20,
          width: 300,
          height: 80,
        },
      behavior: {
        fitInBox: true,
        allCaps: true,
        minScaleX: 0.6,
        textAlign: 'left',
      },
    }),
  ).toEqual({
      id: 'headline',
      kind: 'text',
      sourceField: 'text',
      transformOrigin: 'center',
      box: {
        x: 10,
        y: 20,
        width: 300,
        height: 80,
      },
      behavior: {
        fitInBox: true,
        allCaps: true,
        minScaleX: 0.6,
        textAlign: 'left',
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
        background: {
          referenceImageId: 'lb-title-reference',
          opacity: 0.35,
        },
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
      background: {
        referenceImageId: 'lb-title-reference',
        opacity: 0.35,
        fitMode: 'contain',
        position: 'center',
      },
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

  it('rejects invalid preview template definitions with missing required dimensions', () => {
    expect(() =>
      previewTemplateDefinitionSchema.parse({
        id: 'broken-template',
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
    ).toThrow('designWidth')
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
          background: {
            referenceImageId: 'lb-title-reference',
            opacity: 0.5,
            fitMode: 'cover',
            position: 'center',
          },
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
              behavior: {
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
        background: {
          referenceImageId: 'lb-title-reference',
          opacity: 0.5,
          fitMode: 'cover',
          position: 'center',
        },
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
            behavior: {
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
        source: {
          type: 'csv',
          filePath: 'C:\\APlay\\sources\\evening.csv',
        },
        graphicConfigIds: ['title-main', 'person-lower-third'],
      }),
    ).toEqual({
      id: 'news-evening',
      label: 'Evening News',
      source: {
        type: 'csv',
        filePath: 'C:\\APlay\\sources\\evening.csv',
      },
      graphicConfigIds: ['title-main', 'person-lower-third'],
    })
  })

  it('allows a profile to start without a selected source file', () => {
    expect(
      showProfileConfigSchema.parse({
        id: 'news-morning',
        label: 'Morning News',
        source: {
          type: 'csv',
        },
        graphicConfigIds: ['title-main'],
      }),
    ).toEqual({
      id: 'news-morning',
      label: 'Morning News',
      source: {
        type: 'csv',
      },
      graphicConfigIds: ['title-main'],
    })
  })

  it('rejects invalid source type values for V1', () => {
    expect(() =>
      showProfileConfigSchema.parse({
        id: 'json-profile',
        label: 'JSON Profile',
        source: {
          type: 'json',
          filePath: 'C:\\APlay\\sources\\profile.json',
        },
        graphicConfigIds: ['title-main'],
      }),
    ).toThrow('source.type')
  })

  it('rejects blank source file paths when provided', () => {
    expect(() =>
      showProfileConfigSchema.parse({
        id: 'broken-profile',
        label: 'Broken Profile',
        source: {
          type: 'csv',
          filePath: '',
        },
        graphicConfigIds: ['title-main'],
      }),
    ).toThrow('source.filePath')
  })
})

describe('AppSettings/AppConfig schema', () => {
  it('loads multiple graphic element configs through the selected profile', () => {
    const parsed = appSettingsSchema.parse({
      selectedProfileId: 'news-evening',
      referenceImages: [
        {
          id: 'lb-title-reference',
          name: 'Title Reference',
          filePath: 'C:\\APlay\\references\\title.png',
        },
      ],
      profiles: [
        {
          id: 'news-evening',
          label: 'Evening News',
          source: {
            type: 'csv',
            filePath: 'C:\\APlay\\sources\\evening.csv',
          },
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
            background: {
              referenceImageId: 'lb-title-reference',
            },
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
                behavior: {
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
    expect(parsed.referenceImages).toEqual([
      {
        id: 'lb-title-reference',
        name: 'Title Reference',
        filePath: 'C:\\APlay\\references\\title.png',
      },
    ])
    expect(parsed.profiles[0]?.source).toEqual({
      type: 'csv',
      filePath: 'C:\\APlay\\sources\\evening.csv',
    })
    expect(parsed.profiles[0]?.graphicConfigIds).toEqual(['title-main', 'person-lower-third'])
    expect(parsed.graphics.map((graphic) => graphic.id)).toEqual(['title-main', 'person-lower-third'])
    expect(parsed.graphics[0]?.preview.background).toEqual({
      referenceImageId: 'lb-title-reference',
      opacity: 1,
      fitMode: 'contain',
      position: 'center',
    })
  })

  it('rejects a selected profile id that does not exist', () => {
    expect(() =>
      appSettingsSchema.parse({
        selectedProfileId: 'missing',
        profiles: [
          {
            id: 'news-evening',
            label: 'Evening News',
            source: {
              type: 'csv',
              filePath: 'C:\\APlay\\sources\\evening.csv',
            },
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
