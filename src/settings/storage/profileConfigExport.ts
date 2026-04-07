import type {
  AppSettings,
  CsvSourceSchemaConfig,
  GraphicInstanceConfig,
  ReferenceImageAsset,
  ShowProfileConfig,
} from '@/settings/models/appConfig'
import {
  appSettingsSchema,
  csvSourceSchemaConfigSchema,
  graphicInstanceConfigSchema,
  referenceImageAssetSchema,
  showProfileConfigSchema,
} from '@/settings/schemas/appConfigSchemas'

export const profileConfigExportVersion = 1 as const
export const profileConfigExportType = 'profile-config' as const

export interface ProfileConfigExportPayload {
  profile: ShowProfileConfig
  sourceSchemas: CsvSourceSchemaConfig[]
  graphics: GraphicInstanceConfig[]
  referenceImages: ReferenceImageAsset[]
}

export interface ProfileConfigExportEnvelope {
  version: typeof profileConfigExportVersion
  exportType: typeof profileConfigExportType
  payload: ProfileConfigExportPayload
}

export interface ProfileConfigFileSaveResult {
  status: 'saved' | 'cancelled'
  filePath: string | null
  content: string | null
}

export interface ProfileConfigFileSaveDependencies {
  pickFilePath: (suggestedFileName: string) => Promise<string | null>
  writeFile: (filePath: string, content: string) => Promise<void>
}

export interface ProfileConfigFileSaveService {
  save: (settings: unknown, profileId: string, suggestedFileName?: string) => Promise<ProfileConfigFileSaveResult>
}

export function serializeProfileConfigExport(settings: unknown, profileId: string): string {
  return JSON.stringify(createProfileConfigExportEnvelope(settings, profileId), null, 2)
}

export function createProfileConfigExportEnvelope(
  settings: unknown,
  profileId: string,
): ProfileConfigExportEnvelope {
  const payload = createProfileConfigExportPayload(settings, profileId)

  return {
    version: profileConfigExportVersion,
    exportType: profileConfigExportType,
    payload,
  }
}

export function parseProfileConfigImport(input: unknown): ProfileConfigExportPayload {
  if (!isProfileConfigExportEnvelope(input)) {
    throw new Error('Invalid profile config export envelope')
  }

  return validateProfileConfigExportPayload(input.payload)
}

export function createProfileConfigFileSaveService(
  dependencies: ProfileConfigFileSaveDependencies,
): ProfileConfigFileSaveService {
  return {
    async save(settings: unknown, profileId: string, suggestedFileName?: string): Promise<ProfileConfigFileSaveResult> {
      const content = serializeProfileConfigExport(settings, profileId)
      const imported = parseProfileConfigImport(JSON.parse(content) as unknown)
      const filePath = await dependencies.pickFilePath(
        normalizeSuggestedFileName(suggestedFileName ?? `${imported.profile.id}.profile.json`),
      )

      if (filePath === null) {
        return {
          status: 'cancelled',
          filePath: null,
          content: null,
        }
      }

      await dependencies.writeFile(filePath, content)

      return {
        status: 'saved',
        filePath,
        content,
      }
    },
  }
}

function createProfileConfigExportPayload(settings: unknown, profileId: string): ProfileConfigExportPayload {
  const validatedSettings = appSettingsSchema.parse(settings)
  const profile = validatedSettings.profiles.find((candidate) => candidate.id === profileId)

  if (!profile) {
    throw new Error(`Unknown show profile: ${profileId}`)
  }

  const graphics = profile.graphicConfigIds.map((graphicConfigId) => {
    const graphic = validatedSettings.graphics.find((candidate) => candidate.id === graphicConfigId)
    if (!graphic) {
      throw new Error(`Missing graphic config for profile "${profile.id}": ${graphicConfigId}`)
    }

    return graphic
  })

  const sourceSchemas = resolveReferencedSourceSchemas(validatedSettings, profile)
  const referenceImages = resolveReferencedReferenceImages(validatedSettings, graphics)

  return {
    profile,
    sourceSchemas,
    graphics,
    referenceImages,
  }
}

