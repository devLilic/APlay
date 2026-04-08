import { describe, expect, it } from 'vitest'
import type { AppSettings, GraphicInstanceConfig } from '@/settings/models/appConfig'
import { createGraphicConfigLibraryService } from '@/settings/storage/graphicConfigLibraryService'
import { createProfileGraphicConfigLoader } from '@/settings/storage/profileGraphicConfigLoader'
import {
  createMemoryKeyValueStorage,
  createWorkspaceConfigRepository,
  type KeyValueStorage,
} from '@/settings/storage/workspaceConfigRepository'

const settingsStorageKey = 'aplay.settings.v1'
const graphicFilesStorageKey = 'aplay.graphic-config-files.v1'

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
  bindings: [
    { sourceField: 'text', targetField: 'headline', required: true },
  ],
  preview: {
    id: 'title-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      {
        id: 'headline',
        kind: 'text',
        sourceField: 'text',
        previewText: 'Main title',
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

const personGraphic: GraphicInstanceConfig = {
  id: 'person-main',
  name: 'Person main',
  entityType: 'person',
  dataFileName: 'person-main.json',
  datasourcePath: 'datasources/person-main.json',
  control: {
    play: '/graphics/person/play',
    stop: '/graphics/person/stop',
    resume: '/graphics/person/resume',
  },
  bindings: [
    { sourceField: 'name', targetField: 'personName', required: true },
  ],
  preview: {
    id: 'person-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      {
        id: 'person-name',
        kind: 'text',
        sourceField: 'name',
        previewText: 'Person Name',
        box: {
          x: 120,
          y: 840,
          width: 720,
          height: 120,
        },
      },
    ],
  },
  actions: [{ actionType: 'playGraphic', label: 'Play' }],
}

function createGraphicVariant(
  base: GraphicInstanceConfig,
  overrides: Partial<GraphicInstanceConfig> = {},
): GraphicInstanceConfig {
  return {
    ...structuredClone(base),
    ...overrides,
    control: overrides.control ?? structuredClone(base.control),
    bindings: overrides.bindings ?? structuredClone(base.bindings),
    preview: overrides.preview ?? structuredClone(base.preview),
    actions: overrides.actions ?? structuredClone(base.actions),
  }
}

function createSettings(
  graphics: GraphicInstanceConfig[] = [titleGraphic],
  profileGraphicIds: string[] = graphics.map((graphic) => graphic.id),
): AppSettings {
  return {
    selectedProfileId: 'news',
    referenceImages: [],
    sourceSchemas: [],
    profiles: [
      {
        id: 'news',
        label: 'News',
        source: {
          type: 'csv',
        },
        graphicConfigIds: profileGraphicIds,
      },
    ],
    graphics,
  }
}

function createRepository(
  defaults: AppSettings = createSettings(),
  storage: KeyValueStorage = createMemoryKeyValueStorage(),
) {
  return {
    storage,
    repository: createWorkspaceConfigRepository(storage, {
      settings: defaults,
      graphicFiles: {},
    }),
  }
}

function readPersistedGraphicFiles(storage: KeyValueStorage): Record<string, string> {
  const raw = storage.getItem(graphicFilesStorageKey)
  return raw ? JSON.parse(raw) as Record<string, string> : {}
}

function readPersistedSettings(storage: KeyValueStorage): AppSettings {
  return JSON.parse(storage.getItem(settingsStorageKey) as string) as AppSettings
}

