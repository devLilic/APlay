import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NotificationHost } from '@/features/notifications/components/NotificationHost'
import { NotificationItem } from '@/features/notifications/components/NotificationItem'
import type { NotificationRecord, NotificationStore } from '@/features/notifications/state/notificationStore'

function createStoreStub(notifications: NotificationRecord[]): NotificationStore {
  return {
    getNotifications: () => notifications,
    publish: () => 'stub-id',
    dismiss: vi.fn(),
    subscribe: () => () => {},
  }
}

describe('NotificationItem', () => {
  it('renders success, warning, and danger messages with readable content', () => {
    const successHtml = renderToStaticMarkup(
      <NotificationItem
        notification={{ id: 'success-1', variant: 'success', message: 'Settings saved.' }}
        onDismiss={vi.fn()}
      />,
    )
    const warningHtml = renderToStaticMarkup(
      <NotificationItem
        notification={{ id: 'warning-1', variant: 'warning', message: 'Schema warning.' }}
        onDismiss={vi.fn()}
      />,
    )
    const dangerHtml = renderToStaticMarkup(
      <NotificationItem
        notification={{ id: 'danger-1', variant: 'danger', message: 'Execution failed.' }}
        onDismiss={vi.fn()}
      />,
    )

    expect(successHtml).toContain('Settings saved.')
    expect(successHtml).toContain('ap-banner-success')
    expect(warningHtml).toContain('Schema warning.')
    expect(warningHtml).toContain('ap-banner-warning')
    expect(dangerHtml).toContain('Execution failed.')
    expect(dangerHtml).toContain('ap-banner-danger')
  })

  it('renders a manual dismiss button', () => {
    const html = renderToStaticMarkup(
      <NotificationItem
        notification={{ id: 'success-1', variant: 'success', message: 'Settings saved.' }}
        onDismiss={vi.fn()}
      />,
    )

    expect(html).toContain('Dismiss notification')
    expect(html).toContain('button')
  })
})

describe('NotificationHost', () => {
  it('renders a fixed container in the bottom-right corner without depending on the main layout flow', () => {
    const html = renderToStaticMarkup(
      <NotificationHost
        store={createStoreStub([{ id: 'success-1', variant: 'success', message: 'Source refreshed.' }])}
      />,
    )

    expect(html).toContain('fixed')
    expect(html).toContain('bottom-4')
    expect(html).toContain('right-4')
    expect(html).toContain('z-50')
  })

  it('stacks multiple notifications vertically in the bottom-right host', () => {
    const html = renderToStaticMarkup(
      <NotificationHost
        store={createStoreStub([
          { id: 'success-1', variant: 'success', message: 'Settings saved.' },
          { id: 'warning-1', variant: 'warning', message: 'Schema warning.' },
          { id: 'danger-1', variant: 'danger', message: 'Execution failed.' },
        ])}
      />,
    )

    expect(html).toContain('flex-col')
    expect(html).toContain('gap-3')
    expect(html).toContain('Settings saved.')
    expect(html).toContain('Schema warning.')
    expect(html).toContain('Execution failed.')
  })
})
