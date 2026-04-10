import { describe, expect, it } from 'vitest'
import {
  actionButtonConfigSchema,
  appSettingsSchema,
  csvBlockDetectionConfigSchema,
  csvSourceSchemaConfigSchema,
  graphicControlConfigSchema,
  graphicInstanceConfigSchema,
  previewElementDefinitionSchema,
  previewBackgroundConfigSchema,
  previewTemplateDefinitionSchema,
  referenceImageAssetSchema,
  showProfileConfigSchema,
} from '@/settings/schemas/appConfigSchemas'

const imageGraphicConfig = {
  id: 'channel-static-image',
  name: 'Channel static image',
  entityType: 'image',
  dataFileName: 'channel-static-image.json',
  staticAsset: {
    assetPath: 'C:\\APlay\\assets\\branding\\channel-static-image.png',
    assetType: 'image',
  },
  control: {
    play: '/graphics/static-image/play',
    stop: '/graphics/static-image/stop',
    resume: '/graphics/static-image/resume',
  },
  preview: {
    id: 'channel-static-image-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      {
        id: 'static-image',
        kind: 'image',
        sourceField: 'staticAsset',
        previewText: 'C:\\APlay\\assets\\branding\\channel-static-image.png',
        box: {
          x: 40,
          y: 40,
          width: 200,
          height: 120,
        },
      },
    ],
  },
  actions: [{ actionType: 'playGraphic', label: 'Play' }],
} as const

describe('CsvSourceSchemaConfig schema', () => {
  it('parses a configurable CSV source schema with delimiter, header, block detection, and entity mappings', () => {
    expect(
      csvSourceSchemaConfigSchema.parse({
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
      }),
    ).toEqual({
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
    })
  })
})

describe('CSV block detection config', () => {
  it('parses block detection using a source column plus regex', () => {
    expect(
      csvBlockDetectionConfigSchema.parse({
        mode: 'columnRegex',
        sourceColumn: 'Nr',
        pattern: '^---\\s*(.+?)\\s*---$',
      }),
    ).toEqual({
      mode: 'columnRegex',
      sourceColumn: 'Nr',
      pattern: '^---\\s*(.+?)\\s*---$',
    })
  })

  it('rejects invalid regex patterns safely', () => {
    expect(() =>
      csvBlockDetectionConfigSchema.parse({
        mode: 'columnRegex',
        sourceColumn: 'Nr',
        pattern: '[',
      }),
    ).toThrow('pattern')
  })
})

