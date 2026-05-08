import type { ActionType } from '@/core/actions/actionTypes'
import type { SelectedMultiEntityContext } from '@/features/workspace/state/workspaceSelectionState'

type WorkspaceRuntimeDebugGlobal = typeof globalThis & {
  __APLAY_DEBUG_WORKSPACE_RUNTIME__?: boolean
}

export function debugWorkspaceRuntime(label: string, payload: Record<string, unknown>): void {
  const debugEnabled = (globalThis as WorkspaceRuntimeDebugGlobal).__APLAY_DEBUG_WORKSPACE_RUNTIME__ === true
  if (!debugEnabled || typeof console === 'undefined' || typeof console.log !== 'function') {
    return
  }

  console.log(label, payload)
}

export function warnWorkspaceRuntime(message: string): void {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[APlay runtime] ${message}`)
  }
}

export function formatGraphicConfigDiagnostic(
  diagnostic: { message: string; details: { reason?: unknown } },
): string {
  const reason = diagnostic.details.reason

  return typeof reason === 'string' && reason.length > 0
    ? `${diagnostic.message}: ${reason}`
    : diagnostic.message
}

export function logGroupedGraphicAction(input: {
  stage: 'start' | 'success' | 'skip' | 'error' | 'missing-config'
  actionType: ActionType
  selectedEntity: SelectedMultiEntityContext
  graphicId: string
  graphicName?: string
  targetFile?: string
  oscAddress?: string
  oscArgs?: unknown[]
  reason?: string
  diagnostics?: string[]
}) {
  debugWorkspaceRuntime('GROUPED GRAPHIC ACTION', {
    stage: input.stage,
    actionType: input.actionType,
    graphicId: input.graphicId,
    graphicName: input.graphicName,
    blockName: input.selectedEntity.blockName,
    entityIndex: input.selectedEntity.entityIndex,
    targetFile: input.targetFile,
    oscAddress: input.oscAddress,
    oscArgs: input.oscArgs,
    reason: input.reason,
    diagnostics: input.diagnostics,
  })
}
