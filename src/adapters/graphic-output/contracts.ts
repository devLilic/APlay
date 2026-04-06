import type { ActionType } from '@/core/actions/actionTypes'
import {
  SchemaValidationError,
  assertRecord,
  createSchema,
  parseRequiredString,
} from '@/shared/validation/schema'

export interface GraphicOutputAdapterDescriptor {
  id: string
  protocol: 'osc'
  supportedActionTypes: ActionType[]
}

export type GraphicOutputProtocol = 'osc'
export type GraphicOutputDiagnosticCode = 'missing-osc-address' | 'osc-send-failed'

export interface GraphicOutputCommand {
  actionType: ActionType
  address: string
  args: unknown[]
}

export interface GraphicOutputDiagnostic {
  severity: 'error'
  code: GraphicOutputDiagnosticCode
  message: string
  details?: Record<string, unknown>
}

export interface GraphicOutputExecutionResult {
  success: boolean
  command: GraphicOutputCommand
  diagnostics: GraphicOutputDiagnostic[]
}

export interface GraphicOutputAdapter {
  id: string
  protocol: GraphicOutputProtocol
  supportedActionTypes: ActionType[]
  execute: (command: GraphicOutputCommand) => GraphicOutputExecutionResult
}

export const graphicOutputAdapterSchema = createSchema<GraphicOutputAdapter>((input) => {
  const value = assertRecord(input, 'graphicOutputAdapter')
  const execute = value.execute

  if (typeof execute !== 'function') {
    throw new SchemaValidationError('graphicOutputAdapter.execute must be a function')
  }

  const protocol = parseRequiredString(value, 'protocol', 'graphicOutputAdapter')
  if (protocol !== 'osc') {
    throw new SchemaValidationError('graphicOutputAdapter.protocol must be osc')
  }

  const supportedActionTypes = value.supportedActionTypes
  if (!Array.isArray(supportedActionTypes)) {
    throw new SchemaValidationError('graphicOutputAdapter.supportedActionTypes must be an array')
  }

  return {
    id: parseRequiredString(value, 'id', 'graphicOutputAdapter'),
    protocol,
    supportedActionTypes: supportedActionTypes as ActionType[],
    execute: execute as GraphicOutputAdapter['execute'],
  }
})
