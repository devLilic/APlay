import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import * as workspaceOnAirModule from '@/features/workspace/state/workspaceOnAirState'
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

const staticLogoGraphic: GraphicInstanceConfig = {
  id: 'logo-main',
  name: 'Logo main',
  entityType: 'image',
  kind: 'static',
  dataFileName: 'logo-main.json',
  control: { templateName: 'LOGO_MAIN' },
  preview: {
    id: 'logo-main-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [],
  },
  actions: [],
}

afterEach(() => {
  vi.useRealTimers()
})

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

  it('supports static image graphics in preview and ONAIR snapshots without entity datasource fields', () => {
    const snapshot = createSingleOnAirSnapshot({
      graphic: staticLogoGraphic,
      content: { staticAsset: 'assets/logo.png' },
    })

    expect(snapshot.title).toBe('Logo main')
    expect(snapshot.description).toBe('Logo main is on air.')
    expect(snapshot.content).toEqual({ staticAsset: 'assets/logo.png' })
  })

  it('supports per-graphic auto-hide timers for single-item ONAIR playback', () => {
    vi.useFakeTimers()

    const controller = workspaceOnAirModule.createWorkspaceOnAirController({
      now: () => Date.now(),
      setTimeout,
      clearTimeout,
    })

    controller.playSingle({
      graphic: {
        ...titleGraphic,
        onAir: {
          mode: 'autoHide',
          durationSeconds: 5,
        },
      },
      content: { text: 'Breaking news' },
      entityLabel: 'Breaking news',
    })

    expect(controller.getState().current?.title).toBe('Title main')

    vi.advanceTimersByTime(4999)
    expect(controller.getState().current?.title).toBe('Title main')

    vi.advanceTimersByTime(1)
    expect(controller.getState().current).toBeNull()
  })

  it('keeps timed and manual on-air behavior working for static image graphics', () => {
    vi.useFakeTimers()

    const controller = workspaceOnAirModule.createWorkspaceOnAirController({
      now: () => Date.now(),
      setTimeout,
      clearTimeout,
    })

    controller.playSingle({
      graphic: {
        ...staticLogoGraphic,
        onAir: {
          mode: 'autoHide',
          durationSeconds: 3,
        },
      },
      content: { staticAsset: 'assets/logo.png' },
    })

    expect(controller.getState().current?.title).toBe('Logo main')
    expect(controller.getState().current?.statusBadge).toBe('Timed on-air')

    vi.advanceTimersByTime(3000)
    expect(controller.getState().current).toBeNull()

    controller.playSingle({
      graphic: {
        ...staticLogoGraphic,
        onAir: {
          mode: 'manual',
        },
      },
      content: { staticAsset: 'assets/logo.png' },
    })

    vi.advanceTimersByTime(3000)
    expect(controller.getState().current?.title).toBe('Logo main')

    controller.stopGraphic(staticLogoGraphic.id)
    expect(controller.getState().current).toBeNull()

    controller.resume()
    expect(controller.getState().current?.title).toBe('Logo main')
  })

  it('keeps manual ONAIR items active until Stop and cancels auto-hide on manual stop', () => {
    vi.useFakeTimers()

    const controller = workspaceOnAirModule.createWorkspaceOnAirController({
      now: () => Date.now(),
      setTimeout,
      clearTimeout,
    })

    controller.playSingle({
      graphic: {
        ...titleGraphic,
        onAir: {
          mode: 'manual',
        },
      },
      content: { text: 'Manual title' },
    })

    vi.advanceTimersByTime(30000)
    expect(controller.getState().current?.title).toBe('Title main')

    controller.playSingle({
      graphic: {
        ...titleGraphic,
        onAir: {
          mode: 'autoHide',
          durationSeconds: 5,
        },
      },
      content: { text: 'Timed title' },
    })
    controller.stopGraphic(titleGraphic.id)

    expect(controller.getState().current).toBeNull()

    vi.advanceTimersByTime(5000)
    expect(controller.getState().current).toBeNull()
  })

  it('resets the timer when Play is triggered again for the same graphic and updates grouped ONAIR activity with fake timers', () => {
    vi.useFakeTimers()

    const controller = workspaceOnAirModule.createWorkspaceOnAirController({
      now: () => Date.now(),
      setTimeout,
      clearTimeout,
    })

    controller.playSingle({
      graphic: {
        ...titleGraphic,
        onAir: {
          mode: 'autoHide',
          durationSeconds: 5,
        },
      },
      content: { text: 'First play' },
    })

    vi.advanceTimersByTime(3000)

    controller.playSingle({
      graphic: {
        ...titleGraphic,
        onAir: {
          mode: 'autoHide',
          durationSeconds: 5,
        },
      },
      content: { text: 'Second play' },
    })

    vi.advanceTimersByTime(3000)
    expect(controller.getState().current?.content.text).toBe('Second play')

    vi.advanceTimersByTime(2000)
    expect(controller.getState().current).toBeNull()

    controller.playGrouped({
      primaryGraphic: {
        ...titleGraphic,
        onAir: {
          mode: 'manual',
        },
      },
      primaryContent: { text: 'Grouped title' },
      items: [
        {
          graphic: {
            ...phoneGraphic,
            onAir: {
              mode: 'autoHide',
              durationSeconds: 4,
            },
          },
          content: { label: 'Phone', number: '123' },
        },
      ],
    })

    expect(controller.getState().current?.mode).toBe('grouped')
    expect(controller.getState().current?.itemCount).toBe(2)
    expect(controller.getState().current?.compositeItems).toHaveLength(1)

    vi.advanceTimersByTime(4000)

    expect(controller.getState().current?.mode).toBe('grouped')
    expect(controller.getState().current?.itemCount).toBe(1)
    expect(controller.getState().current?.compositeItems).toHaveLength(0)
    expect(controller.getState().current?.title).toBe('Title main')
  })

  it('handles very small timed durations and ignores stop after auto-hide already completed', () => {
    vi.useFakeTimers()

    const controller = workspaceOnAirModule.createWorkspaceOnAirController({
      now: () => Date.now(),
      setTimeout,
      clearTimeout,
    })

    controller.playSingle({
      graphic: {
        ...titleGraphic,
        onAir: {
          mode: 'autoHide',
          durationSeconds: 0.05,
        },
      },
      content: { text: 'Fast title' },
    })

    vi.advanceTimersByTime(50)
    expect(controller.getState().current).toBeNull()

    controller.stopGraphic(titleGraphic.id)
    expect(controller.getState().current).toBeNull()
  })

  it('keeps only the latest timer active during rapid repeated play calls', () => {
    vi.useFakeTimers()

    const controller = workspaceOnAirModule.createWorkspaceOnAirController({
      now: () => Date.now(),
      setTimeout,
      clearTimeout,
    })

    controller.playSingle({
      graphic: {
        ...titleGraphic,
        onAir: {
          mode: 'autoHide',
          durationSeconds: 1,
        },
      },
      content: { text: 'Play 1' },
    })

    vi.advanceTimersByTime(300)
    controller.playSingle({
      graphic: {
        ...titleGraphic,
        onAir: {
          mode: 'autoHide',
          durationSeconds: 1,
        },
      },
      content: { text: 'Play 2' },
    })

    vi.advanceTimersByTime(300)
    controller.playSingle({
      graphic: {
        ...titleGraphic,
        onAir: {
          mode: 'autoHide',
          durationSeconds: 1,
        },
      },
      content: { text: 'Play 3' },
    })

    vi.advanceTimersByTime(999)
    expect(controller.getState().current?.content.text).toBe('Play 3')

    vi.advanceTimersByTime(1)
    expect(controller.getState().current).toBeNull()
  })

  it('stops all grouped timers together and resumes the last coherent grouped snapshot', () => {
    vi.useFakeTimers()

    const controller = workspaceOnAirModule.createWorkspaceOnAirController({
      now: () => Date.now(),
      setTimeout,
      clearTimeout,
    })

    controller.playGrouped({
      primaryGraphic: {
        ...titleGraphic,
        onAir: {
          mode: 'manual',
        },
      },
      primaryContent: { text: 'Grouped title' },
      items: [
        {
          graphic: {
            ...phoneGraphic,
            onAir: {
              mode: 'autoHide',
              durationSeconds: 2,
            },
          },
          content: { label: 'Phone', number: '111' },
        },
        {
          graphic: {
            ...phoneGraphic,
            id: 'phone-secondary',
            name: 'Phone secondary',
            onAir: {
              mode: 'autoHide',
              durationSeconds: 4,
            },
          },
          content: { label: 'Phone 2', number: '222' },
        },
      ],
    })

    expect(controller.getState().current?.itemCount).toBe(3)

    controller.stopCurrent()
    expect(controller.getState().current).toBeNull()

    vi.advanceTimersByTime(5000)
    expect(controller.getState().current).toBeNull()

    controller.resume()
    expect(controller.getState().current?.mode).toBe('grouped')
    expect(controller.getState().current?.itemCount).toBe(3)

    vi.advanceTimersByTime(2000)
    expect(controller.getState().current?.itemCount).toBe(2)

    vi.advanceTimersByTime(2000)
    expect(controller.getState().current?.itemCount).toBe(1)
    expect(controller.getState().current?.title).toBe('Title main')
  })
})
