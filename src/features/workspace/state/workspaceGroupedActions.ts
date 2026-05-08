import type { ActionType } from '@/core/actions/actionTypes'
import { createOscGraphicOutputAdapter } from '@/adapters/graphic-output/oscGraphicOutput'
import {
  publishGraphicsDatasource,
  resolveGraphicsActionCommand,
  resolveGraphicsActionOscTarget,
  resolveGraphicsDatasourceTargetPath,
} from '@/adapters/graphics/graphicsAdapter'
import type { GraphicInstanceConfig, OscArgConfig, OscSettingsConfig } from '@/settings/models/appConfig'
import {
  resolveGraphicControlForSelectedEntity,
  type SelectedEntityControlFeedback,
} from '@/features/workspace/state/selectedEntityControl'
import type { SelectedMultiEntityContext } from '@/features/workspace/state/workspaceSelectionState'
import {
  createWorkspaceOscClient,
  createWorkspaceGraphicsAdapter,
  doesGraphicRequireDatasource,
  formatGraphicsAdapterSuccessDetails,
  resolveGroupedDatasourceTargetFile,
  runGraphicsAdapterActionWithAdapter,
} from '@/features/workspace/state/workspaceGraphicActions'
import {
  debugWorkspaceRuntime,
  logGroupedGraphicAction,
} from '@/features/workspace/state/workspaceDiagnostics'

interface PreparedGroupedPlayItem {
  selectedEntity: SelectedMultiEntityContext
  graphic: GraphicInstanceConfig
  targetFile?: string
  command: {
    host: string
    port: number
    address: string
    args: OscArgConfig[]
  }
  commandSource: 'local override' | 'global' | 'fallback'
  requiresDatasource: boolean
}

export async function runWorkspaceMultiGraphicAction(
  actionType: 'playGraphic' | 'stopGraphic' | 'resumeGraphic',
  selectedEntities: SelectedMultiEntityContext[],
  graphicsById: Partial<Record<string, GraphicInstanceConfig>>,
  oscSettings?: OscSettingsConfig,
): Promise<SelectedEntityControlFeedback> {
  if (selectedEntities.length === 0) {
    return {
      kind: 'error',
      title: 'No entities selected',
      details: ['Select at least one item before sending commands to LiveBoard.'],
    }
  }

  if (actionType === 'playGraphic') {
    return await runWorkspaceGroupedPlayAction(selectedEntities, graphicsById, oscSettings)
  }

  const adapter = createWorkspaceGraphicsAdapter()
  const details: string[] = []
  const errors: string[] = []

  for (const selectedEntity of selectedEntities) {
    const graphic = resolveGraphicControlForSelectedEntity(graphicsById, selectedEntity)
    if (!graphic) {
      logGroupedGraphicAction({
        stage: 'missing-config',
        actionType,
        selectedEntity,
        graphicId: selectedEntity.graphicConfigId,
      })
      errors.push(`No graphic configuration is loaded for "${selectedEntity.graphicConfigId}".`)
      continue
    }

    const requiresDatasource = doesGraphicRequireDatasource(actionType, graphic)
    logGroupedGraphicAction({
      stage: requiresDatasource ? 'start' : 'skip',
      actionType,
      selectedEntity,
      graphicId: graphic.id,
      graphicName: graphic.name,
      targetFile: requiresDatasource ? resolveGroupedDatasourceTargetFile(graphic) : undefined,
      reason: requiresDatasource ? undefined : 'static graphic or non-play action',
    })

    const result = await runGraphicsAdapterActionWithAdapter(
      adapter,
      actionType,
      selectedEntity,
      graphic,
      oscSettings,
    )

    if (!result.success) {
      logGroupedGraphicAction({
        stage: 'error',
        actionType,
        selectedEntity,
        graphicId: graphic.id,
        graphicName: graphic.name,
        targetFile: result.targetFile,
        oscAddress: result.command?.address,
        oscArgs: result.command?.args,
        diagnostics: result.diagnostics.map((diagnostic) => diagnostic.message),
      })
      errors.push(...result.diagnostics.map((diagnostic) => `[${graphic.name}] ${diagnostic.message}`))
      continue
    }

    logGroupedGraphicAction({
      stage: 'success',
      actionType,
      selectedEntity,
      graphicId: graphic.id,
      graphicName: graphic.name,
      targetFile: result.targetFile,
      oscAddress: result.command?.address,
      oscArgs: result.command?.args,
    })

    details.push(...formatGraphicsAdapterSuccessDetails(result, actionType, graphic.name))
  }

  if (errors.length > 0) {
    return {
      kind: 'error',
      title: 'Grouped action failed',
      details: [...details, ...errors],
    }
  }

  return {
    kind: 'success',
    title: `${actionType} completed`,
    details,
  }
}

