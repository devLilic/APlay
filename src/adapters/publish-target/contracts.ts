import {
  SchemaValidationError,
  assertRecord,
  createSchema,
  parseRequiredString,
} from '@/shared/validation/schema'

export type PublishTargetOutput = 'jsonDatasource'
export type PublishDiagnosticSeverity = 'error' | 'warning'
export type PublishDiagnosticCode =
  | 'missing-source-field'
  | 'invalid-binding'
  | 'invalid-target-path'

export interface PublishTargetDiagnostic {
  severity: PublishDiagnosticSeverity
  code: PublishDiagnosticCode
  message: string
  details?: Record<string, unknown>
}

export interface PublishTargetPublishInput {
  targetFile: string
  payload: Record<string, string>
}

export interface PublishTargetPublishResult {
  success: boolean
  targetFile: string
  payload: Record<string, string>
  diagnostics: PublishTargetDiagnostic[]
}

export interface PublishTargetAdapter {
  id: string
  output: PublishTargetOutput
  publish: (input: PublishTargetPublishInput) => PublishTargetPublishResult
}

export interface PublishTargetAdapterDescriptor {
  id: string
  output: PublishTargetOutput
  description: string
}

export const publishTargetAdapterSchema = createSchema<PublishTargetAdapter>((input) => {
  const value = assertRecord(input, 'publishTargetAdapter')
  const publish = value.publish

  if (typeof publish !== 'function') {
    throw new SchemaValidationError('publishTargetAdapter.publish must be a function')
  }

  const output = parseRequiredString(value, 'output', 'publishTargetAdapter')
  if (output !== 'jsonDatasource') {
    throw new SchemaValidationError('publishTargetAdapter.output must be jsonDatasource')
  }

  return {
    id: parseRequiredString(value, 'id', 'publishTargetAdapter'),
    output,
    publish: publish as PublishTargetAdapter['publish'],
  }
})
