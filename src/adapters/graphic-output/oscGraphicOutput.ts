import type { ActionType } from '@/core/actions/actionTypes'
import { actionTypes } from '@/core/actions/actionTypes'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import {
  resolveOscCommandAddress,
  resolveOscCommandArgs,
} from '@/settings/schemas/oscConfigSchemas'
import type {
  GraphicOutputAdapter,
  GraphicOutputCommand,
  GraphicOutputDiagnostic,
  GraphicOutputExecutionResult,
} from './contracts'

export interface OscTransport {
  send: (command: GraphicOutputCommand) => void
}

export interface OscGraphicActionInput {
  actionType: ActionType
  graphic: GraphicInstanceConfig
}

export interface OscGraphicOutputAdapter extends GraphicOutputAdapter {
  buildCommand: (input: OscGraphicActionInput) => GraphicOutputCommand
  sendForGraphic: (
    input: OscGraphicActionInput,
    transport: OscTransport,
  ) => GraphicOutputExecutionResult
}

export function createOscGraphicOutputAdapter(): OscGraphicOutputAdapter {
  return {
    id: 'osc-output',
    protocol: 'osc',
    supportedActionTypes: Object.values(actionTypes),
    execute(command: GraphicOutputCommand): GraphicOutputExecutionResult {
      return {
        success: true,
        command,
        diagnostics: [],
      }
    },
    buildCommand(input: OscGraphicActionInput): GraphicOutputCommand {
      const commandConfig = resolveOscCommand(input.graphic, input.actionType)

      return {
        actionType: input.actionType,
        address: resolveOscCommandAddress(commandConfig),
        args: resolveOscCommandArgs(commandConfig),
      }
    },
    sendForGraphic(
      input: OscGraphicActionInput,
      transport: OscTransport,
    ): GraphicOutputExecutionResult {
      const commandConfig = resolveOscCommand(input.graphic, input.actionType)
      const address = resolveOscCommandAddress(commandConfig)
      const command: GraphicOutputCommand = {
        actionType: input.actionType,
        address,
        args: resolveOscCommandArgs(commandConfig),
      }

      if (!address) {
        return {
          success: false,
          command,
          diagnostics: [
            {
              severity: 'error',
              code: 'missing-osc-address',
              message: `Missing OSC address for action "${input.actionType}" on graphic "${input.graphic.id}"`,
              details: {
                actionType: input.actionType,
                graphicId: input.graphic.id,
              },
            },
          ],
        }
      }

      try {
        transport.send(command)

        return {
          success: true,
          command,
          diagnostics: [],
        }
      } catch {
        return {
          success: false,
          command,
          diagnostics: [
            {
              severity: 'error',
              code: 'osc-send-failed',
              message: `Failed to send OSC command for action "${input.actionType}"`,
              details: {
                actionType: input.actionType,
                address: command.address,
              },
            },
          ],
        }
      }
    },
  }
}

function resolveOscAddress(
  graphic: GraphicInstanceConfig,
  actionType: ActionType,
) {
  return resolveOscCommandAddress(resolveOscCommand(graphic, actionType))
}

function resolveOscCommand(
  graphic: GraphicInstanceConfig,
  actionType: ActionType,
) {
  switch (actionType) {
    case 'playGraphic':
      return graphic.control.play
    case 'stopGraphic':
      return graphic.control.stop
    case 'resumeGraphic':
      return graphic.control.resume
  }
}
