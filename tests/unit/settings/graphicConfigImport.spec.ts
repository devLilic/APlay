import { describe, expect, it, vi } from 'vitest'
import type { AppSettings, GraphicInstanceConfig } from '@/settings/models/appConfig'
import {
  createGraphicConfigFileLoadService,
  importGraphicConfigToLibrary,
  parseGraphicConfigImportContent,
} from '@/settings/storage/graphicConfigImport'
import { serializeGraphicConfigExport } from '@/settings/storage/graphicConfigExport'
import {
  createMemoryKeyValueStorage,
  createWorkspaceConfigRepository,
} from '@/settings/storage/workspaceConfigRepository'

const existingGraphic: GraphicInstanceConfig = {
  id: 'title-main',
  entityType: 'title',
  dataFileName: 'title-main.json',
  datasourcePath: 'datasources/title-main.json',
  control: {
    templateName: 'TITLE_MAIN',
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
          y: 150,
          width: 900,
          height: 180,
        },
      },
    ],
  },
  actions: [{ actionType: 'playGraphic', label: 'Play' }],
}

const importedDynamicGraphic: GraphicInstanceConfig = {
  id: 'title-main',
  entityType: 'title',
  dataFileName: 'title-main.json',
  datasourcePath: 'datasources/title-main.json',
  control: {
    templateName: 'TITLE_IMPORT',
    play: '/graphics/imported-title/play',
    stop: '/graphics/imported-title/stop',
    resume: '/graphics/imported-title/resume',
  },
  bindings: [{ sourceField: 'text', targetField: 'headline', required: true }],
  preview: {
    id: 'title-import-preview',
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
        previewText: 'Imported title',
        box: {
          x: 120,
          y: 180,
          width: 960,
          height: 180,
        },
      },
    ],
  },
  actions: [{ actionType: 'playGraphic', label: 'Play' }],
}

function createSettingsFixture(graphics: GraphicInstanceConfig[] = [existingGraphic]): AppSettings {
  return {
    selectedProfileId: 'news',
    referenceImages: [
      {
        id: 'ref-title',
        name: 'Title Reference',
        filePath: 'C:\\APlay\\refs\\title.png',
      },
    ],
    sourceSchemas: [],
    profiles: [
      {
        id: 'news',
        label: 'News',
        graphicConfigIds: ['title-main'],
      },
    ],
    graphics,
  }
}

