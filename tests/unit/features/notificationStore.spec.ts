import { describe, expect, it, vi } from 'vitest'
import { createNotificationStore } from '@/features/notifications/state/notificationStore'

describe('notification store', () => {
  it('stores new notifications with message text and variant', () => {
    const store = createNotificationStore()

    store.publish({
      variant: 'success',
      message: 'Source refreshed.',
    })

    expect(store.getNotifications()).toHaveLength(1)
    expect(store.getNotifications()[0]).toMatchObject({
      variant: 'success',
      message: 'Source refreshed.',
    })
  })

  it('keeps multiple notifications stacked in insertion order', () => {
    const store = createNotificationStore()

    store.publish({ variant: 'success', message: 'Settings saved.' })
    store.publish({ variant: 'warning', message: 'Schema warning.' })
    store.publish({ variant: 'danger', message: 'Output failed.' })

    expect(store.getNotifications().map((item) => item.message)).toEqual([
      'Settings saved.',
      'Schema warning.',
      'Output failed.',
    ])
  })

  it('allows manual dismissal by id', () => {
    const store = createNotificationStore()
    const firstId = store.publish({ variant: 'success', message: 'Settings saved.' })
    store.publish({ variant: 'warning', message: 'Preview warning.' })

    store.dismiss(firstId)

    expect(store.getNotifications()).toHaveLength(1)
    expect(store.getNotifications()[0]?.message).toBe('Preview warning.')
  })

  it('supports automatic dismissal after a configured timeout', () => {
    vi.useFakeTimers()

    const store = createNotificationStore()
    store.publish({
      variant: 'danger',
      message: 'Execution failed.',
      timeoutMs: 2000,
    })

    vi.advanceTimersByTime(1999)
    expect(store.getNotifications()).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(store.getNotifications()).toHaveLength(0)

    vi.useRealTimers()
  })

  it('notifies subscribers when notifications are published and dismissed', () => {
    const store = createNotificationStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    const id = store.publish({ variant: 'success', message: 'Source refreshed.' })
    store.dismiss(id)
    unsubscribe()

    expect(listener).toHaveBeenCalledTimes(2)
  })
})
