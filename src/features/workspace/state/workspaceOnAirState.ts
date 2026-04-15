import type { GraphicInstanceConfig, PreviewTemplateDefinition } from '@/settings/models/appConfig'

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
  statusBadge?: string
  statusDetail?: string
  template: PreviewTemplateDefinition
  content: Record<string, string | undefined>
  backgroundImagePath?: string
  compositeItems: WorkspaceOnAirCompositeItem[]
}

export interface WorkspaceOnAirState {
  current: WorkspaceOnAirSnapshot | null
  lastPlayed: WorkspaceOnAirSnapshot | null
}

export interface WorkspaceOnAirController {
  getState: () => WorkspaceOnAirState
  subscribe: (listener: (state: WorkspaceOnAirState) => void) => () => void
  dispose: () => void
  reset: () => void
  playSingle: (input: {
    graphic: GraphicInstanceConfig
    content: Record<string, string | undefined>
    backgroundImagePath?: string
    entityLabel?: string
  }) => void
  playGrouped: (input: {
    primaryGraphic: GraphicInstanceConfig
    primaryContent: Record<string, string | undefined>
    primaryEntityLabel?: string
    backgroundImagePath?: string
    items: Array<{
      graphic: GraphicInstanceConfig
      content: Record<string, string | undefined>
      entityLabel?: string
    }>
  }) => void
  stopCurrent: () => void
  stopGraphic: (graphicConfigId: string) => void
  resume: () => void
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
  statusBadge?: string
  statusDetail?: string
}): WorkspaceOnAirSnapshot {
  return {
    mode: 'single',
    title: input.graphic.name,
    description: input.entityLabel
      ? `${input.entityLabel} is on air.`
      : `${input.graphic.name} is on air.`,
    itemCount: 1,
    ...(input.statusBadge ? { statusBadge: input.statusBadge } : {}),
    ...(input.statusDetail ? { statusDetail: input.statusDetail } : {}),
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
  statusBadge?: string
  statusDetail?: string
  compositeItems: WorkspaceOnAirCompositeItem[]
}): WorkspaceOnAirSnapshot {
  return {
    mode: 'grouped',
    title: input.primaryGraphic.name,
    description: input.primaryEntityLabel
      ? `${input.primaryEntityLabel} anchors ${input.itemCount} on-air items.`
      : `${input.itemCount} grouped items are on air.`,
    itemCount: input.itemCount,
    ...(input.statusBadge ? { statusBadge: input.statusBadge } : {}),
    ...(input.statusDetail ? { statusDetail: input.statusDetail } : {}),
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

export function createWorkspaceOnAirController(input: {
  now: () => number
  setTimeout: typeof globalThis.setTimeout
  clearTimeout: typeof globalThis.clearTimeout
}): WorkspaceOnAirController {
  let state = createWorkspaceOnAirState()
  let session: ManagedOnAirSession | null = null
  let resumableSession: ManagedOnAirSessionSeed | null = null
  const listeners = new Set<(state: WorkspaceOnAirState) => void>()

  const emit = () => {
    for (const listener of listeners) {
      listener(state)
    }
  }

  const updateState = (nextCurrent: WorkspaceOnAirSnapshot | null) => {
    state = nextCurrent === null
      ? {
        current: null,
        lastPlayed: state.current ?? state.lastPlayed,
      }
      : {
        current: nextCurrent,
        lastPlayed: nextCurrent,
      }
    emit()
  }

  const cloneSessionSeed = (value: ManagedOnAirSession): ManagedOnAirSessionSeed => ({
    mode: value.mode,
    order: [...value.order],
    items: new Map(
      [...value.items.entries()]
        .filter(([, item]) => item.active)
        .map(([graphicConfigId, item]) => [graphicConfigId, {
          graphic: item.graphic,
          content: item.content,
          backgroundImagePath: item.backgroundImagePath,
          entityLabel: item.entityLabel,
        }]),
    ),
  })

  const startSession = (seed: ManagedOnAirSessionSeed) => {
    clearAllTimers()
    session = {
      mode: seed.mode,
      order: [...seed.order],
      items: new Map(
        [...seed.items.entries()].map(([graphicConfigId, item]) => [graphicConfigId, {
          graphic: item.graphic,
          content: item.content,
          backgroundImagePath: item.backgroundImagePath,
          entityLabel: item.entityLabel,
          active: true,
        }]),
      ),
      timerHandles: new Map(),
    }

    resumableSession = cloneSessionSeed(session)
    for (const item of session.items.values()) {
      scheduleIfTimed(item)
    }
    rebuildSnapshot()
  }

  const clearTimer = (graphicConfigId: string) => {
    const timerHandle = session?.timerHandles.get(graphicConfigId)
    if (timerHandle !== undefined) {
      input.clearTimeout(timerHandle)
      session?.timerHandles.delete(graphicConfigId)
    }
  }

  const clearAllTimers = () => {
    if (!session) {
      return
    }

    for (const graphicConfigId of session.timerHandles.keys()) {
      clearTimer(graphicConfigId)
    }
  }

  const rebuildSnapshot = () => {
    if (!session) {
      updateState(null)
      return
    }

    const currentSession = session
    const activeItems = currentSession.order
      .map((graphicConfigId) => currentSession.items.get(graphicConfigId))
      .filter((item): item is ManagedOnAirItem => item !== undefined && item.active)

    if (activeItems.length === 0) {
      session = null
      updateState(null)
      return
    }

    resumableSession = cloneSessionSeed(currentSession)

    if (currentSession.mode === 'single') {
      const activeItem = activeItems[0]
      updateState(createSingleOnAirSnapshot({
        graphic: activeItem.graphic,
        content: activeItem.content,
        backgroundImagePath: activeItem.backgroundImagePath,
        entityLabel: activeItem.entityLabel,
        ...describeOnAirSnapshotStatus(activeItems),
      }))
      return
    }

    const primaryItem = activeItems[0]
    updateState(createGroupedOnAirSnapshot({
      primaryGraphic: primaryItem.graphic,
      primaryContent: primaryItem.content,
      primaryEntityLabel: primaryItem.entityLabel,
      backgroundImagePath: primaryItem.backgroundImagePath,
      itemCount: activeItems.length,
      ...describeOnAirSnapshotStatus(activeItems),
      compositeItems: activeItems.slice(1).map((item) => ({
        graphicConfigId: item.graphic.id,
        zIndex: item.graphic.zIndex,
        template: item.graphic.preview,
        content: item.content,
      })),
    }))
  }

  const deactivateGraphic = (graphicConfigId: string) => {
    if (!session) {
      return
    }

    const item = session.items.get(graphicConfigId)
    if (!item) {
      return
    }

    clearTimer(graphicConfigId)
    item.active = false
    rebuildSnapshot()
  }

  const scheduleIfTimed = (item: ManagedOnAirItem) => {
    clearTimer(item.graphic.id)

    if (item.graphic.onAir?.mode !== 'autoHide') {
      return
    }

    const durationSeconds = item.graphic.onAir.durationSeconds
    if (durationSeconds === undefined || durationSeconds <= 0) {
      return
    }

    const expiresAt = input.now() + durationSeconds * 1000
    item.expiresAt = expiresAt
    const timerHandle = input.setTimeout(() => {
      if (!session) {
        return
      }

      const currentItem = session.items.get(item.graphic.id)
      if (!currentItem || currentItem.expiresAt !== expiresAt) {
        return
      }

      deactivateGraphic(item.graphic.id)
    }, durationSeconds * 1000)

    session?.timerHandles.set(item.graphic.id, timerHandle)
  }

  return {
    getState() {
      return state
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(state)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      clearAllTimers()
      listeners.clear()
      session = null
      resumableSession = null
      state = createWorkspaceOnAirState()
    },
    reset() {
      clearAllTimers()
      session = null
      resumableSession = null
      state = createWorkspaceOnAirState()
      emit()
    },
    playSingle({ graphic, content, backgroundImagePath, entityLabel }) {
      startSession({
        mode: 'single',
        order: [graphic.id],
        items: new Map([
          [graphic.id, {
            graphic,
            content,
            backgroundImagePath,
            entityLabel,
          }],
        ]),
      })
    },
    playGrouped({ primaryGraphic, primaryContent, primaryEntityLabel, backgroundImagePath, items }) {
      const managedItems = new Map<string, Omit<ManagedOnAirItem, 'active' | 'expiresAt'>>()
      const order: string[] = []

      const upsertItem = (item: Omit<ManagedOnAirItem, 'active' | 'expiresAt'>) => {
        managedItems.set(item.graphic.id, item)
        if (!order.includes(item.graphic.id)) {
          order.push(item.graphic.id)
        }
      }

      upsertItem({
        graphic: primaryGraphic,
        content: primaryContent,
        backgroundImagePath,
        entityLabel: primaryEntityLabel,
      })

      for (const item of items) {
        upsertItem({
          graphic: item.graphic,
          content: item.content,
          entityLabel: item.entityLabel,
        })
      }

      startSession({
        mode: 'grouped',
        order,
        items: managedItems,
      })
    },
    stopCurrent() {
      if (!session) {
        return
      }

      clearAllTimers()
      session = null
      updateState(null)
    },
    stopGraphic(graphicConfigId) {
      deactivateGraphic(graphicConfigId)
    },
    resume() {
      if (!resumableSession || resumableSession.items.size === 0) {
        state = {
          current: state.lastPlayed,
          lastPlayed: state.lastPlayed,
        }
        emit()
        return
      }

      startSession(resumableSession)
    },
  }
}

interface ManagedOnAirItem {
  graphic: GraphicInstanceConfig
  content: Record<string, string | undefined>
  backgroundImagePath?: string
  entityLabel?: string
  active: boolean
  expiresAt?: number
}

interface ManagedOnAirSession {
  mode: 'single' | 'grouped'
  order: string[]
  items: Map<string, ManagedOnAirItem>
  timerHandles: Map<string, ReturnType<typeof globalThis.setTimeout>>
}

interface ManagedOnAirSessionSeed {
  mode: 'single' | 'grouped'
  order: string[]
  items: Map<string, Omit<ManagedOnAirItem, 'active' | 'expiresAt'>>
}

function describeOnAirSnapshotStatus(activeItems: ManagedOnAirItem[]): {
  statusBadge?: string
  statusDetail?: string
} {
  const timedDurations = activeItems
    .filter((item) => item.graphic.onAir?.mode === 'autoHide' && item.graphic.onAir.durationSeconds !== undefined)
    .map((item) => item.graphic.onAir!.durationSeconds as number)

  if (timedDurations.length === 0) {
    return {
      statusBadge: 'Manual on-air',
      statusDetail: 'Stays on-air until Stop.',
    }
  }

  if (activeItems.length === 1) {
    return {
      statusBadge: 'Timed on-air',
      statusDetail: `Auto-hide after ${timedDurations[0]}s.`,
    }
  }

  const shortestDuration = Math.min(...timedDurations)
  return {
    statusBadge: 'Timed items active',
    statusDetail: `Auto-hide running for ${timedDurations.length} item${timedDurations.length === 1 ? '' : 's'} (from ${shortestDuration}s).`,
  }
}
