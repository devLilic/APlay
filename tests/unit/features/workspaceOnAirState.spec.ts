import { describe, expect, it } from 'vitest'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import {
  applyWorkspaceOnAirEvent,
  createGroupedOnAirSnapshot,
  createSingleOnAirSnapshot,
  createWorkspaceOnAirState,
} from '@/features/workspace/state/workspaceOnAirState'

const titleGraphic: GraphicInstanceConfig = {
  id: 'title-main',
  name: 'Title main',
  entityType: 'title',
  dataFileName: 'title-main.json',
  control: { templateName: 'TITLE_MAIN' },
  preview: {
    id: 'title-main-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [],
  },
  actions: [],
}

const phoneGraphic: GraphicInstanceConfig = {
  id: 'phone-main',
  name: 'Phone main',
  entityType: 'phone',
  dataFileName: 'phone-main.json',
  control: { templateName: 'PHONE_MAIN' },
  preview: {
    id: 'phone-main-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [],
  },
  actions: [],
}

describe('workspaceOnAirState', () => {
  it('stores a single played graphic as the current and resumable on-air snapshot', () => {
    const snapshot = createSingleOnAirSnapshot({
      graphic: titleGraphic,
      content: { text: 'Breaking news' },
      backgroundImagePath: 'assets/bg.png',
      entityLabel: 'Breaking news',
    })

    const nextState = applyWorkspaceOnAirEvent(
      createWorkspaceOnAirState(),
      { type: 'play', snapshot },
    )

    expect(nextState.current).toEqual(snapshot)
    expect(nextState.lastPlayed).toEqual(snapshot)
  })

  it('clears the active on-air output on stop but keeps the last played snapshot for resume', () => {
    const snapshot = createSingleOnAirSnapshot({
      graphic: titleGraphic,
      content: { text: 'Breaking news' },
      entityLabel: 'Breaking news',
    })

    const playedState = applyWorkspaceOnAirEvent(
      createWorkspaceOnAirState(),
      { type: 'play', snapshot },
    )
    const stoppedState = applyWorkspaceOnAirEvent(playedState, { type: 'stop' })

    expect(stoppedState.current).toBeNull()
    expect(stoppedState.lastPlayed).toEqual(snapshot)
  })

  it('restores the last played snapshot on resume', () => {
    const snapshot = createSingleOnAirSnapshot({
      graphic: titleGraphic,
      content: { text: 'Breaking news' },
      entityLabel: 'Breaking news',
    })

    const resumedState = applyWorkspaceOnAirEvent(
      applyWorkspaceOnAirEvent(
        applyWorkspaceOnAirEvent(createWorkspaceOnAirState(), { type: 'play', snapshot }),
        { type: 'stop' },
      ),
      { type: 'resume' },
    )

    expect(resumedState.current).toEqual(snapshot)
    expect(resumedState.lastPlayed).toEqual(snapshot)
  })

  it('builds a grouped on-air snapshot that keeps the primary frame and overlay items together', () => {
    const snapshot = createGroupedOnAirSnapshot({
      primaryGraphic: titleGraphic,
      primaryContent: { text: 'Breaking news' },
      primaryEntityLabel: 'Breaking news',
      itemCount: 2,
      compositeItems: [
        {
          graphicConfigId: phoneGraphic.id,
          zIndex: 10,
          template: phoneGraphic.preview,
          content: { label: 'Phone', number: '123' },
        },
      ],
    })

    expect(snapshot.mode).toBe('grouped')
    expect(snapshot.itemCount).toBe(2)
    expect(snapshot.title).toBe('Title main')
    expect(snapshot.compositeItems).toHaveLength(1)
  })
})
