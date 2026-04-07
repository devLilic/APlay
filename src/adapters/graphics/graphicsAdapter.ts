import type { ActionType } from '@/core/actions/actionTypes'
import type { SupportedEntityType } from '@/core/entities/entityTypes'
import type { GraphicInstanceConfig, OscArgConfig } from '@/settings/models/appConfig'
import type {
  EntityPublishInput,
  FieldBinding,
  JsonDatasourcePublishTargetAdapter,
  PublishTargetFileWriter,
} from '@/adapters/publish-target/jsonDatasourcePublishTarget'
import { createJsonDatasourcePublishTargetAdapter } from '@/adapters/publish-target/jsonDatasourcePublishTarget'
import { createOscGraphicOutputAdapter } from '@/adapters/graphic-output/oscGraphicOutput'
import type { OscClient, OscClientConfig } from '@/integrations/osc/oscClient'
import { validateOscHost, validateOscPort } from '@/settings/schemas/oscConfigSchemas'

export type GraphicsAdapterDiagnosticCode =
  | 'missing-bindings'
  | 'missing-osc-target'
  | 'publish-failed'
  | 'missing-osc-address'
  | 'osc-send-failed'

export interface GraphicsAdapterDiagnostic {
  severity: 'error'
  code: GraphicsAdapterDiagnosticCode
  message: string
  details?: Record<string, unknown>
}

export interface GraphicsAdapterResolvedCommand {
  host: string
  port: number
  address: string
  args: OscArgConfig[]
}

export interface GraphicsAdapterExecutionResult {
  success: boolean
  actionType: ActionType
  targetFile?: string
  command?: GraphicsAdapterResolvedCommand
  diagnostics: GraphicsAdapterDiagnostic[]
}

export interface GraphicsAdapterActionInput {
  entityType: SupportedEntityType
  entity: EntityPublishInput['entity']
  graphic: GraphicInstanceConfig
  bindings?: FieldBinding[]
}

export interface GraphicsAdapter {
  play: (input: GraphicsAdapterActionInput) => Promise<GraphicsAdapterExecutionResult>
  stop: (input: GraphicsAdapterActionInput) => Promise<GraphicsAdapterExecutionResult>
  resume: (input: GraphicsAdapterActionInput) => Promise<GraphicsAdapterExecutionResult>
}

export interface GraphicsAdapterDependencies {
  createOscClient: (config: OscClientConfig) => OscClient
  publishTarget?: JsonDatasourcePublishTargetAdapter
  fileWriter: PublishTargetFileWriter
  graphicOutput?: Pick<ReturnType<typeof createOscGraphicOutputAdapter>, 'buildCommand'>
}

export function createGraphicsAdapter(
  dependencies: GraphicsAdapterDependencies,
): GraphicsAdapter {
  const publishTarget = dependencies.publishTarget ?? createJsonDatasourcePublishTargetAdapter()
  const graphicOutput = dependencies.graphicOutput ?? createOscGraphicOutputAdapter()

  return {
    play(input) {
      return runGraphicsAction('playGraphic', input, dependencies, publishTarget, graphicOutput)
    },
    stop(input) {
      return runGraphicsAction('stopGraphic', input, dependencies, publishTarget, graphicOutput)
    },
    resume(input) {
      return runGraphicsAction('resumeGraphic', input, dependencies, publishTarget, graphicOutput)
    },
  }
}

