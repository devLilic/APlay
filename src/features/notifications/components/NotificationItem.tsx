import type { NotificationRecord } from '@/features/notifications/state/notificationStore'
import { getStateBadgeClassName } from '@/shared/ui/theme'

interface NotificationItemProps {
  notification: NotificationRecord
  onDismiss: () => void
}

const bannerVariantClassNames = {
  success: 'border-state-active/60 bg-panel text-emerald-200',
  warning: 'border-state-warning/60 bg-panel text-amber-200',
  danger: 'border-state-danger/60 bg-panel text-red-200',
} as const

const badgeVariantState = {
  success: 'active',
  warning: 'warning',
  danger: 'invalid',
} as const

export function NotificationItem({ notification, onDismiss }: NotificationItemProps) {
  return (
    <div
      className={`ap-banner ${bannerVariantClassNames[notification.variant]} pointer-events-auto w-full min-w-0 rounded-xl border px-4 py-3 shadow-panel transition-colors hover:bg-surface-raised`}
      data-notification-id={notification.id}
      aria-live={notification.variant === 'danger' ? 'assertive' : 'polite'}
      role='status'
      onClick={onDismiss}
    >
      <div className='flex items-start gap-3'>
        <div className='min-w-0 flex-1 space-y-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <span className={getStateBadgeClassName(badgeVariantState[notification.variant])}>
              {notification.variant === 'danger' ? 'Error' : notification.variant}
            </span>
            {notification.title ? (
              <p className='ap-item-label text-sm font-semibold text-app-text'>{notification.title}</p>
            ) : null}
          </div>
          <p className='ap-copy break-words whitespace-pre-wrap text-sm leading-6 text-app-text'>
            {notification.message}
          </p>
        </div>
        <button
          aria-label='Dismiss notification'
          className='inline-flex h-8 w-8 items-center justify-center rounded-md border border-app-border bg-app-card text-app-text-secondary transition-colors hover:border-app-border-strong hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-panel'
          type='button'
          onClick={(event) => {
            event.stopPropagation()
            onDismiss()
          }}
        >
          <span aria-hidden='true' className='text-sm leading-none'>x</span>
        </button>
      </div>
    </div>
  )
}
