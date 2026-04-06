import type { AppSettings, GraphicInstanceConfig } from '@/settings/models/appConfig'
import { createSettingsRepository, type SettingsRepository, type SettingsStorage } from '@/settings/storage/settingsRepository'
import { graphicInstanceConfigSchema } from '@/settings/schemas/appConfigSchemas'

export interface GraphicConfigFileMap {
  [fileName: string]: string
}

export interface WorkspaceConfigSnapshot {
  settings: AppSettings
  graphicFiles: GraphicConfigFileMap
}

export interface KeyValueStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export interface WorkspaceConfigRepository {
  load: () => WorkspaceConfigSnapshot
  save: (settings: unknown) => WorkspaceConfigSnapshot
}

const settingsStorageKey = 'aplay.settings.v1'
const graphicFilesStorageKey = 'aplay.graphic-config-files.v1'

export function createWorkspaceConfigRepository(
  storage: KeyValueStorage,
  defaults: WorkspaceConfigSnapshot,
): WorkspaceConfigRepository {
  const settingsRepository = createSettingsRepository(
    createKeyValueSettingsStorage(storage, defaults.settings),
  )

  return {
    load(): WorkspaceConfigSnapshot {
      const settings = settingsRepository.load()
      const graphicFiles = loadGraphicFiles(storage, settings.graphics, defaults.graphicFiles)
      const graphics = resolvePersistedGraphics(settings.graphics, graphicFiles)

      return {
        settings: {
          ...settings,
          graphics,
        },
        graphicFiles: createGraphicFileMap(graphics),
      }
    },
    save(settings: unknown): WorkspaceConfigSnapshot {
      settingsRepository.save(settings)
      const persistedSettings = settingsRepository.load()
      const graphicFiles = createGraphicFileMap(persistedSettings.graphics)
      storage.setItem(graphicFilesStorageKey, JSON.stringify(graphicFiles, null, 2))

      return {
        settings: persistedSettings,
        graphicFiles,
      }
    },
  }
}

function createKeyValueSettingsStorage(
  storage: KeyValueStorage,
  defaultSettings: AppSettings,
): SettingsStorage {
  return {
    read() {
      return storage.getItem(settingsStorageKey) ?? JSON.stringify(defaultSettings, null, 2)
    },
    write(content: string) {
      storage.setItem(settingsStorageKey, content)
    },
  }
}

function loadGraphicFiles(
  storage: KeyValueStorage,
  graphics: GraphicInstanceConfig[],
  defaultFiles: GraphicConfigFileMap,
): GraphicConfigFileMap {
  const rawContent = storage.getItem(graphicFilesStorageKey)
  if (rawContent === null) {
    const files = Object.keys(defaultFiles).length > 0 ? defaultFiles : createGraphicFileMap(graphics)
    storage.setItem(graphicFilesStorageKey, JSON.stringify(files, null, 2))
    return files
  }

  try {
    const parsed = JSON.parse(rawContent) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return createGraphicFileMap(graphics)
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string',
      ),
    )
  } catch {
    return createGraphicFileMap(graphics)
  }
}

function resolvePersistedGraphics(
  settingsGraphics: GraphicInstanceConfig[],
  graphicFiles: GraphicConfigFileMap,
): GraphicInstanceConfig[] {
  return settingsGraphics.map((graphic) => {
    const persistedContent = graphicFiles[resolveGraphicConfigFileName(graphic.id)]
    if (!persistedContent) {
      return graphic
    }

    try {
      return graphicInstanceConfigSchema.parse(JSON.parse(persistedContent) as unknown)
    } catch {
      return graphic
    }
  })
}

function createGraphicFileMap(graphics: GraphicInstanceConfig[]): GraphicConfigFileMap {
  return Object.fromEntries(
    graphics.map((graphic) => [
      resolveGraphicConfigFileName(graphic.id),
      JSON.stringify(graphic, null, 2),
    ]),
  )
}

function resolveGraphicConfigFileName(graphicId: string): string {
  return `${graphicId}.json`
}

export function createMemoryKeyValueStorage(seed: Record<string, string> = {}): KeyValueStorage {
  const values = new Map(Object.entries(seed))

  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}