describe('graphicConfigImport', () => {
  it('loads a graphic config JSON file through the file loader service', async () => {
    const loadService = createGraphicConfigFileLoadService({
      readFile: async () => serializeGraphicConfigExport(importedDynamicGraphic),
    })

    await expect(loadService.load('C:\\Imports\\title-main.json')).resolves.toMatchObject({
      id: 'title-main',
      control: {
        templateName: 'TITLE_IMPORT',
      },
      preview: {
        id: 'title-import-preview',
      },
    })
  })

  it('rejects invalid graphic config JSON file content safely', () => {
    expect(() => parseGraphicConfigImportContent('{invalid-json')).toThrow('Invalid graphic config JSON')
  })

  it('adds an imported graphic to the library only after successful validation', () => {
    const addedGraphic = {
      ...importedDynamicGraphic,
      id: 'title-extra',
      dataFileName: 'title-extra.json',
      datasourcePath: 'datasources/title-extra.json',
    }

    const result = importGraphicConfigToLibrary({
      content: serializeGraphicConfigExport(addedGraphic),
      settings: createSettingsFixture(),
      graphicFiles: {},
    })

    expect(result.status).toBe('added')
    expect(result.settings.graphics.map((graphic) => graphic.id)).toEqual(['title-main', 'title-extra'])
    expect(result.graphicFiles['title-extra.json']).toContain('"exportType": "graphic-config"')
  })

  it('replaces an existing graphic safely when the conflict policy is replace', () => {
    const result = importGraphicConfigToLibrary({
      content: serializeGraphicConfigExport(importedDynamicGraphic),
      settings: createSettingsFixture(),
      graphicFiles: {},
    }, {
      conflictPolicy: 'replace',
    })

    expect(result.status).toBe('replaced')
    expect(result.importedGraphic.control.templateName).toBe('TITLE_IMPORT')
    expect(result.settings.graphics).toHaveLength(1)
    expect(result.settings.graphics[0]).toMatchObject({
      id: 'title-main',
      control: {
        templateName: 'TITLE_IMPORT',
      },
    })
  })

  it('preserves the existing graphic when the conflict policy is preserve', () => {
    const result = importGraphicConfigToLibrary({
      content: serializeGraphicConfigExport(importedDynamicGraphic),
      settings: createSettingsFixture(),
      graphicFiles: {},
    }, {
      conflictPolicy: 'preserve',
    })

    expect(result.status).toBe('preserved')
    expect(result.settings.graphics).toHaveLength(1)
    expect(result.settings.graphics[0]).toMatchObject({
      id: 'title-main',
      control: {
        templateName: 'TITLE_MAIN',
      },
    })
  })

  it('duplicates the imported graphic with a new safe id when the conflict policy is duplicate', () => {
    const result = importGraphicConfigToLibrary({
      content: serializeGraphicConfigExport(importedDynamicGraphic),
      settings: createSettingsFixture(),
      graphicFiles: {},
    }, {
      conflictPolicy: 'duplicate',
    })

    expect(result.status).toBe('duplicated')
    expect(result.settings.graphics.map((graphic) => graphic.id)).toEqual(['title-main', 'title-main-2'])
    expect(result.importedGraphic).toMatchObject({
      id: 'title-main-2',
      dataFileName: 'title-main-2.json',
      datasourcePath: 'datasources\\title-main-2.json',
    })
  })

  it('does not mutate the original library when import validation fails', () => {
    const initialSettings = createSettingsFixture()
    const initialGraphics = structuredClone(initialSettings.graphics)

    expect(() =>
      importGraphicConfigToLibrary({
        content: JSON.stringify({
          version: 1,
          exportType: 'graphic-config',
          payload: {
            id: 'broken',
            entityType: 'title',
          },
        }),
        settings: initialSettings,
        graphicFiles: {},
      })
    ).toThrow()

    expect(initialSettings.graphics).toEqual(initialGraphics)
  })

  it('keeps import logic free of runtime side effects such as OSC, datasource publishing, or playback actions', async () => {
    const readFile = vi.fn(async () => serializeGraphicConfigExport(importedDynamicGraphic))
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const loadService = createGraphicConfigFileLoadService({ readFile })

    const imported = await loadService.load('C:\\Imports\\title-main.json')

    expect(readFile).toHaveBeenCalledTimes(1)
    expect(imported.id).toBe('title-main')
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('workspaceConfigRepository graphic import', () => {
  it('persists a successfully imported graphic into the local library', () => {
    const storage = createMemoryKeyValueStorage()
    const repository = createWorkspaceConfigRepository(storage, {
      settings: createSettingsFixture(),
      graphicFiles: {},
    })

    const snapshot = repository.importGraphicConfig(
      serializeGraphicConfigExport({
        ...importedDynamicGraphic,
        id: 'title-extra',
        dataFileName: 'title-extra.json',
        datasourcePath: 'datasources/title-extra.json',
      }),
    )

    expect(snapshot.settings.graphics.map((graphic) => graphic.id)).toEqual(['title-main', 'title-extra'])
    expect(snapshot.graphicFiles['title-extra.json']).toContain('"id": "title-extra"')
  })

  it('does not corrupt persisted storage when an import is invalid', () => {
    const storage = createMemoryKeyValueStorage()
    const repository = createWorkspaceConfigRepository(storage, {
      settings: createSettingsFixture(),
      graphicFiles: {},
    })
    const before = repository.save(createSettingsFixture())

    expect(() =>
      repository.importGraphicConfig('{"version":1,"exportType":"graphic-config","payload":{"id":"broken"}}')
    ).toThrow()

    const after = repository.load()

    expect(after).toEqual(before)
  })
})
