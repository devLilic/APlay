import type { EditorialDocument } from '@/core/models/editorial'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import type { CsvSourceSchemaConfig } from '@/settings/models/appConfig'
import {
  SchemaValidationError,
  assertRecord,
  createSchema,
  parseEnumValue,
  parseRequiredString,
} from '@/shared/validation/schema'

export const contentSourceFormats = ['csv', 'json'] as const

export type ContentSourceFormat = typeof contentSourceFormats[number]
export type ContentSourceDiagnosticSeverity = 'warning' | 'error'
export type ContentSourceDiagnosticCode = 'missing-column' | 'malformed-csv-row' | 'unknown-type'

export interface ContentSourceInput {
  fileName: string
  content: string
  schema?: CsvSourceSchemaConfig
  graphics?: GraphicInstanceConfig[]
}

export interface ContentSourceDiagnostic {
  severity: ContentSourceDiagnosticSeverity
  code: ContentSourceDiagnosticCode
  message: string
  details?: Record<string, unknown>
}

export interface ContentSourceLoadResult {
  document: EditorialDocument
  diagnostics: ContentSourceDiagnostic[]
  source: ContentSourceInput
}

export interface ContentSourceAdapter {
  id: string
  format: ContentSourceFormat
  load: (source: ContentSourceInput) => ContentSourceLoadResult
}

export interface ContentSourceAdapterDescriptor {
  id: string
  format: ContentSourceFormat
  description: string
}

export const contentSourceAdapterSchema = createSchema<ContentSourceAdapter>((input) => {
  const value = assertRecord(input, 'contentSourceAdapter')
  const load = value.load

  if (typeof load !== 'function') {
    throw new SchemaValidationError('contentSourceAdapter.load must be a function')
  }

  return {
    id: parseRequiredString(value, 'id', 'contentSourceAdapter'),
    format: parseEnumValue(value.format, contentSourceFormats, 'contentSourceAdapter', 'format'),
    load: load as ContentSourceAdapter['load'],
  }
})