async function runWorkspaceGroupedPlayAction(
  selectedEntities: SelectedMultiEntityContext[],
  graphicsById: Partial<Record<string, GraphicInstanceConfig>>,
  oscSettings?: OscSettingsConfig,
): Promise<SelectedEntityControlFeedback> {
  const details: string[] = []
  const errors: string[] = []

  debugWorkspaceRuntime('GROUPED PLAY', {
    stage: 'start',
    selectedCount: selectedEntities.length,
  })

  const preparedItems = prepareGroupedPlayItems(selectedEntities, graphicsById, oscSettings, errors)
  if (errors.length > 0) {
    return {
      kind: 'error',
      title: 'Grouped action failed',
      details: errors,
    }
  }

  const fileWriter = {
    write(targetFile: string, content: string) {
      if (window.settingsApi?.writeDatasourceFileSync) {
        window.settingsApi.writeDatasourceFileSync(targetFile, content)
      }
    },
  }

  debugWorkspaceRuntime('GROUPED PLAY', {
    stage: 'datasource-phase-start',
    itemCount: preparedItems.length,
  })

  for (const item of preparedItems) {
    if (!item.requiresDatasource || !item.targetFile) {
      logGroupedGraphicAction({
        stage: 'skip',
        actionType: 'playGraphic',
        selectedEntity: item.selectedEntity,
        graphicId: item.graphic.id,
        graphicName: item.graphic.name,
        reason: 'static graphic or no datasource required',
      })
      continue
    }

    logGroupedGraphicAction({
      stage: 'start',
      actionType: 'playGraphic',
      selectedEntity: item.selectedEntity,
      graphicId: item.graphic.id,
      graphicName: item.graphic.name,
      targetFile: item.targetFile,
      reason: 'datasource write',
    })

    const publishResult = publishGraphicsDatasource(
      {
        entityType: item.graphic.entityType,
        entity: item.selectedEntity.entity as never,
        graphic: item.graphic,
        bindings: item.graphic.bindings ?? [],
        oscSettings,
      },
      fileWriter,
    )

    if (!publishResult.success) {
      logGroupedGraphicAction({
        stage: 'error',
        actionType: 'playGraphic',
        selectedEntity: item.selectedEntity,
        graphicId: item.graphic.id,
        graphicName: item.graphic.name,
        targetFile: publishResult.targetFile,
        diagnostics: publishResult.diagnostics.map((diagnostic) => diagnostic.message),
      })
      errors.push(...publishResult.diagnostics.map((diagnostic) => `[${item.graphic.name}] ${diagnostic.message}`))
      break
    }

    logGroupedGraphicAction({
      stage: 'success',
      actionType: 'playGraphic',
      selectedEntity: item.selectedEntity,
      graphicId: item.graphic.id,
      graphicName: item.graphic.name,
      targetFile: publishResult.targetFile,
    })
    details.push(`[${item.graphic.name}] Datasource updated: ${publishResult.targetFile}`)
  }

  debugWorkspaceRuntime('GROUPED PLAY', {
    stage: 'datasource-phase-end',
    success: errors.length === 0,
  })

  if (errors.length > 0) {
    return {
      kind: 'error',
      title: 'Grouped action failed',
      details: [...details, ...errors],
    }
  }

  debugWorkspaceRuntime('GROUPED PLAY', {
    stage: 'osc-phase-start',
    itemCount: preparedItems.length,
  })

  for (const item of preparedItems) {
    logGroupedGraphicAction({
      stage: 'start',
      actionType: 'playGraphic',
      selectedEntity: item.selectedEntity,
      graphicId: item.graphic.id,
      graphicName: item.graphic.name,
      targetFile: item.targetFile,
      oscAddress: item.command.address,
      oscArgs: item.command.args,
      reason: 'osc send',
    })

    debugWorkspaceRuntime('OSC PLAY RESOLUTION', {
      graphicId: item.graphic.id,
      resolvedTemplateName: item.graphic.control.templateName ?? '',
      commandSource: item.commandSource,
      address: item.command.address,
      args: item.command.args,
      targetFile: item.targetFile,
    })

    try {
      const transportStages = await createWorkspaceOscClient({
        host: item.command.host,
        port: item.command.port,
      }).send(item.command.address, item.command.args)

      logGroupedGraphicAction({
        stage: 'success',
        actionType: 'playGraphic',
        selectedEntity: item.selectedEntity,
        graphicId: item.graphic.id,
        graphicName: item.graphic.name,
        targetFile: item.targetFile,
        oscAddress: item.command.address,
        oscArgs: item.command.args,
      })

      details.push(`[${item.graphic.name}] OSC sent: ${item.command.address}`)
      if (transportStages.length > 0) {
        details.push(`[${item.graphic.name}] OSC transport: ${transportStages.join(' -> ')}`)
      }
      details.push(`[${item.graphic.name}] playGraphic completed`)
    } catch (error) {
      logGroupedGraphicAction({
        stage: 'error',
        actionType: 'playGraphic',
        selectedEntity: item.selectedEntity,
        graphicId: item.graphic.id,
        graphicName: item.graphic.name,
        targetFile: item.targetFile,
        oscAddress: item.command.address,
        oscArgs: item.command.args,
        diagnostics: [error instanceof Error ? error.message : 'Failed to send OSC play command'],
      })
      errors.push(`[${item.graphic.name}] ${error instanceof Error ? error.message : 'Failed to send OSC play command'}`)
    }
  }

  debugWorkspaceRuntime('GROUPED PLAY', {
    stage: 'osc-phase-end',
    success: errors.length === 0,
  })

  if (errors.length > 0) {
    return {
      kind: 'error',
      title: 'Grouped action failed',
      details: [...details, ...errors],
    }
  }

  return {
    kind: 'success',
    title: 'playGraphic completed',
    details,
  }
}

