import { describe, expect, it, vi } from 'vitest'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import {
  createGraphicConfigExportEnvelope,
  createGraphicConfigFileSaveService,
  graphicConfigExportType,
  graphicConfigExportVersion,
  parseGraphicConfigImport,
  serializeGraphicConfigExport,
} from '@/settings/storage/graphicConfigExport'

const dynamicGraphicConfig: GraphicInstanceConfig = {
  id: 'dynamic-title',
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
}

const staticGraphicConfig: GraphicInstanceConfig = {
  id: 'static-logo',
  entityType: 'breakingNews',
  dataFileName: 'static-logo.json',
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
}

describe('graphicConfigExport', () => {
  it('serializes a dynamic graphic config into a versioned, typed export envelope', () => {
    const exported = JSON.parse(serializeGraphicConfigExport(dynamicGraphicConfig)) as Record<string, unknown>

    expect(exported).toMatchObject({
      version: graphicConfigExportVersion,
      exportType: graphicConfigExportType,
      payload: {
        id: 'dynamic-title',
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

  it('keeps legacy raw graphic config JSON importable for backward compatibility', () => {
    expect(parseGraphicConfigImport(dynamicGraphicConfig)).toEqual(
      createGraphicConfigExportEnvelope(dynamicGraphicConfig).payload,
    )
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

  it('rejects incomplete export payloads safely', () => {
    expect(() =>
      serializeGraphicConfigExport({
        id: 'broken',
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
