import { useEffect, useState, type PropsWithChildren } from 'react'
import { I18nextProvider } from 'react-i18next'
import type { AppConfig } from '../../config/types'
import { createI18nInstance, isI18nEnabled, resolveLanguage } from '@/i18n'
import { NotificationsProvider } from '@/features/notifications/notificationsContext'

interface AppProvidersProps extends PropsWithChildren {
  config: AppConfig
}

export function AppProviders({ children, config }: AppProvidersProps) {
  const [i18n] = useState(() => createI18nInstance(config))

  useEffect(() => {
    if (!isI18nEnabled(config)) {
      return
    }

    void window.i18nApi.getCurrentLanguage().then(({ language }) => {
      void i18n.changeLanguage(resolveLanguage(language, config))
    })
  }, [config, i18n])

  const content = isI18nEnabled(config)
    ? (
      <I18nextProvider i18n={i18n}>
        {children}
      </I18nextProvider>
    )
    : children

  return (
    <NotificationsProvider>
      {content}
    </NotificationsProvider>
  )
}
