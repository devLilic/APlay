import type { AppSettings, GraphicInstanceConfig } from '@/settings/models/appConfig'
import { createSettingsRepository, type SettingsStorage } from '@/settings/storage/settingsRepository'
import {
  parseGraphicConfigImport,
  serializeGraphicConfigExport,
} from '@/settings/storage/graphicConfigExport'
import {
  importGraphicConfigToLibrary,
  type GraphicConfigLibraryImportResult,
  type GraphicConfigIdConflictPolicy,
} from '@/settings/storage/graphicConfigImport'
import {
  importProfileConfigToLibrary,
  type ProfileLibraryImportResult,
  type ProfileImportConflictPolicy,
} from '@/settings/storage/profileConfigImport'

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
  importGraphicConfig: (
    content: string | unknown,
    options?: { conflictPolicy?: GraphicConfigIdConflictPolicy },
  ) => GraphicConfigLibraryImportResult
  importProfileConfig: (
    content: string | unknown,
    options?: {
      profileConflictPolicy?: ProfileImportConflictPolicy
      graphicConflictPolicy?: ProfileImportConflictPolicy
      schemaConflictPolicy?: ProfileImportConflictPolicy
      referenceImageConflictPolicy?: ProfileImportConflictPolicy
    },
  ) => ProfileLibraryImportResult
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
    importGraphicConfig(content, options): GraphicConfigLibraryImportResult {
      const currentSnapshot = this.load()
      const imported = importGraphicConfigToLibrary(
        {
          content,
          settings: currentSnapshot.settings,
          graphicFiles: currentSnapshot.graphicFiles,
        },
        options,
      )

      settingsRepository.save(imported.settings)
      storage.setItem(graphicFilesStorageKey, JSON.stringify(imported.graphicFiles, null, 2))

      return imported
    },
    importProfileConfig(content, options): ProfileLibraryImportResult {
      const currentSnapshot = this.load()
      const imported = importProfileConfigToLibrary(
        {
          content,
          settings: currentSnapshot.settings,
          graphicFiles: currentSnapshot.graphicFiles,
        },
        options,
      )

      settingsRepository.save(imported.settings)
      storage.setItem(graphicFilesStorageKey, JSON.stringify(imported.graphicFiles, null, 2))

      return imported
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
      warnWorkspaceConfig('Persisted graphic config file map is invalid. Falling back to validated settings graphics.')
      return createGraphicFileMap(graphics)
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string',
      ),
    )
  } catch {
    warnWorkspaceConfig('Persisted graphic config file map could not be parsed. Falling back to validated settings graphics.')
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
      return parseGraphicConfigImport(JSON.parse(persistedContent) as unknown)
    } catch {
      warnWorkspaceConfig(
        `Graphic config file "${resolveGraphicConfigFileName(graphic.id)}" is invalid. Falling back to the root settings version.`,
      )
      return graphic
    }
  })
}

function createGraphicFileMap(graphics: GraphicInstanceConfig[]): GraphicConfigFileMap {
  return Object.fromEntries(
    graphics.map((graphic) => [
      resolveGraphicConfigFileName(graphic.id),
      serializeGraphicConfigExport(graphic),
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

function warnWorkspaceConfig(message: string): void {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[APlay settings] ${message}`)
  }
}