describe('graphic config library CRUD and profile assignment', () => {
  it('provides a dedicated GraphicConfig library service', () => {
    const service = createGraphicConfigLibraryService()

    expect(typeof service.createGraphicConfig).toBe('function')
    expect(typeof service.updateGraphicConfig).toBe('function')
    expect(typeof service.duplicateGraphicConfig).toBe('function')
    expect(typeof service.deleteGraphicConfig).toBe('function')
    expect(typeof service.attachGraphicConfigToProfile).toBe('function')
    expect(typeof service.detachGraphicConfigFromProfile).toBe('function')
  })

  it('creates a new GraphicConfig in the library', () => {
    const { repository } = createRepository(createSettings([titleGraphic], ['title-main']))
    const newGraphic = createGraphicVariant(personGraphic)

    const result = repository.createGraphicConfig(newGraphic)
    const snapshot = repository.load()

    expect(result.status).toBe('created')
    expect(snapshot.settings.graphics.map((graphic) => graphic.id)).toEqual(['title-main', 'person-main'])
    expect(snapshot.graphicFiles).toHaveProperty('person-main.json')
  })

  it('updates an existing GraphicConfig', () => {
    const { repository } = createRepository()

    const result = repository.updateGraphicConfig('title-main', (graphic) => ({
      ...graphic,
      datasourcePath: 'datasources/title-main-updated.json',
      preview: {
        ...graphic.preview,
        elements: [
          {
            ...graphic.preview.elements[0]!,
            previewText: 'Updated title',
          },
        ],
      },
    }))

    const snapshot = repository.load()
    const updatedGraphic = snapshot.settings.graphics[0]

    expect(result.status).toBe('updated')
    expect(updatedGraphic?.datasourcePath).toBe('datasources/title-main-updated.json')
    expect(updatedGraphic?.preview.elements[0]?.previewText).toBe('Updated title')
    expect(snapshot.graphicFiles['title-main.json']).toContain('Updated title')
  })

  it('duplicates an existing GraphicConfig', () => {
    const { repository } = createRepository()

    const result = repository.duplicateGraphicConfig('title-main')

    const snapshot = repository.load()
    const duplicated = snapshot.settings.graphics.find((graphic) => graphic.id !== 'title-main')

    expect(result.status).toBe('duplicated')
    expect(snapshot.settings.graphics.map((graphic) => graphic.id)).toEqual(['title-main', 'title-main-2'])
    expect(duplicated?.dataFileName).toBe('title-main-2.json')
    expect(snapshot.graphicFiles).toHaveProperty('title-main-2.json')
  })

  it('deletes a GraphicConfig from the library', () => {
    const { repository } = createRepository(createSettings([titleGraphic, personGraphic], ['title-main']))

    const result = repository.deleteGraphicConfig('person-main')
    const snapshot = repository.load()

    expect(result.status).toBe('deleted')
    expect(snapshot.settings.graphics.map((graphic) => graphic.id)).toEqual(['title-main'])
    expect(snapshot.graphicFiles).not.toHaveProperty('person-main.json')
  })

  it('attaches an existing GraphicConfig to a ShowProfile', () => {
    const { repository } = createRepository(createSettings([titleGraphic, personGraphic], ['title-main']))

    const result = repository.attachGraphicConfigToProfile('news', 'person-main')
    const snapshot = repository.load()

    expect(result.status).toBe('attached')
    expect(snapshot.settings.profiles[0]?.graphicConfigIds).toEqual(['title-main', 'person-main'])
  })

  it('detaches a GraphicConfig from a ShowProfile', () => {
    const { repository } = createRepository(createSettings([titleGraphic, personGraphic], ['title-main', 'person-main']))

    const result = repository.detachGraphicConfigFromProfile('news', 'person-main')
    const snapshot = repository.load()

    expect(result.status).toBe('detached')
    expect(snapshot.settings.profiles[0]?.graphicConfigIds).toEqual(['title-main'])
  })

  it('removing a GraphicConfig from a profile does not delete it from the library', () => {
    const { repository } = createRepository(createSettings([titleGraphic, personGraphic], ['title-main', 'person-main']))

    repository.detachGraphicConfigFromProfile('news', 'person-main')

    const snapshot = repository.load()

    expect(snapshot.settings.profiles[0]?.graphicConfigIds).toEqual(['title-main'])
    expect(snapshot.settings.graphics.map((graphic) => graphic.id)).toEqual(['title-main', 'person-main'])
    expect(snapshot.graphicFiles).toHaveProperty('person-main.json')
  })

  it('deleting from library removes it from persistence correctly', () => {
    const { repository, storage } = createRepository(createSettings([titleGraphic, personGraphic], ['title-main']))

    repository.deleteGraphicConfig('person-main')

    const persistedFiles = readPersistedGraphicFiles(storage)

    expect(Object.keys(persistedFiles)).toEqual(['title-main.json'])
    expect(persistedFiles).not.toHaveProperty('person-main.json')
  })

  it('handles a profile referencing a non-existing GraphicConfig safely', () => {
    const { repository } = createRepository(createSettings([titleGraphic], ['title-main']))

    expect(() =>
      repository.attachGraphicConfigToProfile('news', 'missing-graphic'),
    ).toThrow('Graphic config not found: missing-graphic')
  })

  it('handles trying to attach the same config twice to the same profile safely', () => {
    const { repository } = createRepository(createSettings([titleGraphic], ['title-main']))

    const result = repository.attachGraphicConfigToProfile('news', 'title-main')
    const snapshot = repository.load()

    expect(result.status).toBe('already-attached')
    expect(snapshot.settings.profiles[0]?.graphicConfigIds).toEqual(['title-main'])
  })

  it('handles deleting a GraphicConfig that is still referenced by a profile safely', () => {
    const { repository } = createRepository(createSettings([titleGraphic, personGraphic], ['title-main', 'person-main']))

    expect(() =>
      repository.deleteGraphicConfig('person-main'),
    ).toThrow('Cannot delete graphic config "person-main" while referenced by profiles: news')
  })

  it('validates missing required graphic config fields before persistence', () => {
    const { repository } = createRepository()

    expect(() =>
      repository.createGraphicConfig({
        ...structuredClone(titleGraphic),
        id: 'broken-graphic',
        dataFileName: 'broken-graphic.json',
        preview: undefined as never,
      }),
    ).toThrow('previewTemplateDefinition')
  })

  it('persists the library after create, update, and delete operations', () => {
    const { repository, storage } = createRepository(createSettings([titleGraphic], ['title-main']))
    const createdGraphic = createGraphicVariant(personGraphic)

    repository.createGraphicConfig(createdGraphic)
    repository.updateGraphicConfig('person-main', (graphic) => ({
      ...graphic,
      datasourcePath: 'datasources/person-main-updated.json',
    }))
    repository.deleteGraphicConfig('person-main')

    const persistedFiles = readPersistedGraphicFiles(storage)
    const persistedSettings = readPersistedSettings(storage)

    expect(Object.keys(persistedFiles)).toEqual(['title-main.json'])
    expect(persistedSettings.graphics.map((graphic) => graphic.id)).toEqual(['title-main'])
  })

  it('persists the profile after attach and detach operations', () => {
    const { repository, storage } = createRepository(createSettings([titleGraphic, personGraphic], ['title-main']))

    repository.attachGraphicConfigToProfile('news', 'person-main')
    expect(readPersistedSettings(storage).profiles[0]?.graphicConfigIds).toEqual(['title-main', 'person-main'])

    repository.detachGraphicConfigFromProfile('news', 'person-main')

    expect(readPersistedSettings(storage).profiles[0]?.graphicConfigIds).toEqual(['title-main'])
  })

  it('reports a missing persisted graphic file without crashing the profile loader', () => {
    const settings = createSettings([titleGraphic], ['title-main'])
    const loader = createProfileGraphicConfigLoader({
      read(fileName: string) {
        return fileName === 'title-main.json' ? null : null
      },
    })

    const result = loader.loadForProfile(settings, 'news')

    expect(result.graphics).toEqual([])
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'missing-graphic-config',
        message: 'Graphic config file not found for "title-main"',
        details: {
          graphicConfigId: 'title-main',
          fileName: 'title-main.json',
        },
      },
    ])
  })
})