function validateProfileConfigExportPayload(input: unknown): ProfileConfigExportPayload {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Profile config export payload must be an object')
  }

  const value = input as Record<string, unknown>
  const profile = assertProfile(value.profile)
  const sourceSchemas = assertSourceSchemas(value.sourceSchemas)
  const graphics = assertGraphics(value.graphics)
  const referenceImages = assertReferenceImages(value.referenceImages)

  const schemaIds = new Set(sourceSchemas.map((sourceSchema) => sourceSchema.id))
  const profileSchemaId = profile.source?.schemaId
  if (profileSchemaId && !schemaIds.has(profileSchemaId)) {
    throw new Error(`Profile export is missing referenced source schema: ${profileSchemaId}`)
  }

  const graphicIds = new Set(graphics.map((graphic) => graphic.id))
  for (const graphicConfigId of profile.graphicConfigIds) {
    if (!graphicIds.has(graphicConfigId)) {
      throw new Error(`Profile export is missing referenced graphic config: ${graphicConfigId}`)
    }
  }

  const referenceImageIds = new Set(referenceImages.map((referenceImage) => referenceImage.id))
  for (const graphic of graphics) {
    const referenceImageId = graphic.preview.background?.referenceImageId
    if (referenceImageId && !referenceImageIds.has(referenceImageId)) {
      throw new Error(`Profile export is missing referenced image: ${referenceImageId}`)
    }
  }

  return {
    profile,
    sourceSchemas,
    graphics,
    referenceImages,
  }
}

function resolveReferencedSourceSchemas(
  settings: AppSettings,
  profile: ShowProfileConfig,
): CsvSourceSchemaConfig[] {
  const schemaId = profile.source?.schemaId
  if (!schemaId) {
    return []
  }

  const sourceSchema = settings.sourceSchemas.find((candidate) => candidate.id === schemaId)
  if (!sourceSchema) {
    throw new Error(`Missing source schema for profile "${profile.id}": ${schemaId}`)
  }

  return [sourceSchema]
}

function resolveReferencedReferenceImages(
  settings: AppSettings,
  graphics: GraphicInstanceConfig[],
): ReferenceImageAsset[] {
  const referenceImageIds = Array.from(new Set(
    graphics
      .map((graphic) => graphic.preview.background?.referenceImageId)
      .filter((referenceImageId): referenceImageId is string => typeof referenceImageId === 'string' && referenceImageId.length > 0),
  ))

  return referenceImageIds.map((referenceImageId) => {
    const referenceImage = settings.referenceImages.find((candidate) => candidate.id === referenceImageId)
    if (!referenceImage) {
      throw new Error(`Missing reference image for exported profile: ${referenceImageId}`)
    }

    return referenceImage
  })
}

function isProfileConfigExportEnvelope(input: unknown): input is ProfileConfigExportEnvelope {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false
  }

  const value = input as Record<string, unknown>

  if (value.version !== profileConfigExportVersion) {
    throw new Error(`Unsupported profile config export version: ${String(value.version)}`)
  }

  if (value.exportType !== profileConfigExportType) {
    throw new Error(`Unsupported profile config export type: ${String(value.exportType)}`)
  }

  if (!('payload' in value)) {
    throw new Error('Profile config export payload is missing')
  }

  return true
}

function assertProfile(input: unknown): ShowProfileConfig {
  return showProfileConfigSchema.parse(input)
}

function assertSourceSchemas(input: unknown): CsvSourceSchemaConfig[] {
  if (!Array.isArray(input)) {
    throw new Error('Profile config export sourceSchemas must be an array')
  }

  return input.map((sourceSchema) => csvSourceSchemaConfigSchema.parse(sourceSchema))
}

function assertGraphics(input: unknown): GraphicInstanceConfig[] {
  if (!Array.isArray(input)) {
    throw new Error('Profile config export graphics must be an array')
  }

  return input.map((graphic) => graphicInstanceConfigSchema.parse(graphic))
}

function assertReferenceImages(input: unknown): ReferenceImageAsset[] {
  if (!Array.isArray(input)) {
    throw new Error('Profile config export referenceImages must be an array')
  }

  return input.map((referenceImage) => referenceImageAssetSchema.parse(referenceImage))
}

function normalizeSuggestedFileName(fileName: string): string {
  const trimmed = fileName.trim()
  if (trimmed.length === 0) {
    return 'profile-config.json'
  }

  return trimmed.toLowerCase().endsWith('.json')
    ? trimmed
    : `${trimmed}.json`
}
