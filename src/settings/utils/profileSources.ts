import type {
  AppSettings,
  CsvSourceSchemaConfig,
  ShowProfileConfig,
  ShowProfileSourceConfig,
} from '@/settings/models/appConfig'

export interface ActiveProfileSourceResolution {
  profile: ShowProfileConfig
  source?: ShowProfileSourceConfig
  activeSourceFilePath?: string
  sourceSchema?: CsvSourceSchemaConfig
  diagnostics: string[]
}

export function resolveActiveProfileSource(
  settings: AppSettings,
): ActiveProfileSourceResolution {
  const profile = settings.profiles.find((candidate) => candidate.id === settings.selectedProfileId)

  if (!profile) {
    throw new Error(`Unknown show profile: ${settings.selectedProfileId}`)
  }

  return resolveProfileSource(profile, settings.sourceSchemas)
}

export function resolveProfileSource(
  profile: ShowProfileConfig,
  sourceSchemas: CsvSourceSchemaConfig[] = [],
): ActiveProfileSourceResolution {
  const source = profile.source

  if (!source) {
    return {
      profile,
      diagnostics: [`Show profile "${profile.id}" has no source configured.`],
    }
  }

  const sourceSchema = resolveSourceSchema(source, sourceSchemas)

  if (!source.filePath) {
    return {
      profile,
      source,
      sourceSchema,
      diagnostics: [`Show profile "${profile.id}" has no source file selected.`],
    }
  }

  return {
    profile,
    source,
    activeSourceFilePath: source.filePath,
    sourceSchema,
    diagnostics: source.schemaId && !sourceSchema
      ? [`Show profile "${profile.id}" references an unknown source schema "${source.schemaId}".`]
      : [],
  }
}

function resolveSourceSchema(
  source: ShowProfileSourceConfig,
  sourceSchemas: CsvSourceSchemaConfig[],
): CsvSourceSchemaConfig | undefined {
  if (!source.schemaId) {
    return undefined
  }

  return sourceSchemas.find((schema) => schema.id === source.schemaId)
}
