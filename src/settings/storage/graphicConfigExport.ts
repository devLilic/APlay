import { graphicInstanceConfigSchema } from '../schemas/appConfigSchemas'
import type { GraphicInstanceConfig } from '../models/appConfig'

export const graphicConfigExportVersion = 1 as const
export const graphicConfigExportType = 'graphic-config' as const

export interface GraphicConfigExportEnvelope {
  version: typeof graphicConfigExportVersion
  exportType: typeof graphicConfigExportType
  payload: GraphicInstanceConfig
}

export interface GraphicConfigFileSaveResult {
  status: 'saved' | 'cancelled'
  filePath: string | null
  content: string | null
}

export interface GraphicConfigFileSaveDependencies {
  pickFilePath: (suggestedFileName: string) => Promise<string | null>
  writeFile: (filePath: string, content: string) => Promise<void>
}

export interface GraphicConfigFileSaveService {
  save: (graphicConfig: unknown, suggestedFileName?: string) => Promise<GraphicConfigFileSaveResult>
}

export function serializeGraphicConfigExport(graphicConfig: unknown): string {
  const envelope = createGraphicConfigExportEnvelope(graphicConfig)
  return JSON.stringify(envelope, null, 2)
}

export function createGraphicConfigExportEnvelope(graphicConfig: unknown): GraphicConfigExportEnvelope {
  const payload = graphicInstanceConfigSchema.parse(graphicConfig)

  return {
    version: graphicConfigExportVersion,
    exportType: graphicConfigExportType,
    payload,
  }
}

export function parseGraphicConfigImport(input: unknown): GraphicInstanceConfig {
  // Support the new wrapped export format while keeping legacy raw config files importable.
  if (isGraphicConfigExportEnvelope(input)) {
    return parseGraphicConfigImportEnvelope(input)
  }

  return graphicInstanceConfigSchema.parse(input)
}

export function createGraphicConfigFileSaveService(
  dependencies: GraphicConfigFileSaveDependencies,
): GraphicConfigFileSaveService {
  return {
    async save(graphicConfig: unknown, suggestedFileName?: string): Promise<GraphicConfigFileSaveResult> {
      const content = serializeGraphicConfigExport(graphicConfig)
      const validatedGraphic = parseGraphicConfigImport(JSON.parse(content) as unknown)
      const filePath = await dependencies.pickFilePath(
        normalizeSuggestedFileName(suggestedFileName ?? validatedGraphic.dataFileName),
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

function isGraphicConfigExportEnvelope(input: unknown): input is GraphicConfigExportEnvelope {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false
  }

  const value = input as Record<string, unknown>
  if (value.version === undefined && value.exportType === undefined && value.payload === undefined) {
    return false
  }

  if (value.version !== graphicConfigExportVersion) {
    throw new Error(`Unsupported graphic config export version: ${String(value.version)}`)
  }

  if (value.exportType !== graphicConfigExportType) {
    throw new Error(`Unsupported graphic config export type: ${String(value.exportType)}`)
  }

  if (!('payload' in value)) {
    throw new Error('Graphic config export payload is missing')
  }

  return true
}

function parseGraphicConfigImportEnvelope(input: GraphicConfigExportEnvelope): GraphicInstanceConfig {
  switch (input.version) {
    case graphicConfigExportVersion:
      return graphicInstanceConfigSchema.parse(input.payload)
    default:
      throw new Error(`Unsupported graphic config export version: ${String(input.version)}`)
  }
}

function normalizeSuggestedFileName(fileName: string): string {
  const trimmed = fileName.trim()
  if (trimmed.length === 0) {
    return 'graphic-config.json'
  }

  return trimmed.toLowerCase().endsWith('.json')
    ? trimmed
    : `${trimmed}.json`
}
