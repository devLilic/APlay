import type { ReactNode } from 'react'
import { PreviewCanvas } from '@/features/preview/components/PreviewCanvas'
import type { AppSettings, GraphicInstanceConfig } from '@/settings/models/appConfig'
import { resolveActivePreviewBackground } from '@/settings/utils/previewBackgrounds'
import { getControlButtonClassName, getStateBadgeClassName } from '@/shared/ui/theme'

export interface SettingsTabMeta {
  id: string
  label: string
  description: string
}

export function SettingsHeaderActions({
  isImportingProfile,
  isImportingGraphicConfig,
  canExportProfile,
  canExportGraphic,
  isExportingProfile,
  isExportingGraphicConfig,
  canSave,
  onImportProfile,
  onImportGraphicConfig,
  onExportProfile,
  onExportGraphicConfig,
  onReload,
  onSave,
}: {
  isImportingProfile: boolean
  isImportingGraphicConfig: boolean
  canExportProfile: boolean
  canExportGraphic: boolean
  isExportingProfile: boolean
  isExportingGraphicConfig: boolean
  canSave: boolean
  onImportProfile: () => void
  onImportGraphicConfig: () => void
  onExportProfile: () => void
  onExportGraphicConfig: () => void
  onReload: () => void
  onSave: () => void
}) {
  return (
    <div className='flex flex-wrap gap-2'>
      <button
        type='button'
        onClick={onImportProfile}
        disabled={isImportingProfile}
        className={getControlButtonClassName()}
      >
        {isImportingProfile ? 'Importing profile...' : 'Import profile'}
      </button>
      <button
        type='button'
        onClick={onImportGraphicConfig}
        disabled={isImportingGraphicConfig}
        className={getControlButtonClassName()}
      >
        {isImportingGraphicConfig ? 'Importing graphic...' : 'Import graphic'}
      </button>
      <button
        type='button'
        onClick={onExportProfile}
        disabled={!canExportProfile || isExportingProfile}
        className={getControlButtonClassName()}
      >
        {isExportingProfile ? 'Exporting profile...' : 'Export profile'}
      </button>
      <button
        type='button'
        onClick={onExportGraphicConfig}
        disabled={!canExportGraphic || isExportingGraphicConfig}
        className={getControlButtonClassName()}
      >
        {isExportingGraphicConfig ? 'Exporting graphic...' : 'Export graphic'}
      </button>
      <button
        type='button'
        onClick={onReload}
        className={getControlButtonClassName({ variant: 'ghost' })}
      >
        Reload
      </button>
      <button
        type='button'
        onClick={onSave}
        disabled={!canSave}
        className={getControlButtonClassName({ tone: 'selected', variant: 'solid' })}
      >
        Save settings
      </button>
    </div>
  )
}

export function SettingsIntroCard() {
  return (
    <div className='ap-card-muted p-4'>
      <p className='ap-section-title'>Preview settings are APlay-side only</p>
      <p className='mt-1 ap-copy'>
        These forms edit the application preview approximation and output bindings. LiveBoard styling is not edited here.
      </p>
      <p className='mt-2 ap-copy'>
        Import actions use the local storage services and validation pipeline. They do not trigger playback, OSC, or datasource publishing.
      </p>
    </div>
  )
}

export function SettingsTabNavigation({
  tabs,
  activeTabId,
  onTabChange,
}: {
  tabs: SettingsTabMeta[]
  activeTabId: string
  onTabChange: (tabId: string) => void
}) {
  const activeTabMeta = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]

  return (
    <div className='ap-panel p-3'>
      <div className='flex flex-wrap gap-2'>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId

          return (
            <button
              key={tab.id}
              type='button'
              onClick={() => onTabChange(tab.id)}
              className={getControlButtonClassName({
                tone: isActive ? 'selected' : 'neutral',
                variant: isActive ? 'solid' : 'outline',
              })}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div className='ap-card-muted mt-3 px-4 py-3 text-sm text-text-secondary'>
        <span className='font-semibold text-text-primary'>{activeTabMeta.label}</span>
        {' | '}
        {activeTabMeta.description}
      </div>
    </div>
  )
}

export function SettingsMessageBanner({
  kind,
  message,
  tone = 'default',
}: {
  kind: 'success' | 'error'
  message: string
  tone?: 'default' | 'library'
}) {
  const classes = tone === 'library'
    ? kind === 'success'
      ? 'ap-banner border-state-multi/40 bg-state-multi/10 text-cyan-300'
      : 'ap-banner ap-banner-danger'
    : kind === 'success'
      ? 'ap-banner ap-banner-success'
      : 'ap-banner ap-banner-danger'

  return (
    <div className={classes}>
      {message}
    </div>
  )
}

export function SettingsPlaceholderCard({ children }: { children: ReactNode }) {
  return (
    <div className='ap-card-muted p-6 text-sm text-text-secondary'>
      {children}
    </div>
  )
}

export function PreviewCanvasSidebar({
  settings,
  graphic,
  activeGraphic,
  previewContent,
}: {
  settings: AppSettings
  graphic: GraphicInstanceConfig
  activeGraphic?: GraphicInstanceConfig
  previewContent: Record<string, string | undefined>
}) {
  const previewBackground = resolveActivePreviewBackground(settings, graphic)

  return (
    <aside className='ap-panel space-y-4 self-start bg-surface-panel p-5 xl:sticky xl:top-6'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <p className='ap-section-eyebrow text-state-active'>Preview</p>
          <h4 className='mt-1 text-lg font-semibold text-text-primary'>Preview16x9</h4>
        </div>
        <span className={getStateBadgeClassName('selected')}>
          {activeGraphic?.name ?? graphic.name}
        </span>
      </div>
      <div className='ap-card bg-surface-app p-4'>
        <PreviewCanvas
          template={graphic.preview}
          content={previewContent}
          backgroundImagePath={previewBackground.resolvedFilePath}
        />
      </div>
      <p className='ap-copy'>
        Preview-ul se actualizeaza live pe baza configurarii curente si a continutului entitatii selectate.
      </p>
    </aside>
  )
}
