import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSettingsSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/features/settings/components/SettingsPanel.tsx'),
    'utf8',
  )
}

function getSectionWindow(source: string, marker: string, size = 12000): string {
  const markerIndex = source.indexOf(marker)
  expect(markerIndex).toBeGreaterThan(-1)
  return source.slice(markerIndex, markerIndex + size)
}

describe('SettingsPanel compact graphic and preview layout', () => {
  it('drops the wide graphics tab split shell in favor of a bounded vertical editor flow', () => {
    const source = readSettingsSource()
    const graphicsTab = getSectionWindow(source, "{activeTab === 'graphics' ? (", 5000)

    expect(graphicsTab).not.toContain("className='grid gap-6 xl:grid-cols-[22rem,minmax(0,1fr)]'")
    expect(graphicsTab).toContain("className='space-y-4 w-full'")
  })

  it('keeps preview tab sections stacked with the library first and a bounded preview editor below it', () => {
    const source = readSettingsSource()
    const previewTab = getSectionWindow(source, "{activeTab === 'preview' ? (", 5000)

    expect(previewTab).toContain("className='space-y-4 w-full'")
    expect(previewTab).toContain("className='w-full'")
    expect(previewTab.indexOf('<GraphicSelectionSection')).toBeLessThan(previewTab.indexOf('<PreviewTemplateSection'))
    expect(previewTab).not.toContain('xl:grid-cols-[22rem,minmax(0,1fr)]')
  })

  it('renders the graphic config library as compact creation, editing target, and card-grid groups', () => {
    const source = readSettingsSource()
    const section = getSectionWindow(source, "title='Graphic config library'")

    expect(section).toContain('Create new graphic config')
    expect(section).toContain('Graphic config library')
    expect(section).toContain("className='flex flex-col gap-4 xl:flex-row xl:items-start'")
    expect(section).toContain("className='xl:w-[30%] xl:min-w-[18rem]'")
    expect(section).toContain("className='min-w-0 flex-1'")
    expect(section).toContain('sm:grid-cols-2 xl:grid-cols-3')
    expect(section).not.toContain("description='Create, select, duplicate, and delete reusable graphic configs. Editing happens in the panel on the right.'")
    expect(section).not.toContain('Editing target')
  })

  it('keeps the preview template horizontally compact with bounded editor and canvas tracks', () => {
    const source = readSettingsSource()
    const section = getSectionWindow(source, "title='Preview template'")

    expect(section).not.toContain("className='grid gap-6 xl:grid-cols-2'")
    expect(section).toContain("className='grid gap-4 xl:grid-cols-2 xl:items-start'")
    expect(section).toContain("className='grid gap-3 md:grid-cols-[minmax(0,1fr),9rem,9rem]'")
  })

  it('splits preview element editing into compact grouped controls instead of one flat control grid', () => {
    const source = readSettingsSource()
    const section = getSectionWindow(source, 'Preview elements')

    expect(section).toContain("className='flex min-w-0 flex-1 flex-wrap items-center gap-2'")
    expect(section).toContain("className='grid gap-2.5 md:grid-cols-2'")
    expect(section).toContain("className='grid gap-2.5 grid-cols-2'")
    expect(section).not.toContain('Element identity')
    expect(section).not.toContain('Visibility / behavior')
    expect(section).not.toContain('Position / size')
    expect(section).not.toContain('Colors / appearance')
    expect(section).not.toContain('Typography / spacing')
    expect(section).not.toContain("<div className='grid gap-3 md:grid-cols-3'>")
  })

  it('uses compact toggle and small-control groups for preview element options', () => {
    const source = readSettingsSource()
    const section = getSectionWindow(source, 'Preview elements')

    expect(section).toContain("className={previewElementCardClassName}")
    expect(section).toContain("className={previewElementGroupClassName}")
    expect(section).toContain("className='flex min-w-0 flex-1 flex-wrap items-center gap-2'")
    expect(section).toContain('settingsCompactCheckboxRowClassName')
    expect(section).toContain("compact label='X'")
    expect(section).toContain("className='grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3'")
    expect(section).toContain("className='max-w-[10.5rem] space-y-2'")
    expect(source).toContain("const settingsCompactCheckboxRowClassName = 'ap-focus inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-muted bg-surface-app/60 px-2 py-1.5 text-xs text-text-primary'")
    expect(source).toContain("const previewElementCardClassName = 'space-y-2.5 rounded-xl border border-border bg-card p-2.5 sm:p-3'")
    expect(source).toContain("const previewElementGroupClassName = 'space-y-2 rounded-xl border border-border-muted bg-surface-muted px-2.5 py-2'")
    expect(section).toContain('ALL CAPS')
    expect(section).toContain('Fit in box')
    expect(section).not.toContain("className={`grid gap-3 ${settingsInsetSectionClassName} md:grid-cols-3`}")
  })
})
