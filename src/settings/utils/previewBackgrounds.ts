import type {
  AppSettings,
  GraphicInstanceConfig,
  PreviewBackgroundConfig,
  ReferenceImageAsset,
} from '@/settings/models/appConfig'

export interface ResolvedPreviewBackground {
  config?: PreviewBackgroundConfig
  image?: ReferenceImageAsset
  resolvedFilePath?: string
  diagnostics: string[]
}

export function resolveReferenceImagePath(filePath: string): string | undefined {
  const normalizedPath = filePath.trim()
  return normalizedPath.length > 0 ? normalizedPath : undefined
}

export function getActivePreviewBackgroundConfig(
  graphic: GraphicInstanceConfig | undefined,
): PreviewBackgroundConfig | undefined {
  return graphic?.preview.background
}

export function resolveActivePreviewBackground(
  settings: AppSettings,
  graphic: GraphicInstanceConfig | undefined,
): ResolvedPreviewBackground {
  const background = getActivePreviewBackgroundConfig(graphic)
  if (!background?.referenceImageId) {
    return {
      diagnostics: [],
    }
  }

  const image = settings.referenceImages.find(
    (referenceImage) => referenceImage.id === background.referenceImageId,
  )

  if (!image) {
    return {
      config: background,
      diagnostics: [
        `Preview background image "${background.referenceImageId}" is not available in settings.`,
      ],
    }
  }

  const resolvedFilePath = resolveReferenceImagePath(image.filePath)
  if (!resolvedFilePath) {
    return {
      config: background,
      image,
      diagnostics: [
        `Preview background image "${image.id}" has an invalid file path.`,
      ],
    }
  }

  return {
    config: background,
    image,
    resolvedFilePath,
    diagnostics: [],
  }
}
