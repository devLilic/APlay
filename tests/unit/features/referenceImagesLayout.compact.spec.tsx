import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSettingsSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/features/settings/components/SettingsPanel.tsx'),
    'utf8',
  )
}

function getReferenceImagesSectionWindow(size = 10000) {
  const source = readSettingsSource()
  const marker = "title='Reference images'"
  const markerIndex = source.indexOf(marker)
  expect(markerIndex).toBeGreaterThan(-1)
  return source.slice(markerIndex, markerIndex + size)
}

describe('Reference images compact layout', () => {
  it('renders the section as a split layout with a compact form on the left and a preview panel on the right', () => {
    const section = getReferenceImagesSectionWindow()

    expect(section).toContain('xl:grid-cols-[minmax(0,22rem),minmax(0,1fr)]')
    expect(section).toContain('Reference image previews')
  })

  it('keeps the add form compact and prevents a tall stacked full-width layout', () => {
    const section = getReferenceImagesSectionWindow()

    expect(section).toContain('sm:grid-cols-[minmax(0,1fr),auto,auto]')
    expect(section).not.toContain("<div className='grid gap-3'>")
  })

  it('renders preview items as compact cards with image thumbnail, caption, and delete action', () => {
    const section = getReferenceImagesSectionWindow()

    expect(section).toContain('grid gap-3 sm:grid-cols-2 xl:grid-cols-3')
    expect(section).toContain('<img')
    expect(section).toContain('Delete image')
    expect(section).not.toContain("Available reference images")
  })

  it('keeps an empty state inside the dedicated preview panel when there are no reference images', () => {
    const section = getReferenceImagesSectionWindow()

    expect(section).toContain('No reference images added yet.')
    expect(section).toContain('Preview panel')
  })
})