describe('CSV entity mapping config', () => {
  it('allows optional disabled entity mappings without field definitions', () => {
    expect(
      csvSourceSchemaConfigSchema.parse({
        id: 'csv-disabled-mappings',
        name: 'Disabled mappings',
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
            enabled: false,
          },
          supertitle: {
            enabled: false,
          },
          person: {
            enabled: false,
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
      }).entityMappings.phone,
    ).toEqual({
      enabled: false,
    })
  })

  it('requires required source columns when an entity mapping is enabled', () => {
    expect(() =>
      csvSourceSchemaConfigSchema.parse({
        id: 'csv-invalid-title-mapping',
        name: 'Invalid title mapping',
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
            },
          },
          supertitle: {
            enabled: false,
          },
          person: {
            enabled: false,
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
      }),
    ).toThrow('title')
  })
})

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

  it('allows template-only graphic control config when OSC is defined globally', () => {
    expect(
      graphicControlConfigSchema.parse({
        templateName: 'LOWER_THIRD_01',
      }),
    ).toEqual({
      templateName: 'LOWER_THIRD_01',
    })
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
        name: 'Main title',
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
      name: 'Main title',
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
        name: 'Ticker',
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

  it('supports zIndex on graphic configs', () => {
    expect(
      graphicInstanceConfigSchema.parse({
        id: 'title-main',
        name: 'Main title',
        zIndex: 7,
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
            },
          ],
        },
        actions: [{ actionType: 'playGraphic', label: 'Play' }],
      }).zIndex,
    ).toBe(7)
  })

  it('allows missing zIndex and lets preview logic apply the safe default', () => {
    expect(
      graphicInstanceConfigSchema.parse({
        id: 'title-main',
        name: 'Main title',
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
            },
          ],
        },
        actions: [{ actionType: 'playGraphic', label: 'Play' }],
      }),
    ).not.toHaveProperty('zIndex')
  })

  it('requires both id and name for every graphic config', () => {
    expect(() =>
      graphicInstanceConfigSchema.parse({
        name: 'Main title',
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
            },
          ],
        },
        actions: [{ actionType: 'playGraphic', label: 'Play' }],
      }),
    ).toThrow('id')

    expect(() =>
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
            },
          ],
        },
        actions: [{ actionType: 'playGraphic', label: 'Play' }],
      }),
    ).toThrow('name')
  })

  it('requires a non-empty trimmed human-readable name', () => {
    expect(() =>
      graphicInstanceConfigSchema.parse({
        id: 'title-main',
        name: '',
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
            },
          ],
        },
        actions: [{ actionType: 'playGraphic', label: 'Play' }],
      }),
    ).toThrow('name')

    expect(
      (graphicInstanceConfigSchema.parse({
        id: 'title-main',
        name: '  Main title  ',
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
            },
          ],
        },
        actions: [{ actionType: 'playGraphic', label: 'Play' }],
      }) as unknown as Record<string, unknown>).name,
    ).toBe('Main title')
  })

  it('rejects invalid or missing names without silently falling back to id', () => {
    expect(() =>
      graphicInstanceConfigSchema.parse({
        id: 'title-main',
        name: '   ',
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
            },
          ],
        },
        actions: [{ actionType: 'playGraphic', label: 'Play' }],
      }),
    ).toThrow('name')
  })

  it('allows static entity types without sourceBinding config', () => {
    const parsed = graphicInstanceConfigSchema.parse(imageGraphicConfig as unknown)

    expect(parsed).not.toHaveProperty('bindings')
  })

  it('allows static entity types without datasource config', () => {
    const parsed = graphicInstanceConfigSchema.parse(imageGraphicConfig as unknown)

    expect(parsed).not.toHaveProperty('datasourcePath')
  })

  it('supports staticAsset config for static graphic entity types', () => {
    const parsed = graphicInstanceConfigSchema.parse(imageGraphicConfig as unknown) as unknown as Record<string, unknown>

    expect(parsed).toHaveProperty('staticAsset')
    expect(parsed.staticAsset).toEqual({
      assetPath: 'C:\\APlay\\assets\\branding\\channel-static-image.png',
      assetType: 'image',
    })
  })

  it('allows static graphic configs without datasource when staticAsset is present', () => {
    expect(
      graphicInstanceConfigSchema.parse(imageGraphicConfig as unknown),
    ).toMatchObject({
      id: 'channel-static-image',
      entityType: 'image',
    })
  })

  it('normalizes legacy staticImage entity types to image', () => {
    expect(
      graphicInstanceConfigSchema.parse({
        ...imageGraphicConfig,
        entityType: 'staticImage',
      } as unknown),
    ).toMatchObject({
      id: 'channel-static-image',
      entityType: 'image',
    })
  })

  it('rejects static graphic configs when staticAsset is missing', () => {
    expect(() =>
      graphicInstanceConfigSchema.parse({
        ...imageGraphicConfig,
        staticAsset: undefined,
      } as unknown),
    ).toThrow('staticAsset')
  })

  it('rejects static graphic configs when staticAsset path is invalid', () => {
    expect(() =>
      graphicInstanceConfigSchema.parse({
        ...imageGraphicConfig,
        staticAsset: {
          assetPath: '',
          assetType: 'image',
        },
      } as unknown),
    ).toThrow('staticAsset')
  })

  it('keeps OSC config optional-but-valid for static graphic configs when present', () => {
    expect(
      graphicInstanceConfigSchema.parse(imageGraphicConfig as unknown),
    ).toMatchObject({
      control: {
        play: '/graphics/static-image/play',
        stop: '/graphics/static-image/stop',
        resume: '/graphics/static-image/resume',
      },
    })
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
          schemaId: 'csv-news-default',
        },
        graphicConfigIds: ['title-main', 'person-lower-third'],
      }),
    ).toEqual({
      id: 'news-evening',
      label: 'Evening News',
      source: {
        type: 'csv',
        filePath: 'C:\\APlay\\sources\\evening.csv',
        schemaId: 'csv-news-default',
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
          schemaId: 'csv-news-default',
        },
        graphicConfigIds: ['title-main'],
      }),
    ).toEqual({
      id: 'news-morning',
      label: 'Morning News',
      source: {
        type: 'csv',
        schemaId: 'csv-news-default',
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
          id: 'news-evening',
          label: 'Evening News',
          source: {
            type: 'csv',
            filePath: 'C:\\APlay\\sources\\evening.csv',
            schemaId: 'csv-news-default',
          },
          graphicConfigIds: ['title-main', 'person-lower-third'],
        },
      ],
      graphics: [
        {
          id: 'title-main',
          name: 'Main title',
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
          name: 'Person lower third',
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
    expect(parsed.sourceSchemas[0]?.id).toBe('csv-news-default')
    expect(parsed.profiles[0]?.source).toEqual({
      type: 'csv',
      filePath: 'C:\\APlay\\sources\\evening.csv',
      schemaId: 'csv-news-default',
    })
    expect(parsed.profiles[0]?.graphicConfigIds).toEqual(['title-main', 'person-lower-third'])
    expect(parsed.graphics.map((graphic) => graphic.id)).toEqual(['title-main', 'person-lower-third'])
    expect((parsed.graphics as unknown as Array<Record<string, unknown>>).map((graphic) => graphic.name))
      .toEqual(['Main title', 'Person lower third'])
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
        sourceSchemas: [],
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
          name: 'Main title',
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
        sourceSchemas: [],
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

  it('keeps CSV schema association separate from preview, OSC, and publish config', () => {
    const parsed = appSettingsSchema.parse({
      selectedProfileId: 'news-evening',
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
            supertitle: { enabled: false },
            person: { enabled: false },
            location: { enabled: false },
            breakingNews: { enabled: false },
            waitingTitle: { enabled: false },
            waitingLocation: { enabled: false },
            phone: { enabled: false },
          },
        },
      ],
      profiles: [
        {
          id: 'news-evening',
          label: 'Evening News',
          source: {
            type: 'csv',
            filePath: 'C:\\APlay\\sources\\evening.csv',
            schemaId: 'csv-news-default',
          },
          graphicConfigIds: ['title-main'],
        },
      ],
      graphics: [
        {
          id: 'title-main',
          name: 'Main title',
          entityType: 'title',
          dataFileName: 'title.json',
          datasourcePath: 'datasources/title.json',
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
          bindings: [{ sourceField: 'text', targetField: 'headline', required: true }],
          actions: [{ actionType: 'playGraphic', label: 'Play' }],
        },
      ],
    })

    expect(parsed.sourceSchemas[0]).not.toHaveProperty('preview')
    expect(parsed.sourceSchemas[0]).not.toHaveProperty('control')
    expect(parsed.sourceSchemas[0]).not.toHaveProperty('bindings')
  })
})
