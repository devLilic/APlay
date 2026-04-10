import type { PreviewTemplateDefinition } from '@/settings/models/appConfig'

export interface WorkspaceOnAirCompositeItem {
  graphicConfigId: string
  zIndex?: number
  template: PreviewTemplateDefinition
  content: Record<string, string | undefined>
}

export interface WorkspaceOnAirSnapshot {
  mode: 'single' | 'grouped'
  title: string
  description: string
  itemCount: number
  template: PreviewTemplateDefinition
  content: Record<string, string | undefined>
  backgroundImagePath?: string
  compositeItems: WorkspaceOnAirCompositeItem[]
}

export interface WorkspaceOnAirState {
  current: WorkspaceOnAirSnapshot | null
  lastPlayed: WorkspaceOnAirSnapshot | null
}

export type WorkspaceOnAirEvent =
  | { type: 'play'; snapshot: WorkspaceOnAirSnapshot }
  | { type: 'stop' }
  | { type: 'resume' }

export function createWorkspaceOnAirState(): WorkspaceOnAirState {
  return {
    current: null,
    lastPlayed: null,
  }
}

export function createSingleOnAirSnapshot(input: {
  graphic: { name: string; preview: PreviewTemplateDefinition }
  content: Record<string, string | undefined>
  backgroundImagePath?: string
  entityLabel?: string
}): WorkspaceOnAirSnapshot {
  return {
    mode: 'single',
    title: input.graphic.name,
    description: input.entityLabel
      ? `${input.entityLabel} is on air.`
      : `${input.graphic.name} is on air.`,
    itemCount: 1,
    template: input.graphic.preview,
    content: input.content,
    backgroundImagePath: input.backgroundImagePath,
    compositeItems: [],
  }
}

export function createGroupedOnAirSnapshot(input: {
  primaryGraphic: { name: string; preview: PreviewTemplateDefinition }
  primaryContent: Record<string, string | undefined>
  primaryEntityLabel?: string
  backgroundImagePath?: string
  itemCount: number
  compositeItems: WorkspaceOnAirCompositeItem[]
}): WorkspaceOnAirSnapshot {
  return {
    mode: 'grouped',
    title: input.primaryGraphic.name,
    description: input.primaryEntityLabel
      ? `${input.primaryEntityLabel} anchors ${input.itemCount} on-air items.`
      : `${input.itemCount} grouped items are on air.`,
    itemCount: input.itemCount,
    template: input.primaryGraphic.preview,
    content: input.primaryContent,
    backgroundImagePath: input.backgroundImagePath,
    compositeItems: input.compositeItems,
  }
}

export function applyWorkspaceOnAirEvent(
  state: WorkspaceOnAirState,
  event: WorkspaceOnAirEvent,
): WorkspaceOnAirState {
  if (event.type === 'play') {
    return {
      current: event.snapshot,
      lastPlayed: event.snapshot,
    }
  }

  if (event.type === 'stop') {
    return {
      current: null,
      lastPlayed: state.current ?? state.lastPlayed,
    }
  }

  return {
    current: state.lastPlayed,
    lastPlayed: state.lastPlayed,
  }
}
