import type { NotificationStore } from '@/features/notifications/state/notificationStore'
import type { SettingsFeedback } from '@/features/settings/components/SettingsPanel'
import type { SelectedEntityControlFeedback } from '@/features/workspace/state/selectedEntityControl'

export function publishWorkspaceShellNotifications(input: {
  store: NotificationStore
  sourceRefreshFeedback: SettingsFeedback | null
  settingsFeedback: SettingsFeedback | null
  executionFeedback: SelectedEntityControlFeedback | null
}) {
  if (input.sourceRefreshFeedback) {
    input.store.publish({
      variant: input.sourceRefreshFeedback.kind === 'success' ? 'success' : 'danger',
      message: input.sourceRefreshFeedback.message,
    })
  }

  if (input.settingsFeedback) {
    input.store.publish({
      variant: input.settingsFeedback.kind === 'success' ? 'success' : 'danger',
      message: input.settingsFeedback.message,
    })
  }

  if (input.executionFeedback) {
    input.store.publish({
      variant: input.executionFeedback.kind === 'success' ? 'success' : 'danger',
      message: [input.executionFeedback.title, ...input.executionFeedback.details].join(' | '),
    })
  }
}
