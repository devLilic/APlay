import type {
  PersonEntity,
  PhoneEntity,
  SupertitleEntity,
  TextValueEntity,
  TitleEntity,
} from '@/core/models/editorial'
import type { SupportedEntityType } from '@/core/entities/entityTypes'
import type {
  PublishTargetAdapter,
  PublishTargetDiagnostic,
  PublishTargetPublishInput,
  PublishTargetPublishResult,
} from './contracts'

type PublishableEntity =
  | TitleEntity
  | SupertitleEntity
  | PersonEntity
  | TextValueEntity
  | PhoneEntity

export interface FieldBinding {
  sourceField: string
  targetField: string
  required?: boolean
}

export interface EntityPublishInput {
  entityType: SupportedEntityType
  entity: PublishableEntity
  targetFile: string
  bindings: FieldBinding[]
}

export interface EntityPayloadMappingInput {
  entityType: SupportedEntityType
  entity: PublishableEntity
  bindings: FieldBinding[]
}

export interface EntityPayloadMappingResult {
  payload: Record<string, string>
  diagnostics: PublishTargetDiagnostic[]
}

export interface PublishTargetFileWriter {
  write: (targetFile: string, content: string) => void
}

export interface JsonDatasourcePublishTargetAdapter extends PublishTargetAdapter {
  mapEntityToPayload: (input: EntityPayloadMappingInput) => EntityPayloadMappingResult
  publishEntity: (
    input: EntityPublishInput,
    fileWriter: PublishTargetFileWriter,
  ) => PublishTargetPublishResult
}

export function createJsonDatasourcePublishTargetAdapter(): JsonDatasourcePublishTargetAdapter {
  return {
    id: 'json-datasource',
    output: 'jsonDatasource',
    publish(input: PublishTargetPublishInput): PublishTargetPublishResult {
      return {
        success: true,
        payload: input.payload,
        targetFile: input.targetFile,
        diagnostics: [],
      }
    },
    mapEntityToPayload(input: EntityPayloadMappingInput): EntityPayloadMappingResult {
      return mapEntityToPayload(input)
    },
    publishEntity(
      input: EntityPublishInput,
      fileWriter: PublishTargetFileWriter,
    ): PublishTargetPublishResult {
      const mappingResult = mapEntityToPayload(input)
      const diagnostics = [...mappingResult.diagnostics]

      if (!isValidTargetFile(input.targetFile)) {
        diagnostics.push({
          severity: 'error',
          code: 'invalid-target-path',
          message: `Unable to write datasource file "${input.targetFile}"`,
          details: {
            targetFile: input.targetFile,
          },
        })

        return {
          success: false,
          payload: mappingResult.payload,
          targetFile: input.targetFile,
          diagnostics,
        }
      }

      if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
        return {
          success: false,
          payload: mappingResult.payload,
          targetFile: input.targetFile,
          diagnostics,
        }
      }

      try {
        fileWriter.write(input.targetFile, JSON.stringify(mappingResult.payload, null, 2))

        return {
          success: true,
          payload: mappingResult.payload,
          targetFile: input.targetFile,
          diagnostics,
        }
      } catch {
        diagnostics.push({
          severity: 'error',
          code: 'invalid-target-path',
          message: `Unable to write datasource file "${input.targetFile}"`,
          details: {
            targetFile: input.targetFile,
          },
        })

        return {
          success: false,
          payload: mappingResult.payload,
          targetFile: input.targetFile,
          diagnostics,
        }
      }
    },
  }
}

function mapEntityToPayload(input: EntityPayloadMappingInput): EntityPayloadMappingResult {
  const payload: Record<string, string> = {}
  const diagnostics: PublishTargetDiagnostic[] = []

  for (const binding of input.bindings) {
    if (!binding.sourceField || !binding.targetField) {
      diagnostics.push({
        severity: 'error',
        code: 'invalid-binding',
        message: `Invalid binding configuration for target field "${binding.targetField}"`,
        details: {
          sourceField: binding.sourceField,
          targetField: binding.targetField,
        },
      })
      continue
    }

    const sourceValue = resolveEntityFieldValue(input.entityType, input.entity, binding.sourceField)

    if (sourceValue === undefined) {
      if (binding.required) {
        diagnostics.push({
          severity: 'error',
          code: 'missing-source-field',
          message: `Missing required source field "${binding.sourceField}" for target field "${binding.targetField}"`,
          details: {
            sourceField: binding.sourceField,
            targetField: binding.targetField,
          },
        })
      }
      continue
    }

    payload[binding.targetField] = sourceValue
  }

  return {
    payload,
    diagnostics,
  }
}

function resolveEntityFieldValue(
  entityType: SupportedEntityType,
  entity: PublishableEntity,
  sourceField: string,
): string | undefined {
  switch (entityType) {
    case 'title':
    case 'supertitle':
      if (sourceField === 'text' && 'text' in entity) {
        return normalizeTextValue(entity.text)
      }
      return undefined
    case 'person':
      if (sourceField === 'name' && 'name' in entity) {
        return normalizeTextValue(entity.name)
      }
      if (sourceField === 'role' && 'role' in entity) {
        return normalizeTextValue(entity.role)
      }
      return undefined
    case 'location':
    case 'breakingNews':
    case 'waitingTitle':
    case 'waitingLocation':
      if (sourceField === 'value' && 'value' in entity) {
        return normalizeTextValue(entity.value)
      }
      return undefined
    case 'phone':
      if (sourceField === 'label' && 'label' in entity) {
        return normalizeTextValue(entity.label)
      }
      if (sourceField === 'number' && 'number' in entity) {
        return normalizeTextValue(entity.number)
      }
      return undefined
  }
}

function normalizeTextValue(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function isValidTargetFile(targetFile: string): boolean {
  const normalizedTargetFile = targetFile.trim()

  if (normalizedTargetFile.length === 0) {
    return false
  }

  const withoutWindowsDrivePrefix = normalizedTargetFile.replace(/^[a-zA-Z]:[\\/]/, '')

  return !/[<>:"|?*]/.test(withoutWindowsDrivePrefix)
}
