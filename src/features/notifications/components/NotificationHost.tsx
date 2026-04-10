import { useSyncExternalStore } from 'react'
import type { NotificationStore } from '@/features/notifications/state/notificationStore'
import { NotificationItem } from '@/features/notifications/components/NotificationItem'

interface NotificationHostProps {
  store: NotificationStore
}

export function NotificationHost({ store }: NotificationHostProps) {
  const notifications = useSyncExternalStore(
    store.subscribe,
    store.getNotifications,
    store.getNotifications,
  )

  return (
    <div className='pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 sm:bottom-6 sm:right-6'>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => store.dismiss(notification.id)}
        />
      ))}
    </div>
  )
}
