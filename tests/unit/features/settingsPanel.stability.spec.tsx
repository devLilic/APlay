import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { NotificationsProvider } from '@/features/notifications/notificationsContext'
import { SettingsPanel } from '@/features/settings/components/SettingsPanel'
import { sampleGraphicFiles, sampleSettings } from '@/features/workspace/data/sampleWorkspaceConfig'
import type { AppSettings, GraphicInstanceConfig } from '@/settings/models/appConfig'
import type { GraphicConfigLibraryImportResult } from '@/settings/storage/graphicConfigImport'

function cloneSettings(settings: AppSettings): AppSettings {
  return structuredClone(settings)
}

function renderSettingsPanel({
  settings = cloneSettings(sampleSettings),
  diagnostics = [],
  feedback = null,
  selectedGraphic = settings.graphics[0],
  pendingImportSummary = null,
}: {
  settings?: AppSettings
  diagnostics?: string[]
  feedback?: { kind: 'success' | 'error'; message: string } | null
  selectedGraphic?: GraphicInstanceConfig | undefined
  pendingImportSummary?: ComponentProps<typeof SettingsPanel>['pendingImportSummary']
} = {}) {
  return renderToStaticMarkup(
    <NotificationsProvider>
      <SettingsPanel
        settings={settings}
        diagnostics={diagnostics}
        feedback={feedback}
        selectedGraphic={selectedGraphic}
        previewContent={{ text: 'Sample headline', name: 'Sample name', role: 'Host' }}
        isImportingGraphicConfig={false}
        isImportingProfile={false}
        pendingImportSummary={pendingImportSummary}
        onSettingsChange={vi.fn()}
        onSave={vi.fn()}
        onReload={vi.fn()}
        onImportGraphicConfig={vi.fn(async () => {})}
        onImportProfile={vi.fn(async () => {})}
        onConfirmImport={vi.fn()}
        onCancelImport={vi.fn()}
        onExportGraphicConfig={vi.fn(async () => {})}
        onExportProfile={vi.fn(async () => {})}
        onTestOscCommand={vi.fn(async () => {})}
      />
    </NotificationsProvider>,
  )
}

describe('SettingsPanel stability', () => {
  it('renders the stable settings chrome and defaults to the show tab', () => {
    const html = renderSettingsPanel()

    expect(html).toContain('Import profile')
    expect(html).toContain('Import graphic')
    expect(html).toContain('Export profile')
    expect(html).toContain('Export graphic')
    expect(html).toContain('Reload')
    expect(html).toContain('Save settings')
    expect(html).toContain('Profile activ, sursa CSV si schema de lucru.')
    expect(html).toContain('Show profiles')
    expect(html).toContain('CSV schema')
    expect(html).not.toContain('Graphic config library')
  })

  it('shows the save guard when any graphic config has a blank display name', () => {
    const settings = cloneSettings(sampleSettings)
    settings.graphics[0] = {
      ...settings.graphics[0],
      name: '   ',
    }

    const html = renderSettingsPanel({ settings })

    expect(html).toContain('Display Name is required for every graphic config before settings can be saved.')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save settings<\/button>/)
  })

  it('renders import review details for a pending graphic config import', () => {
    const settings = cloneSettings(sampleSettings)
    const importedGraphic: GraphicInstanceConfig = {
      ...settings.graphics[0],
      id: 'title-imported',
      name: 'Imported title',
      dataFileName: 'title-imported.json',
      datasourcePath: 'datasources/title-imported.json',
    }
    const pendingImportSummary = {
      kind: 'graphic' as const,
      filePath: 'C:\\Imports\\title-imported.json',
      preview: {
        status: 'added',
        importedGraphic,
        settings,
        graphicFiles: sampleGraphicFiles,
        conflict: null,
      } satisfies GraphicConfigLibraryImportResult,
    }

    const html = renderSettingsPanel({ settings, pendingImportSummary })

    expect(html).toContain('Import summary')
    expect(html).toContain('Review before importing')
    expect(html).toContain('C:\\Imports\\title-imported.json')
    expect(html).toContain('Imported title')
    expect(html).toContain('Dynamic')
    expect(html).toContain('New item')
    expect(html).toContain('Confirm import')
  })

  it('renders external feedback and diagnostics without collapsing the show tab content', () => {
    const html = renderSettingsPanel({
      diagnostics: ['Missing reference image', 'Schema warning'],
      feedback: {
        kind: 'error',
        message: 'Settings save failed.',
      },
    })

    expect(html).toContain('Missing reference image | Schema warning')
    expect(html).toContain('Show profiles')
    expect(html).toContain('CSV schema')
  })
})
