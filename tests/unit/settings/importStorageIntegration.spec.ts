import { describe, expect, it } from 'vitest'
import type {
  AppSettings,
  CsvSourceSchemaConfig,
  GraphicInstanceConfig,
  ReferenceImageAsset,
  ShowProfileConfig,
} from '@/settings/models/appConfig'
import { serializeGraphicConfigExport } from '@/settings/storage/graphicConfigExport'
import { serializeProfileConfigExport } from '@/settings/storage/profileConfigExport'
import {
  createMemoryKeyValueStorage,
  createWorkspaceConfigRepository,
} from '@/settings/storage/workspaceConfigRepository'

const baseGraphic: GraphicInstanceConfig = {
  id: 'existing-title',
  name: 'Existing title',
  entityType: 'title',
  dataFileName: 'existing-title.json',
  datasourcePath: 'datasources/existing-title.json',
  control: {
    templateName: 'EXISTING_TITLE',
    play: '/graphics/existing-title/play',
    stop: '/graphics/existing-title/stop',
    resume: '/graphics/existing-title/resume',
  },
  bindings: [{ sourceField: 'text', targetField: 'headline', required: true }],
  preview: {
    id: 'existing-title-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      {
        id: 'headline',
        kind: 'text',
        sourceField: 'text',
        box: {
          x: 100,
          y: 120,
          width: 900,
          height: 160,
        },
      },
    ],
  },
  actions: [{ actionType: 'playGraphic', label: 'Play' }],
}

const importedGraphic: GraphicInstanceConfig = {
  id: 'imported-title',
  name: 'Imported title',
  entityType: 'title',
  dataFileName: 'imported-title.json',
  datasourcePath: 'datasources/imported-title.json',
  control: {
    templateName: 'IMPORTED_TITLE',
    play: '/graphics/imported-title/play',
    stop: '/graphics/imported-title/stop',
    resume: '/graphics/imported-title/resume',
  },
  bindings: [{ sourceField: 'text', targetField: 'headline', required: true }],
  preview: {
    id: 'imported-title-preview',
    designWidth: 1920,
    designHeight: 1080,
    background: {
      referenceImageId: 'ref-imported-title',
      opacity: 0.35,
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
          x: 80,
          y: 110,
          width: 960,
          height: 180,
        },
      },
    ],
  },
  actions: [{ actionType: 'playGraphic', label: 'Play' }],
}

const importedSchema: CsvSourceSchemaConfig = {
  id: 'csv-imported-news',
  name: 'Imported news CSV',
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
      enabled: false,
    },
    location: {
      enabled: false,
    },
    phone: {
      enabled: false,
    },
  },
}

const importedReferenceImage: ReferenceImageAsset = {
  id: 'ref-imported-title',
  name: 'Imported Title Reference',
  filePath: 'C:\\APlay\\references\\imported-title.png',
}

const importedProfile: ShowProfileConfig = {
  id: 'imported-news',
  label: 'Imported News',
  source: {
    type: 'csv',
    filePath: 'C:\\APlay\\sources\\imported-news.csv',
    schemaId: 'csv-imported-news',
  },
  graphicConfigIds: ['imported-title'],
}

function createBaseSettings(): AppSettings {
  return {
    selectedProfileId: 'default',
    referenceImages: [],
    sourceSchemas: [],
    profiles: [
      {
        id: 'default',
        label: 'Default',
        source: {
          type: 'csv',
        },
        graphicConfigIds: ['existing-title'],
      },
    ],
    graphics: [baseGraphic],
  }
}

function readPersistedSettings(storage: ReturnType<typeof createMemoryKeyValueStorage>): AppSettings {
  const rawContent = storage.getItem('aplay.settings.v1')
  expect(rawContent).not.toBeNull()
  return JSON.parse(rawContent as string) as AppSettings
}

function readPersistedGraphicFiles(storage: ReturnType<typeof createMemoryKeyValueStorage>): Record<string, string> {
  const rawContent = storage.getItem('aplay.graphic-config-files.v1')
  expect(rawContent).not.toBeNull()
  return JSON.parse(rawContent as string) as Record<string, string>
}

