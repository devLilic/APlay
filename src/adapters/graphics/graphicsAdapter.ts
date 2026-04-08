import type { ActionType } from '@/core/actions/actionTypes'
import type { SupportedEntityType } from '@/core/entities/entityTypes'
import type { GraphicInstanceConfig, OscArgConfig, OscCommandConfig, OscSettingsConfig } from '@/settings/models/appConfig'
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
  | 'missing-template-name'
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

type GraphicsAdapterResolvedCommandSource = 'local override' | 'global' | 'fallback'

export interface GraphicsAdapterExecutionResult {
  success: boolean
  actionType: ActionType
  targetFile?: string
  command?: GraphicsAdapterResolvedCommand
  transportStages?: string[]
  diagnostics: GraphicsAdapterDiagnostic[]
}

export interface GraphicsAdapterActionInput {
  entityType: SupportedEntityType
  entity: EntityPublishInput['entity']
  graphic: GraphicInstanceConfig
  bindings?: FieldBinding[]
  oscSettings?: OscSettingsConfig
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
  const target = resolveOscTarget(input)
  if (!target.success) {
    return {
      success: false,
      actionType,
      diagnostics: target.diagnostics,
    }
  }

  const bindings = input.bindings ?? input.graphic.bindings ?? []
  const targetFile = resolveDatasourceTargetPath(input.graphic)
  const requiresDatasource = actionType === 'playGraphic' && !isStaticGraphic(input.graphic)

  if (requiresDatasource) {
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

  const builtCommand = resolveCommand(input, actionType, graphicOutput)
  if (!builtCommand.success) {
    return {
      success: false,
      actionType,
      targetFile: actionType === 'playGraphic' ? targetFile : undefined,
      diagnostics: builtCommand.diagnostics,
    }
  }

  if (!builtCommand.command.address) {
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
    const command = builtCommand.command

    if (actionType === 'playGraphic') {
      console.log('OSC PLAY RESOLUTION', {
        graphicId: input.graphic.id,
        resolvedTemplateName: input.graphic.control.templateName ?? '',
        commandSource: builtCommand.source,
        address: command.address,
        args: command.args as OscArgConfig[],
        targetFile: requiresDatasource ? targetFile : undefined,
      })
    }

    const transportStages = await oscClient.send(command.address, command.args as OscArgConfig[])

    return {
      success: true,
      actionType,
      targetFile: requiresDatasource ? targetFile : undefined,
      command: {
        host: target.host,
        port: target.port,
        address: command.address,
        args: command.args as OscArgConfig[],
      },
      transportStages,
      diagnostics: [],
    }
  } catch (error) {
    return {
      success: false,
      actionType,
      targetFile: requiresDatasource ? targetFile : undefined,
      command: {
        host: target.host,
        port: target.port,
        address: builtCommand.command.address,
        args: builtCommand.command.args as OscArgConfig[],
      },
      transportStages: error instanceof Error && 'stages' in error && Array.isArray((error as { stages?: unknown }).stages)
        ? ((error as { stages: string[] }).stages)
        : undefined,
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
            address: builtCommand.command.address,
            host: target.host,
            port: target.port,
          },
        },
      ],
    }
  }
}

function resolveOscTarget(input: GraphicsAdapterActionInput):
  | { success: true; host: string; port: number }
  | { success: false; diagnostics: GraphicsAdapterDiagnostic[] } {
  const target = input.oscSettings?.target ?? input.graphic.control.oscTarget
  if (!target) {
    return {
      success: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'missing-osc-target',
          message: `Missing OSC target for graphic "${input.graphic.id}"`,
          details: {
            graphicId: input.graphic.id,
          },
        },
      ],
    }
  }

  try {
    const host = target.host.trim()
    validateOscHost(host, `osc target host (${input.graphic.id})`)
    validateOscPort(target.port, `osc target port (${input.graphic.id})`)

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
          message: error instanceof Error ? error.message : `Missing OSC target for graphic "${input.graphic.id}"`,
          details: {
            graphicId: input.graphic.id,
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

function resolveCommand(
  input: GraphicsAdapterActionInput,
  actionType: ActionType,
  graphicOutput: Pick<ReturnType<typeof createOscGraphicOutputAdapter>, 'buildCommand'>,
):
  | { success: true; command: { address: string; args: OscArgConfig[] }; source: GraphicsAdapterResolvedCommandSource }
  | { success: false; diagnostics: GraphicsAdapterDiagnostic[] } {
  const localCommand = resolveGraphicCommandOverride(input.graphic, actionType)
  if (localCommand) {
    const resolvedLocalCommand = resolveCommandPlaceholders(localCommand, input, actionType)
    if (!resolvedLocalCommand.success) {
      return resolvedLocalCommand
    }

    return {
      success: true,
      command: resolvedLocalCommand.command,
      source: 'local override',
    }
  }

  if (input.oscSettings) {
    const commandConfig = actionType === 'playGraphic'
      ? input.oscSettings.commands.play
      : actionType === 'stopGraphic'
        ? input.oscSettings.commands.stop
        : input.oscSettings.commands.resume

    const resolvedGlobalCommand = resolveCommandPlaceholders(commandConfig, input, actionType)
    if (!resolvedGlobalCommand.success) {
      return resolvedGlobalCommand
    }

    return {
      success: true,
      command: resolvedGlobalCommand.command,
      source: 'global',
    }
  }

  const graphicCommand = graphicOutput.buildCommand({
    actionType,
    graphic: input.graphic,
  })

  return {
    success: true,
    command: {
      address: graphicCommand.address,
      args: graphicCommand.args as OscArgConfig[],
    },
    source: 'fallback',
  }
}

function isStaticGraphic(graphic: GraphicInstanceConfig): boolean {
  return graphic.kind === 'static' || graphic.entityType === 'staticImage'
}

function resolveGraphicCommandOverride(
  graphic: GraphicInstanceConfig,
  actionType: ActionType,
): OscCommandConfig | undefined {
  const command = actionType === 'playGraphic'
    ? graphic.control.play
    : actionType === 'stopGraphic'
      ? graphic.control.stop
      : graphic.control.resume

  if (command && typeof command === 'object' && !Array.isArray(command) && command.address.trim().length > 0) {
    return command
  }

  return undefined
}

function resolveCommandPlaceholders(
  command: string | OscCommandConfig,
  input: GraphicsAdapterActionInput,
  actionType: ActionType,
):
  | { success: true; command: { address: string; args: OscArgConfig[] } }
  | { success: false; diagnostics: GraphicsAdapterDiagnostic[] } {
  const resolvedCommand = typeof command === 'string'
    ? {
      address: command,
      args: [] as OscArgConfig[],
    }
    : {
      address: command.address,
      args: command.args.map((arg) => {
        if (arg.type === 's' && arg.value === '{{templateName}}') {
          return {
            ...arg,
            value: input.graphic.control.templateName ?? '',
          }
        }

        return arg
      }),
    }

  if (
    resolvedCommand.args.some((arg) => arg.type === 's' && arg.value === '') &&
    typeof command !== 'string' &&
    command.args.some((arg) => arg.type === 's' && arg.value === '{{templateName}}')
  ) {
    return {
      success: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'missing-template-name',
          message: `Missing LiveBoard template name for graphic "${input.graphic.id}"`,
          details: {
            actionType,
            graphicId: input.graphic.id,
          },
        },
      ],
    }
  }

  return {
    success: true,
    command: resolvedCommand,
  }
}
