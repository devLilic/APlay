export type NotificationVariant = 'success' | 'warning' | 'danger'
const defaultNotificationTimeoutMs = 10000

export interface NotificationRecord {
  id: string
  variant: NotificationVariant
  title?: string
  message: string
  timeoutMs?: number
}

export interface NotificationStore {
  getNotifications: () => NotificationRecord[]
  publish: (input: Omit<NotificationRecord, 'id'>) => string
  dismiss: (id: string) => void
  subscribe: (listener: () => void) => () => void
}

export function createNotificationStore(): NotificationStore {
  let notifications: NotificationRecord[] = []
  let sequence = 0
  const listeners = new Set<() => void>()
  const dismissalTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const notifyListeners = () => {
    listeners.forEach((listener) => listener())
  }

  const clearDismissalTimer = (id: string) => {
    const timer = dismissalTimers.get(id)
    if (!timer) {
      return
    }

    clearTimeout(timer)
    dismissalTimers.delete(id)
  }

  return {
    getNotifications() {
      return notifications
    },
    publish(input) {
      const id = `notification-${sequence += 1}`
      const notification: NotificationRecord = {
        ...input,
        id,
        timeoutMs: input.timeoutMs ?? defaultNotificationTimeoutMs,
      }

      notifications = [...notifications, notification]

      if (notification.timeoutMs && notification.timeoutMs > 0) {
        const timer = setTimeout(() => {
          clearDismissalTimer(id)
          notifications = notifications.filter((item) => item.id !== id)
          notifyListeners()
        }, notification.timeoutMs)

        dismissalTimers.set(id, timer)
      }

      notifyListeners()

      return id
    },
    dismiss(id) {
      const nextNotifications = notifications.filter((item) => item.id !== id)
      if (nextNotifications.length === notifications.length) {
        return
      }

      clearDismissalTimer(id)
      notifications = nextNotifications
      notifyListeners()
    },
    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}
