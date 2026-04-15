import { describe, expect, it } from 'vitest'
import { sampleGraphicFiles, sampleSettings } from '@/features/workspace/data/sampleWorkspaceConfig'
import type { AppSettings, GraphicInstanceConfig } from '@/settings/models/appConfig'
import {
  graphicConfigExportType,
  graphicConfigExportVersion,
  parseGraphicConfigImport,
} from '@/settings/storage/graphicConfigExport'
import {
  createMemoryKeyValueStorage,
  createWorkspaceConfigRepository,
} from '@/settings/storage/workspaceConfigRepository'

const dynamicGraphicConfig: GraphicInstanceConfig = {
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
    { sourceField: 'number', targetField: 'slug' },
  ],
  preview: {
    id: 'dynamic-title-preview',
    designWidth: 1920,
    designHeight: 1080,
    background: {
      referenceImageId: 'ref-title',
      opacity: 0.4,
      fitMode: 'cover',
      position: 'center',
    },
    elements: [
      {
        id: 'headline',
        kind: 'text',
        sourceField: 'text',
        previewText: 'Breaking title',
        visible: true,
        transformOrigin: 'center',
        textColor: '#ffffff',
        box: {
          x: 100,
          y: 120,
          width: 900,
          height: 180,
        },
        behavior: {
          allCaps: true,
          fitInBox: true,
          minScaleX: 0.7,
          textAlign: 'center',
        },
      },
    ],
  },
  actions: [
    { actionType: 'playGraphic', label: 'Play' },
    { actionType: 'stopGraphic', label: 'Stop' },
    { actionType: 'resumeGraphic', label: 'Resume' },
  ],
}
const canonicalDynamicGraphicConfig = parseGraphicConfigImport(dynamicGraphicConfig)

const staticGraphicConfig: GraphicInstanceConfig = {
  id: 'static-bug',
  name: 'Static bug',
  entityType: 'image',
  kind: 'static',
  dataFileName: 'static-bug.json',
  staticAsset: {
    assetPath: 'C:\\APlay\\assets\\bugs\\news.png',
    assetType: 'image',
  },
  control: {
    play: '/graphics/bug/play',
    stop: '/graphics/bug/stop',
    resume: '/graphics/bug/resume',
  },
  preview: {
    id: 'static-bug-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      {
        id: 'bug-image',
        kind: 'image',
        sourceField: 'assetPath',
        previewText: 'C:\\APlay\\assets\\bugs\\news.png',
        visible: true,
        borderRadius: 12,
        box: {
          x: 1480,
          y: 60,
          width: 320,
          height: 180,
        },
      },
    ],
  },
  actions: [
    { actionType: 'playGraphic', label: 'Play' },
  ],
}

function createGraphicExportSettings(
  graphics: GraphicInstanceConfig[] = [dynamicGraphicConfig, staticGraphicConfig],
): AppSettings {
  return {
    selectedProfileId: 'news',
    referenceImages: [
      {
        id: 'ref-title',
        name: 'Title Reference',
        filePath: 'C:\\APlay\\references\\title.png',
      },
    ],
    sourceSchemas: [],
    profiles: [
      {
        id: 'news',
        label: 'News',
        graphicConfigIds: graphics.map((graphic) => graphic.id),
      },
    ],
    graphics,
  }
}

function exportGraphicConfig(
  graphic: GraphicInstanceConfig,
  storage = createMemoryKeyValueStorage(),
) {
  const repository = createWorkspaceConfigRepository(storage, {
    settings: createGraphicExportSettings([graphic]),
    graphicFiles: {},
  })

  const snapshot = repository.save(createGraphicExportSettings([graphic]))
  const fileName = `${graphic.id}.json`
  const rawContent = snapshot.graphicFiles[fileName]

  expect(rawContent).toBeDefined()

  return {
    storage,
    repository,
    snapshot,
    fileName,
    rawContent: rawContent as string,
    parsedContent: JSON.parse(rawContent as string) as Record<string, unknown>,
  }
}

