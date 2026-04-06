import type { AppSettings, ShowProfileConfig, ShowProfileSourceConfig } from '@/settings/models/appConfig'

export interface ActiveProfileSourceResolution {
  profile: ShowProfileConfig
  source?: ShowProfileSourceConfig
  activeSourceFilePath?: string
  diagnostics: string[]
}

export function resolveActiveProfileSource(
  settings: AppSettings,
): ActiveProfileSourceResolution {
  const profile = settings.profiles.find((candidate) => candidate.id === settings.selectedProfileId)

  if (!profile) {
    throw new Error(`Unknown show profile: ${settings.selectedProfileId}`)
  }

  return resolveProfileSource(profile)
}

export function resolveProfileSource(
  profile: ShowProfileConfig,
): ActiveProfileSourceResolution {
  const source = profile.source

  if (!source) {
    return {
      profile,
      diagnostics: [`Show profile "${profile.id}" has no source configured.`],
    }
  }

  if (!source.filePath) {
    return {
      profile,
      source,
      diagnostics: [`Show profile "${profile.id}" has no source file selected.`],
    }
  }

  return {
    profile,
    source,
    activeSourceFilePath: source.filePath,
    diagnostics: [],
  }
}
