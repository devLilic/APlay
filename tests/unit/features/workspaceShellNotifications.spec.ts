import { describe, expect, it, vi } from 'vitest'
import { publishWorkspaceShellNotifications } from '@/features/workspace/components/workspaceShellNotifications'
import type { NotificationStore } from '@/features/notifications/state/notificationStore'

function createStoreStub(): NotificationStore {
  return {
    getNotifications: () => [],
    publish: vi.fn(() => 'notification-id'),
    dismiss: vi.fn(),
    subscribe: () => () => {},
  }
}

describe('workspace shell notification publishing', () => {
  it('publishes source refresh feedback through the notification system', () => {
    const store = createStoreStub()

    publishWorkspaceShellNotifications({
      store,
      sourceRefreshFeedback: { kind: 'success', message: 'Source refreshed from C:\\News\\source.csv.' },
      settingsFeedback: null,
      executionFeedback: null,
    })

    expect(store.publish).toHaveBeenCalledWith({
      variant: 'success',
      message: 'Source refreshed from C:\\News\\source.csv.',
    })
  })

  it('publishes settings feedback through the notification system', () => {
    const store = createStoreStub()

    publishWorkspaceShellNotifications({
      store,
      sourceRefreshFeedback: null,
      settingsFeedback: { kind: 'error', message: 'Settings save failed.' },
      executionFeedback: null,
    })

    expect(store.publish).toHaveBeenCalledWith({
      variant: 'danger',
      message: 'Settings save failed.',
    })
  })

  it('publishes critical execution feedback through the notification system', () => {
    const store = createStoreStub()

    publishWorkspaceShellNotifications({
      store,
      sourceRefreshFeedback: null,
      settingsFeedback: null,
      executionFeedback: {
        kind: 'error',
        title: 'Output failed',
        details: ['OSC transport error', 'Datasource unavailable'],
      },
    })

    expect(store.publish).toHaveBeenCalledWith({
      variant: 'danger',
      message: 'Output failed | OSC transport error | Datasource unavailable',
    })
  })

  it('can publish multiple feedback channels without requiring inline shell banners', () => {
    const store = createStoreStub()

    publishWorkspaceShellNotifications({
      store,
      sourceRefreshFeedback: { kind: 'success', message: 'Source refreshed.' },
      settingsFeedback: { kind: 'success', message: 'Settings saved.' },
      executionFeedback: {
        kind: 'success',
        title: 'playGraphic completed',
        details: ['OSC sent: /play'],
      },
    })

    expect(store.publish).toHaveBeenCalledTimes(3)
    expect(store.publish).toHaveBeenNthCalledWith(1, {
      variant: 'success',
      message: 'Source refreshed.',
    })
    expect(store.publish).toHaveBeenNthCalledWith(2, {
      variant: 'success',
      message: 'Settings saved.',
    })
    expect(store.publish).toHaveBeenNthCalledWith(3, {
      variant: 'success',
      message: 'playGraphic completed | OSC sent: /play',
    })
  })
})