describe('workspaceConfigRepository', () => {
  it('loads default settings and separate graphic files when storage is empty', () => {
    const repository = createWorkspaceConfigRepository(createMemoryKeyValueStorage(), {
      settings: sampleSettings,
      graphicFiles: sampleGraphicFiles,
    })

    const snapshot = repository.load()

    expect(snapshot.settings.selectedProfileId).toBe('default-news')
    expect(Object.keys(snapshot.graphicFiles)).toContain('title-main.json')
    expect(snapshot.settings.graphics).toHaveLength(sampleSettings.graphics.length)
  })

  it('persists updated graphics back into the separate graphic file map', () => {
    const storage = createMemoryKeyValueStorage()
    const repository = createWorkspaceConfigRepository(storage, {
      settings: sampleSettings,
      graphicFiles: sampleGraphicFiles,
    })

    const updatedSettings = {
      ...sampleSettings,
      graphics: sampleSettings.graphics.map((graphic) =>
        graphic.id === 'title-main'
          ? { ...graphic, datasourcePath: 'datasources/custom-title.json' }
          : graphic),
    }

    repository.save(updatedSettings)
    const reloaded = repository.load()

    expect(reloaded.settings.graphics.find((graphic) => graphic.id === 'title-main')?.datasourcePath)
      .toBe('datasources/custom-title.json')
    expect(reloaded.graphicFiles['title-main.json']).toContain('datasources/custom-title.json')
  })

  it('fails clearly when the persisted settings root file is invalid', () => {
    const storage = createMemoryKeyValueStorage({
      'aplay.settings.v1': '{invalid-json',
    })
    const repository = createWorkspaceConfigRepository(storage, {
      settings: sampleSettings,
      graphicFiles: sampleGraphicFiles,
    })

    expect(() => repository.load()).toThrow()
  })

  it('falls back to root settings when a separate graphic config file is invalid', () => {
    const storage = createMemoryKeyValueStorage({
      'aplay.graphic-config-files.v1': JSON.stringify({
        'title-main.json': '{invalid-json',
      }),
    })
    const repository = createWorkspaceConfigRepository(storage, {
      settings: sampleSettings,
      graphicFiles: sampleGraphicFiles,
    })

    const snapshot = repository.load()

    expect(snapshot.settings.graphics.find((graphic) => graphic.id === 'title-main')?.datasourcePath)
      .toBe('datasources/title-main.json')
  })

  it('applies the current safe id-conflict policy by replacing an existing library item only after the imported file validates', () => {
    const importedVariant = {
      ...sampleSettings.graphics.find((graphic) => graphic.id === 'title-main')!,
      datasourcePath: 'datasources/title-main-imported.json',
      preview: {
        ...sampleSettings.graphics.find((graphic) => graphic.id === 'title-main')!.preview,
        elements: [
          {
            ...sampleSettings.graphics.find((graphic) => graphic.id === 'title-main')!.preview.elements[0]!,
            previewText: 'Imported title variant',
          },
        ],
      },
    }
    const storage = createMemoryKeyValueStorage({
      'aplay.graphic-config-files.v1': JSON.stringify({
        'title-main.json': JSON.stringify({
          version: graphicConfigExportVersion,
          exportType: graphicConfigExportType,
          payload: importedVariant,
        }),
      }),
    })
    const repository = createWorkspaceConfigRepository(storage, {
      settings: sampleSettings,
      graphicFiles: sampleGraphicFiles,
    })

    const snapshot = repository.load()
    const resolvedGraphic = snapshot.settings.graphics.find((graphic) => graphic.id === 'title-main')

    expect(resolvedGraphic).toMatchObject({
      id: 'title-main',
      datasourcePath: 'datasources/title-main-imported.json',
    })
    expect(resolvedGraphic?.preview.elements[0]).toMatchObject({
      previewText: 'Imported title variant',
    })
  })

  it('preserves the existing library item when a same-id imported file is invalid', () => {
    const existingGraphic = sampleSettings.graphics.find((graphic) => graphic.id === 'title-main')!
    const canonicalExistingGraphic = parseGraphicConfigImport(existingGraphic)
    const storage = createMemoryKeyValueStorage({
      'aplay.graphic-config-files.v1': JSON.stringify({
        'title-main.json': JSON.stringify({
          version: graphicConfigExportVersion,
          exportType: graphicConfigExportType,
          payload: {
            ...existingGraphic,
            preview: {
              id: 'broken-preview',
              designWidth: 1920,
              designHeight: 1080,
              elements: [],
            },
          },
        }),
      }),
    })
    const repository = createWorkspaceConfigRepository(storage, {
      settings: sampleSettings,
      graphicFiles: sampleGraphicFiles,
    })

    const snapshot = repository.load()
    const resolvedGraphic = snapshot.settings.graphics.find((graphic) => graphic.id === 'title-main')

    expect(resolvedGraphic).toEqual(canonicalExistingGraphic)
    expect(resolvedGraphic?.preview.elements).toEqual(canonicalExistingGraphic.preview.elements)
  })

  it('exports a dynamic graphic config to JSON with the fields required to recreate it', () => {
    const exported = exportGraphicConfig(dynamicGraphicConfig)

    expect(exported.parsedContent).toMatchObject({
      version: graphicConfigExportVersion,
      exportType: graphicConfigExportType,
      payload: {
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
          { sourceField: 'number', targetField: 'slug' },
        ],
      },
    })
  })

  it('exports a static graphic config to JSON without depending on datasource-only fields', () => {
    const exported = exportGraphicConfig(staticGraphicConfig)

    expect(exported.parsedContent).toMatchObject({
      version: graphicConfigExportVersion,
      exportType: graphicConfigExportType,
      payload: {
        id: 'static-bug',
        entityType: 'image',
        dataFileName: 'static-bug.json',
        control: {
          play: '/graphics/bug/play',
          stop: '/graphics/bug/stop',
          resume: '/graphics/bug/resume',
        },
      },
    })
    expect((exported.parsedContent.payload as Record<string, unknown>)).not.toHaveProperty('datasourcePath')
    expect((exported.parsedContent.payload as Record<string, unknown>)).not.toHaveProperty('bindings')
  })

  it('includes version metadata in exported graphic config JSON', () => {
    const exported = exportGraphicConfig(dynamicGraphicConfig)

    expect(exported.parsedContent).toHaveProperty('version', graphicConfigExportVersion)
  })

  it('includes config type metadata that makes the export import-ready', () => {
    const exported = exportGraphicConfig(dynamicGraphicConfig)

    expect(exported.parsedContent).toHaveProperty('exportType', graphicConfigExportType)
  })

  it('preserves preview config in the exported JSON', () => {
    const exported = exportGraphicConfig(dynamicGraphicConfig)

    expect((exported.parsedContent.payload as GraphicInstanceConfig).preview).toEqual(dynamicGraphicConfig.preview)
  })

  it('preserves OSC mapping in the exported JSON', () => {
    const exported = exportGraphicConfig(dynamicGraphicConfig)

    expect((exported.parsedContent.payload as GraphicInstanceConfig).control).toEqual(dynamicGraphicConfig.control)
  })

  it('preserves datasource config when the graphic is dynamic', () => {
    const exported = exportGraphicConfig(dynamicGraphicConfig)

    expect((exported.parsedContent.payload as GraphicInstanceConfig).datasourcePath).toBe(dynamicGraphicConfig.datasourcePath)
  })

  it('preserves source bindings when they apply to the graphic', () => {
    const exported = exportGraphicConfig(dynamicGraphicConfig)

    expect((exported.parsedContent.payload as GraphicInstanceConfig).bindings).toEqual(dynamicGraphicConfig.bindings)
  })

  it('preserves static asset preview config when the graphic uses image elements', () => {
    const exported = exportGraphicConfig(staticGraphicConfig)
    const previewElements = (exported.parsedContent.payload as GraphicInstanceConfig).preview

    expect(previewElements.elements).toEqual(parseGraphicConfigImport(staticGraphicConfig).preview.elements)
  })

  it('preserves reference background config when it is configured', () => {
    const exported = exportGraphicConfig(dynamicGraphicConfig)
    const preview = (exported.parsedContent.payload as GraphicInstanceConfig).preview

    expect(preview.background).toEqual(dynamicGraphicConfig.preview.background)
  })

  it('exports stable, import-ready JSON that can be parsed repeatedly without live object state', () => {
    const graphic = structuredClone(dynamicGraphicConfig)
    const firstExport = exportGraphicConfig(graphic)

    graphic.preview.elements[0]!.previewText = 'Mutated after export'
    graphic.control.play = '/graphics/title/changed-after-export'

    const secondExport = exportGraphicConfig(dynamicGraphicConfig, firstExport.storage)

    expect(firstExport.rawContent).toBe(secondExport.rawContent)
    expect(parseGraphicConfigImport(JSON.parse(firstExport.rawContent))).toEqual(canonicalDynamicGraphicConfig)
  })

  it('handles invalid or incomplete graphic config export safely', () => {
    const storage = createMemoryKeyValueStorage()
    const repository = createWorkspaceConfigRepository(storage, {
      settings: createGraphicExportSettings([dynamicGraphicConfig]),
      graphicFiles: {},
    })

    repository.save(createGraphicExportSettings([dynamicGraphicConfig]))

    expect(() =>
      repository.save(createGraphicExportSettings([
        {
          id: 'broken-graphic',
          name: 'Broken graphic',
          entityType: 'title',
          dataFileName: 'broken-graphic.json',
          control: {
            play: '/graphics/broken/play',
            stop: '/graphics/broken/stop',
            resume: '/graphics/broken/resume',
          },
          actions: [{ actionType: 'playGraphic', label: 'Play' }],
        } as GraphicInstanceConfig,
      ])),
    ).toThrow('preview')

    const reloaded = repository.load()

    expect(reloaded.settings.graphics).toEqual([canonicalDynamicGraphicConfig])
    expect(parseGraphicConfigImport(JSON.parse(reloaded.graphicFiles['dynamic-title.json'] as string))).toEqual(canonicalDynamicGraphicConfig)
    expect(reloaded.graphicFiles).not.toHaveProperty('broken-graphic.json')
  })
})
