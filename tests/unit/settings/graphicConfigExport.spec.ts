import { describe, expect, it, vi } from 'vitest'
import {
  createGraphicConfigExportEnvelope,
  createGraphicConfigFileSaveService,
  graphicConfigExportType,
  graphicConfigExportVersion,
  parseGraphicConfigImport,
  serializeGraphicConfigExport,
} from '@/settings/storage/graphicConfigExport'

const dynamicGraphicConfig = {
  id: 'dynamic-title',
  name: 'Dynamic title',
  entityType: 'title',
  dataFileName: 'dynamic-title.json',
  datasourcePath: 'datasources/dynamic-title.json',
  control: {
    play: '/graphics/title/play',
    stop: '/graphics/title/stop',
    resume: '/graphics/title/resume',
  },
  bindings: [
    { sourceField: 'text', targetField: 'headline', required: true },
  ],
  preview: {
    id: 'dynamic-title-preview',
    designWidth: 1920,
    designHeight: 1080,
    background: {
      referenceImageId: 'ref-title',
      opacity: 0.35,
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
          y: 180,
          width: 900,
          height: 180,
        },
      },
    ],
  },
  actions: [{ actionType: 'playGraphic', label: 'Play' }],
} as const

const staticGraphicConfig = {
  id: 'static-logo',
  name: 'Static logo',
  entityType: 'image',
  kind: 'static',
  dataFileName: 'static-logo.json',
  staticAsset: {
    assetPath: 'C:\\APlay\\assets\\logo.png',
    assetType: 'image',
  },
  control: {
    play: '/graphics/logo/play',
    stop: '/graphics/logo/stop',
    resume: '/graphics/logo/resume',
  },
  preview: {
    id: 'static-logo-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      {
        id: 'logo',
        kind: 'image',
        sourceField: 'assetPath',
        previewText: 'C:\\APlay\\assets\\logo.png',
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

describe('graphicConfigExport', () => {
  it('serializes a dynamic graphic config into a versioned, typed export envelope', () => {
    const exported = JSON.parse(serializeGraphicConfigExport(dynamicGraphicConfig)) as Record<string, unknown>

    expect(exported).toMatchObject({
      version: graphicConfigExportVersion,
      exportType: graphicConfigExportType,
      payload: {
        id: 'dynamic-title',
        name: 'Dynamic title',
        datasourcePath: 'datasources/dynamic-title.json',
        bindings: [{ sourceField: 'text', targetField: 'headline', required: true }],
      },
    })
  })

  it('serializes a static graphic config into the same import-ready envelope format', () => {
    const exported = createGraphicConfigExportEnvelope(staticGraphicConfig)

    expect(exported).toEqual({
      version: graphicConfigExportVersion,
      exportType: graphicConfigExportType,
      payload: parseGraphicConfigImport(staticGraphicConfig),
    })
  })

  it('parses wrapped exports back into reusable graphic configs', () => {
    const wrapped = createGraphicConfigExportEnvelope(dynamicGraphicConfig)

    expect(parseGraphicConfigImport(wrapped)).toEqual(wrapped.payload)
  })

  it('imports a valid dynamic graphic config JSON', () => {
    const imported = parseGraphicConfigImport(JSON.parse(serializeGraphicConfigExport(dynamicGraphicConfig)))

    expect(imported).toEqual(parseGraphicConfigImport(dynamicGraphicConfig))
  })

  it('includes the display name in saved graphic config serialization', () => {
    const exported = createGraphicConfigExportEnvelope(dynamicGraphicConfig as never) as unknown as Record<string, unknown>
    const payload = exported.payload as Record<string, unknown>

    expect(payload.name).toBe('Dynamic title')
  })

  it('imports a valid static graphic config JSON', () => {
    const imported = parseGraphicConfigImport(JSON.parse(serializeGraphicConfigExport(staticGraphicConfig)))

    expect(imported).toEqual(parseGraphicConfigImport(staticGraphicConfig))
  })

  it('keeps legacy raw graphic config JSON importable for backward compatibility', () => {
    expect(parseGraphicConfigImport(dynamicGraphicConfig)).toEqual(
      createGraphicConfigExportEnvelope(dynamicGraphicConfig).payload,
    )
  })

  it('requires version, export type metadata, and payload when the wrapped import format is used', () => {
    expect(() =>
      parseGraphicConfigImport({
        exportType: graphicConfigExportType,
        payload: dynamicGraphicConfig,
      }),
    ).toThrow('version')

    expect(() =>
      parseGraphicConfigImport({
        version: graphicConfigExportVersion,
        payload: dynamicGraphicConfig,
      }),
    ).toThrow('type')

    expect(() =>
      parseGraphicConfigImport({
        version: graphicConfigExportVersion,
        exportType: graphicConfigExportType,
      }),
    ).toThrow('payload')
  })

  it('rejects invalid export types', () => {
    expect(() =>
      parseGraphicConfigImport({
        version: graphicConfigExportVersion,
        exportType: 'profile-config',
        payload: dynamicGraphicConfig,
      }),
    ).toThrow('type')
  })

  it('rejects unsupported export versions safely', () => {
    expect(() =>
      parseGraphicConfigImport({
        version: 99,
        exportType: graphicConfigExportType,
        payload: dynamicGraphicConfig,
      }),
    ).toThrow('version')
  })

  it('rejects missing versions safely when the import looks like a wrapped export', () => {
    expect(() =>
      parseGraphicConfigImport({
        exportType: graphicConfigExportType,
        payload: dynamicGraphicConfig,
      }),
    ).toThrow('version')
  })

  it('rejects incomplete export payloads safely', () => {
    expect(() =>
      serializeGraphicConfigExport({
        id: 'broken',
        name: 'Broken graphic',
        entityType: 'title',
        control: {
          play: '/graphics/broken/play',
          stop: '/graphics/broken/stop',
          resume: '/graphics/broken/resume',
        },
        preview: {
          id: 'broken-preview',
          designWidth: 1920,
          designHeight: 1080,
          elements: [
            {
              id: 'headline',
              kind: 'text',
              sourceField: 'text',
              box: {
                x: 0,
                y: 0,
                width: 100,
                height: 40,
              },
            },
          ],
        },
        actions: [{ actionType: 'playGraphic', label: 'Play' }],
      }),
    ).toThrow('dataFileName')
  })

  it('rejects wrapped imports when required config fields are missing', () => {
    expect(() =>
      parseGraphicConfigImport({
        version: graphicConfigExportVersion,
        exportType: graphicConfigExportType,
        payload: {
          id: 'broken',
          name: 'Broken graphic',
          entityType: 'title',
          dataFileName: 'broken.json',
          control: {
            play: '/graphics/broken/play',
            stop: '/graphics/broken/stop',
            resume: '/graphics/broken/resume',
          },
          actions: [{ actionType: 'playGraphic', label: 'Play' }],
        },
      }),
    ).toThrow('preview')
  })

  it('restores preview config from import', () => {
    const imported = parseGraphicConfigImport(JSON.parse(serializeGraphicConfigExport(dynamicGraphicConfig)))

    expect(imported.preview).toEqual(parseGraphicConfigImport(dynamicGraphicConfig).preview)
  })

  it('restores OSC config from import', () => {
    const imported = parseGraphicConfigImport(JSON.parse(serializeGraphicConfigExport(dynamicGraphicConfig)))

    expect(imported.control).toEqual(dynamicGraphicConfig.control)
  })

  it('restores datasource config from import when applicable', () => {
    const imported = parseGraphicConfigImport(JSON.parse(serializeGraphicConfigExport(dynamicGraphicConfig)))

    expect(imported.datasourcePath).toBe(dynamicGraphicConfig.datasourcePath)
  })

  it('restores source binding config from import when applicable', () => {
    const imported = parseGraphicConfigImport(JSON.parse(serializeGraphicConfigExport(dynamicGraphicConfig)))

    expect(imported.bindings).toEqual(dynamicGraphicConfig.bindings)
  })

  it('preserves graphic collection display field configuration across export and import', () => {
    const imported = parseGraphicConfigImport(JSON.parse(serializeGraphicConfigExport({
      ...dynamicGraphicConfig,
      bindings: [
        { sourceField: 'Nr', targetField: 'number', required: true },
        { sourceField: 'Nume', targetField: 'name', required: true },
        { sourceField: 'Functie', targetField: 'role' },
        { sourceField: 'Locatie', targetField: 'location' },
      ],
      collectionDisplay: {
        primarySourceField: 'Nume',
        secondarySourceField: 'Functie',
      },
    } as unknown)))

    expect(imported).toMatchObject({
      collectionDisplay: {
        primarySourceField: 'Nume',
        secondarySourceField: 'Functie',
      },
    })
  })

  it('restores static asset config from import when applicable', () => {
    const imported = parseGraphicConfigImport(JSON.parse(serializeGraphicConfigExport(staticGraphicConfig)))

    expect(imported.preview.elements).toEqual(parseGraphicConfigImport(staticGraphicConfig).preview.elements)
  })

  it('restores reference background config from import when applicable', () => {
    const imported = parseGraphicConfigImport(JSON.parse(serializeGraphicConfigExport(dynamicGraphicConfig)))

    expect(imported.preview.background).toEqual(dynamicGraphicConfig.preview.background)
  })

  it('does not execute OSC or publish datasource files during import parsing', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const rawImport = JSON.parse(serializeGraphicConfigExport(dynamicGraphicConfig))

    const imported = parseGraphicConfigImport(rawImport)

    expect(imported).toEqual(parseGraphicConfigImport(dynamicGraphicConfig))
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('graphicConfigFileSaveService', () => {
  it('writes one validated graphic config export file', async () => {
    const pickFilePath = vi.fn(async () => 'C:\\Exports\\dynamic-title.json')
    const writeFile = vi.fn(async () => undefined)
    const service = createGraphicConfigFileSaveService({
      pickFilePath,
      writeFile,
    })

    const result = await service.save(dynamicGraphicConfig)

    expect(result).toEqual({
      status: 'saved',
      filePath: 'C:\\Exports\\dynamic-title.json',
      content: serializeGraphicConfigExport(dynamicGraphicConfig),
    })
    expect(pickFilePath).toHaveBeenCalledWith('dynamic-title.json')
    expect(writeFile).toHaveBeenCalledWith(
      'C:\\Exports\\dynamic-title.json',
      serializeGraphicConfigExport(dynamicGraphicConfig),
    )
  })

  it('does not write a file when export is cancelled', async () => {
    const writeFile = vi.fn(async () => undefined)
    const service = createGraphicConfigFileSaveService({
      pickFilePath: async () => null,
      writeFile,
    })

    const result = await service.save(dynamicGraphicConfig)

    expect(result).toEqual({
      status: 'cancelled',
      filePath: null,
      content: null,
    })
    expect(writeFile).not.toHaveBeenCalled()
  })
})