describe('import storage integration', () => {
  it('successful GraphicConfig import updates local config library storage', () => {
    const storage = createMemoryKeyValueStorage()
    const repository = createWorkspaceConfigRepository(storage, {
      settings: createBaseSettings(),
      graphicFiles: {},
    })

    repository.importGraphicConfig(serializeGraphicConfigExport(importedGraphic))

    const persistedSettings = readPersistedSettings(storage)
    const persistedGraphicFiles = readPersistedGraphicFiles(storage)
    const reloaded = repository.load()

    expect(persistedSettings.graphics.map((graphic) => graphic.id)).toEqual(['existing-title', 'imported-title'])
    expect(Object.keys(persistedGraphicFiles)).toContain('imported-title.json')
    expect(reloaded.settings.graphics.map((graphic) => graphic.id)).toEqual(['existing-title', 'imported-title'])
  })

  it('successful Profile import updates local profile storage', () => {
    const storage = createMemoryKeyValueStorage()
    const repository = createWorkspaceConfigRepository(storage, {
      settings: createBaseSettings(),
      graphicFiles: {},
    })

    repository.importProfileConfig(serializeProfileConfigExport({
      ...createBaseSettings(),
      selectedProfileId: 'imported-news',
      referenceImages: [importedReferenceImage],
      sourceSchemas: [importedSchema],
      profiles: [importedProfile],
      graphics: [importedGraphic],
    }, 'imported-news'))

    const persistedSettings = readPersistedSettings(storage)
    const reloaded = repository.load()

    expect(persistedSettings.profiles.map((profile) => profile.id)).toEqual(['default', 'imported-news'])
    expect(reloaded.settings.profiles.find((profile) => profile.id === 'imported-news')).toMatchObject({
      label: 'Imported News',
    })
  })

  it('imported source schema becomes available to profiles', () => {
    const storage = createMemoryKeyValueStorage()
    const repository = createWorkspaceConfigRepository(storage, {
      settings: createBaseSettings(),
      graphicFiles: {},
    })

    const snapshot = repository.importProfileConfig(serializeProfileConfigExport({
      ...createBaseSettings(),
      selectedProfileId: 'imported-news',
      referenceImages: [importedReferenceImage],
      sourceSchemas: [importedSchema],
      profiles: [importedProfile],
      graphics: [importedGraphic],
    }, 'imported-news'))

    expect(snapshot.settings.sourceSchemas.find((schema) => schema.id === 'csv-imported-news')).toMatchObject({
      name: 'Imported news CSV',
    })
    expect(snapshot.settings.profiles.find((profile) => profile.id === 'imported-news')?.source?.schemaId)
      .toBe('csv-imported-news')
  })

  it('imported reference image metadata becomes available to preview settings', () => {
    const storage = createMemoryKeyValueStorage()
    const repository = createWorkspaceConfigRepository(storage, {
      settings: createBaseSettings(),
      graphicFiles: {},
    })

    const snapshot = repository.importProfileConfig(serializeProfileConfigExport({
      ...createBaseSettings(),
      selectedProfileId: 'imported-news',
      referenceImages: [importedReferenceImage],
      sourceSchemas: [importedSchema],
      profiles: [importedProfile],
      graphics: [importedGraphic],
    }, 'imported-news'))

    expect(snapshot.settings.referenceImages).toContainEqual(importedReferenceImage)
    expect(snapshot.settings.graphics.find((graphic) => graphic.id === 'imported-title')?.preview.background?.referenceImageId)
      .toBe('ref-imported-title')
  })

  it('failed import does not partially corrupt persisted storage', () => {
    const storage = createMemoryKeyValueStorage()
    const repository = createWorkspaceConfigRepository(storage, {
      settings: createBaseSettings(),
      graphicFiles: {},
    })

    const before = repository.save(createBaseSettings())

    expect(() =>
      repository.importProfileConfig(JSON.stringify({
        version: 1,
        exportType: 'profile-config',
        payload: {
          profile: importedProfile,
          sourceSchemas: [importedSchema],
          graphics: [{ id: 'broken', entityType: 'title' }],
          referenceImages: [importedReferenceImage],
        },
      }))
    ).toThrow()

    const after = repository.load()
    const persistedSettings = readPersistedSettings(storage)
    const persistedGraphicFiles = readPersistedGraphicFiles(storage)

    expect(after).toEqual(before)
    expect(persistedSettings.profiles.map((profile) => profile.id)).toEqual(['default'])
    expect(Object.keys(persistedGraphicFiles)).toEqual(['existing-title.json'])
  })

  it('import services remain separate from UI actions', () => {
    const storage = createMemoryKeyValueStorage()
    const repository = createWorkspaceConfigRepository(storage, {
      settings: createBaseSettings(),
      graphicFiles: {},
    })

    expect(() =>
      repository.importGraphicConfig(serializeGraphicConfigExport(importedGraphic))
    ).not.toThrow()
    expect(() =>
      repository.importProfileConfig(serializeProfileConfigExport({
        ...createBaseSettings(),
        selectedProfileId: 'imported-news',
        referenceImages: [importedReferenceImage],
        sourceSchemas: [importedSchema],
        profiles: [importedProfile],
        graphics: [importedGraphic],
      }, 'imported-news'))
    ).not.toThrow()
    expect(typeof repository.importGraphicConfig).toBe('function')
    expect(typeof repository.importProfileConfig).toBe('function')
  })
})