async function runGraphicsAction(
  actionType: ActionType,
  input: GraphicsAdapterActionInput,
  dependencies: GraphicsAdapterDependencies,
  publishTarget: JsonDatasourcePublishTargetAdapter,
  graphicOutput: Pick<ReturnType<typeof createOscGraphicOutputAdapter>, 'buildCommand'>,
): Promise<GraphicsAdapterExecutionResult> {
  const target = resolveOscTarget(input.graphic)
  if (!target.success) {
    return {
      success: false,
      actionType,
      diagnostics: target.diagnostics,
    }
  }

  const bindings = input.bindings ?? input.graphic.bindings ?? []
  const targetFile = resolveDatasourceTargetPath(input.graphic)

  if (actionType === 'playGraphic') {
    if (bindings.length === 0) {
      return {
        success: false,
        actionType,
        targetFile,
        diagnostics: [
          {
            severity: 'error',
            code: 'missing-bindings',
            message: `No datasource bindings are configured for graphic "${input.graphic.id}".`,
            details: {
              actionType,
              graphicId: input.graphic.id,
            },
          },
        ],
      }
    }

    const publishResult = publishTarget.publishEntity(
      {
        entityType: input.entityType,
        entity: input.entity,
        targetFile,
        bindings,
      },
      dependencies.fileWriter,
    )

    if (!publishResult.success) {
      return {
        success: false,
        actionType,
        targetFile,
        diagnostics: publishResult.diagnostics.map((diagnostic) => ({
          severity: 'error',
          code: 'publish-failed',
          message: diagnostic.message,
          details: diagnostic.details,
        })),
      }
    }
  }

  const builtCommand = graphicOutput.buildCommand({
    actionType,
    graphic: input.graphic,
  })

  if (!builtCommand.address) {
    return {
      success: false,
      actionType,
      targetFile: actionType === 'playGraphic' ? targetFile : undefined,
      diagnostics: [
        {
          severity: 'error',
          code: 'missing-osc-address',
          message: `Missing OSC address for action "${actionType}" on graphic "${input.graphic.id}"`,
          details: {
            actionType,
            graphicId: input.graphic.id,
          },
        },
      ],
    }
  }

  const oscClient = dependencies.createOscClient({
    host: target.host,
    port: target.port,
  })

  try {
    await oscClient.send(builtCommand.address, builtCommand.args as OscArgConfig[])

    return {
      success: true,
      actionType,
      targetFile: actionType === 'playGraphic' ? targetFile : undefined,
      command: {
        host: target.host,
        port: target.port,
        address: builtCommand.address,
        args: builtCommand.args as OscArgConfig[],
      },
      diagnostics: [],
    }
  } catch (error) {
    return {
      success: false,
      actionType,
      targetFile: actionType === 'playGraphic' ? targetFile : undefined,
      command: {
        host: target.host,
        port: target.port,
        address: builtCommand.address,
        args: builtCommand.args as OscArgConfig[],
      },
      diagnostics: [
        {
          severity: 'error',
          code: 'osc-send-failed',
          message: error instanceof Error
            ? error.message
            : `Failed to send OSC command for action "${actionType}"`,
          details: {
            actionType,
            graphicId: input.graphic.id,
            address: builtCommand.address,
            host: target.host,
            port: target.port,
          },
        },
      ],
    }
  }
}

function resolveOscTarget(graphic: GraphicInstanceConfig):
  | { success: true; host: string; port: number }
  | { success: false; diagnostics: GraphicsAdapterDiagnostic[] } {
  const target = graphic.control.oscTarget
  if (!target) {
    return {
      success: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'missing-osc-target',
          message: `Missing OSC target for graphic "${graphic.id}"`,
          details: {
            graphicId: graphic.id,
          },
        },
      ],
    }
  }

  try {
    const host = target.host.trim()
    validateOscHost(host, `graphic.control.oscTarget.host (${graphic.id})`)
    validateOscPort(target.port, `graphic.control.oscTarget.port (${graphic.id})`)

    return {
      success: true,
      host,
      port: target.port,
    }
  } catch (error) {
    return {
      success: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'missing-osc-target',
          message: error instanceof Error ? error.message : `Missing OSC target for graphic "${graphic.id}"`,
          details: {
            graphicId: graphic.id,
          },
        },
      ],
    }
  }
}

function resolveDatasourceTargetPath(graphic: GraphicInstanceConfig): string {
  const configuredPath = graphic.datasourcePath?.trim()
  if (configuredPath) {
    return configuredPath
  }

  return `datasources/${graphic.dataFileName}`
}
