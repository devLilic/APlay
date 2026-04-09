import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPanel } from '@/features/settings/components/SettingsPanel'
import { SettingsMessageBanner } from '@/features/settings/components/SettingsPanelChrome'
import { sampleSettings } from '@/features/workspace/data/sampleWorkspaceConfig'
import type { AppSettings, GraphicInstanceConfig } from '@/settings/models/appConfig'

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
    />,
  )
}

function readSettingsSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/features/settings/components/SettingsPanel.tsx'),
    'utf8',
  )
}

function getSectionWindow(source: string, marker: string, size = 8000): string {
  const markerIndex = source.indexOf(marker)
  expect(markerIndex).toBeGreaterThan(-1)
  return source.slice(markerIndex, markerIndex + size)
}

const lightSurfacePattern = /\bbg-white\b|\bbg-emerald-50\b|\bbg-rose-50\b|\bborder-emerald-200\b|\bborder-rose-300\b|\btext-ink\b/

describe('SettingsPanel dark theme regressions', () => {
  it('keeps the default show tab on dark APlay surfaces without white card islands', () => {
    const html = renderSettingsPanel({
      diagnostics: ['Schema warning'],
      feedback: { kind: 'error', message: 'Settings save failed.' },
    })

    expect(html).toContain('ap-settings')
    expect(html).toContain('ap-form-section')
    expect(html).toContain('ap-banner ap-banner-danger')
    expect(html).not.toMatch(lightSurfacePattern)
  })

  it('keeps settings message banners on APlay banner styles instead of detached light blocks', () => {
    const successHtml = renderToStaticMarkup(
      <SettingsMessageBanner kind='success' message='Settings saved.' />,
    )
    const errorHtml = renderToStaticMarkup(
      <SettingsMessageBanner kind='error' message='Settings save failed.' />,
    )

    expect(successHtml).toContain('ap-banner')
    expect(successHtml).toContain('ap-banner-success')
    expect(successHtml).not.toMatch(lightSurfacePattern)
    expect(errorHtml).toContain('ap-banner')
    expect(errorHtml).toContain('ap-banner-danger')
    expect(errorHtml).not.toMatch(lightSurfacePattern)
  })

  it('does not define light-surface utility classes inside CSV schema and reference image sections', () => {
    const source = readSettingsSource()
    const csvSchemaSection = getSectionWindow(source, "title='CSV schema'")
    const referenceImagesSection = getSectionWindow(source, "title='Reference images'")

    expect(csvSchemaSection).not.toMatch(lightSurfacePattern)
    expect(referenceImagesSection).not.toMatch(lightSurfacePattern)
  })

  it('does not define light-surface utility classes inside OSC target and command editor sections', () => {
    const source = readSettingsSource()
    const oscTargetSection = getSectionWindow(source, "title='OSC target'")
    const playCommandSection = getSectionWindow(source, "label='Play command'")
    const stopCommandSection = getSectionWindow(source, "label='Stop command'")

    expect(oscTargetSection).not.toMatch(lightSurfacePattern)
    expect(playCommandSection).not.toMatch(lightSurfacePattern)
    expect(stopCommandSection).not.toMatch(lightSurfacePattern)
  })

  it('does not define light-surface utility classes inside preview template and preview editor cards', () => {
    const source = readSettingsSource()
    const previewTemplateSection = getSectionWindow(source, "title='Preview template'")

    expect(previewTemplateSection).not.toMatch(lightSurfacePattern)
  })
})
