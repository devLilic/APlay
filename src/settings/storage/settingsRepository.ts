import type { AppSettings, ShowProfileConfig } from '@/settings/models/appConfig'
import { appSettingsSchema } from '@/settings/schemas/appConfigSchemas'

export interface SettingsStorage {
  read: () => string | null
  write: (content: string) => void
}

export interface SettingsRepository {
  load: () => AppSettings
  save: (settings: unknown) => void
  getProfile: (profileId: string) => ShowProfileConfig | undefined
}

export function createSettingsRepository(storage: SettingsStorage): SettingsRepository {
  return {
    load(): AppSettings {
      const rawContent = storage.read()
      const parsedContent = rawContent === null
        ? createDefaultSettingsDocument()
        : normalizePersistedSettings(parseSettingsRootDocument(rawContent))

      return appSettingsSchema.parse(parsedContent)
    },
    save(settings: unknown): void {
      const validated = appSettingsSchema.parse(settings)
      storage.write(JSON.stringify(validated, null, 2))
    },
    getProfile(profileId: string): ShowProfileConfig | undefined {
      return this.load().profiles.find((profile) => profile.id === profileId)
    },
  }
}

function parseSettingsRootDocument(rawContent: string): unknown {
  try {
    return JSON.parse(rawContent) as unknown
  } catch (error) {
    throw new Error(
      `Invalid settings root file: ${error instanceof Error ? error.message : 'Unable to parse JSON'}`,
    )
  }
}

export function createInMemorySettingsStorage(initialContent: string | null = null): SettingsStorage {
  let content = initialContent

  return {
    read() {
      return content
    },
    write(nextContent: string) {
      content = nextContent
    },
  }
}

function createDefaultSettingsDocument(): AppSettings {
  return {
    selectedProfileId: 'default',
    referenceImages: [],
    profiles: [
      {
        id: 'default',
        label: 'Default',
        source: {
          type: 'csv',
        },
        graphicConfigIds: [],
      },
    ],
    graphics: [],
  }
}

function normalizePersistedSettings(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input
  }

  const value = input as Record<string, unknown>

  return {
    referenceImages: [],
    profiles: [],
    graphics: [],
    ...value,
  }
}
