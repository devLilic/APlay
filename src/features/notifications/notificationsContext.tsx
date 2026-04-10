import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react'
import { NotificationHost } from '@/features/notifications/components/NotificationHost'
import {
  createNotificationStore,
  type NotificationRecord,
  type NotificationStore,
} from '@/features/notifications/state/notificationStore'

const NotificationStoreContext = createContext<NotificationStore | null>(null)

export function NotificationsProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => createNotificationStore())

  return (
    <NotificationStoreContext.Provider value={store}>
      {children}
      <NotificationHost store={store} />
    </NotificationStoreContext.Provider>
  )
}

export function useNotificationStore(): NotificationStore {
  const store = useContext(NotificationStoreContext)
  if (!store) {
    throw new Error('useNotificationStore must be used within NotificationsProvider.')
  }

  return store
}

export function useNotifications() {
  const store = useNotificationStore()
  const notifications = useSyncExternalStore(
    store.subscribe,
    store.getNotifications,
    store.getNotifications,
  )

  return {
    notifications,
    publishNotification: (input: Omit<NotificationRecord, 'id'>) => store.publish(input),
    dismissNotification: (id: string) => store.dismiss(id),
    notificationStore: store,
  }
}