function prepareGroupedPlayItems(
  selectedEntities: SelectedMultiEntityContext[],
  graphicsById: Partial<Record<string, GraphicInstanceConfig>>,
  oscSettings: OscSettingsConfig | undefined,
  errors: string[],
): PreparedGroupedPlayItem[] {
  const preparedItems: PreparedGroupedPlayItem[] = []
  const graphicOutput = createOscGraphicOutputAdapter()

  for (const selectedEntity of selectedEntities) {
    const graphic = resolveGraphicControlForSelectedEntity(graphicsById, selectedEntity)
    if (!graphic) {
      logGroupedGraphicAction({
        stage: 'missing-config',
        actionType: 'playGraphic',
        selectedEntity,
        graphicId: selectedEntity.graphicConfigId,
      })
      errors.push(`No graphic configuration is loaded for "${selectedEntity.graphicConfigId}".`)
      continue
    }

    const actionInput = {
      entityType: graphic.entityType,
      entity: selectedEntity.entity as never,
      graphic,
      bindings: graphic.bindings ?? [],
      oscSettings,
    } as const

    const target = resolveGraphicsActionOscTarget(actionInput)
    if (!target.success) {
      logGroupedGraphicAction({
        stage: 'error',
        actionType: 'playGraphic',
        selectedEntity,
        graphicId: graphic.id,
        graphicName: graphic.name,
        diagnostics: target.diagnostics.map((diagnostic) => diagnostic.message),
      })
      errors.push(...target.diagnostics.map((diagnostic) => `[${graphic.name}] ${diagnostic.message}`))
      continue
    }

    const commandResult = resolveGraphicsActionCommand(actionInput, 'playGraphic', graphicOutput)
    if (!commandResult.success) {
      logGroupedGraphicAction({
        stage: 'error',
        actionType: 'playGraphic',
        selectedEntity,
        graphicId: graphic.id,
        graphicName: graphic.name,
        diagnostics: commandResult.diagnostics.map((diagnostic) => diagnostic.message),
      })
      errors.push(...commandResult.diagnostics.map((diagnostic) => `[${graphic.name}] ${diagnostic.message}`))
      continue
    }

    preparedItems.push({
      selectedEntity,
      graphic,
      targetFile: doesGraphicRequireDatasource('playGraphic', graphic)
        ? resolveGraphicsDatasourceTargetPath(graphic)
        : undefined,
      command: {
        host: target.host,
        port: target.port,
        address: commandResult.command.address,
        args: commandResult.command.args,
      },
      commandSource: commandResult.source,
      requiresDatasource: doesGraphicRequireDatasource('playGraphic', graphic),
    })
  }

  return preparedItems
}
