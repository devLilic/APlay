import type { AppSettings, ShowProfileConfig } from '@/settings/models/appConfig'
import { supportedEntityTypes } from '@/core/entities/entityTypes'
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
    sourceSchemas: [],
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

  const normalizedValue: Record<string, unknown> = {
    referenceImages: [],
    sourceSchemas: [],
    profiles: [],
    graphics: [],
    ...(input as Record<string, unknown>),
  }
  const graphics = Array.isArray(normalizedValue.graphics)
    ? normalizedValue.graphics
      .filter((graphic) =>
        isSupportedGraphicEntityType(graphic),
      )
      .map((graphic) => normalizeGraphicConfigName(graphic))
    : []
  const availableGraphicIds = new Set(
    graphics
      .map((graphic) => (graphic && typeof graphic === 'object' ? (graphic as Record<string, unknown>).id : undefined))
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0),
  )
  const profiles = Array.isArray(normalizedValue.profiles)
    ? normalizedValue.profiles.map((profile) => normalizeProfileGraphicIds(profile, availableGraphicIds))
    : []
  const selectedProfileId = resolveSelectedProfileId(normalizedValue.selectedProfileId, profiles)

  return {
    ...normalizedValue,
    selectedProfileId,
    profiles,
    graphics,
  }
}

function normalizeGraphicConfigName(graphic: unknown): unknown {
  if (!graphic || typeof graphic !== 'object' || Array.isArray(graphic)) {
    return graphic
  }

  const value = graphic as Record<string, unknown>
  const existingName = typeof value.name === 'string' ? value.name.trim() : ''
  if (existingName.length > 0) {
    return {
      ...value,
      name: existingName,
    }
  }

  const id = typeof value.id === 'string' ? value.id.trim() : ''
  return {
    ...value,
    name: humanizeGraphicConfigId(id),
  }
}

function humanizeGraphicConfigId(graphicId: string): string {
  const normalized = graphicId.trim()
  if (normalized.length === 0) {
    return 'Unnamed graphic config'
  }

  return normalized
    .split(/[-_]+/g)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}


function isSupportedGraphicEntityType(graphic: unknown): boolean {
  return !!graphic &&
    typeof graphic === 'object' &&
    !Array.isArray(graphic) &&
    typeof (graphic as Record<string, unknown>).entityType === 'string' &&
    supportedEntityTypes.includes((graphic as Record<string, unknown>).entityType as typeof supportedEntityTypes[number])
}

function normalizeProfileGraphicIds(
  profile: unknown,
  availableGraphicIds: Set<string>,
): unknown {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    return profile
  }

  const value = profile as Record<string, unknown>
  const graphicConfigIds = Array.isArray(value.graphicConfigIds)
    ? value.graphicConfigIds.filter(
      (graphicId): graphicId is string => typeof graphicId === 'string' && availableGraphicIds.has(graphicId),
    )
    : []

  return {
    ...value,
    graphicConfigIds,
  }
}

function resolveSelectedProfileId(
  selectedProfileId: unknown,
  profiles: unknown[],
): unknown {
  if (
    typeof selectedProfileId === 'string' &&
    profiles.some(
      (profile) => !!profile && typeof profile === 'object' && !Array.isArray(profile) && (profile as Record<string, unknown>).id === selectedProfileId,
    )
  ) {
    return selectedProfileId
  }

  const fallbackProfile = profiles.find(
    (profile) => !!profile && typeof profile === 'object' && !Array.isArray(profile) && typeof (profile as Record<string, unknown>).id === 'string',
  ) as Record<string, unknown> | undefined

  return fallbackProfile?.id ?? selectedProfileId
}
