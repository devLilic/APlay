import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readWorkspaceShellSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/features/workspace/components/WorkspaceShell.tsx'),
    'utf8',
  )
}

describe('WorkspaceShell dual-preview layout refactor', () => {
  it('defines a dedicated top-level dual-screen area above the operational panels', () => {
    const source = readWorkspaceShellSource()

    expect(source).toContain('Preview')
    expect(source).toContain('ONAIR')
    expect(source).toContain('aspect-video')
    expect(source).toContain('No on-air graphic')
  })

  it('keeps only the left and center operational panels in the lower workspace area', () => {
    const source = readWorkspaceShellSource()

    expect(source).toContain("title=''")
    expect(source).toContain("eyebrow='Left panel'")
    expect(source).toContain("eyebrow='Center panel'")
    expect(source).not.toContain("title='Navigation'")
    expect(source).not.toContain("title='Entity collections'")
    expect(source).toContain("eyebrow='Center panel'")
    expect(source).not.toContain("title='Preview and execution'")
    expect(source).not.toContain("eyebrow='Right panel'")
  })

  it('moves play stop and resume controls into a top control strip in the center panel', () => {
    const source = readWorkspaceShellSource()

    expect(source).toContain('Center panel controls')
    expect(source).toContain(">Play<")
    expect(source).toContain(">Stop<")
    expect(source).toContain(">Resume<")
    expect(source).not.toContain('Single-item controls')
    expect(source).not.toContain('Grouped action bar')
  })

  it('renders preview content in the Preview screen and a coherent empty state in the ONAIR screen', () => {
    const source = readWorkspaceShellSource()

    expect(source).toContain("label='Preview'")
    expect(source).toContain("label='ONAIR'")
    expect(source).not.toContain('Selected preview')
    expect(source).not.toContain('On-air output')
    expect(source).toContain('No on-air graphic')
    expect(source).toContain('Waiting for live output')
  })

  it('shows concise on-air policy badges in workspace context and display screens', () => {
    const source = readWorkspaceShellSource()

    expect(source).toContain('Timed on-air')
    expect(source).toContain('Manual on-air')
    expect(source).toContain('Auto-hide after')
    expect(source).toContain('Stays on-air until Stop.')
  })

  it('does not depend on the old three-column shell with a dedicated right panel track', () => {
    const source = readWorkspaceShellSource()

    expect(source).not.toContain('xl:grid-cols-[minmax(18rem,22rem),minmax(26rem,1fr),minmax(30rem,42rem)]')
    expect(source).toContain('xl:grid-cols-[minmax(18rem,22rem),minmax(26rem,1fr)]')
  })

  it('renders graphic collection items with explicit primary and optional secondary display fields instead of one derived label', () => {
    const source = readWorkspaceShellSource()

    expect(source).toContain('resolveGraphicCollectionItemDisplay')
    expect(source).not.toContain('formatEntityCollectionLabel(item)')
    expect(source).toContain('display.secondary')
  })

  it('styles primary and secondary collection lines for fast scanning without inflating card height', () => {
    const source = readWorkspaceShellSource()

    expect(source).toContain('font-medium text-text-primary')
    expect(source).toContain('font-semibold text-text-primary')
    expect(source).toContain('text-[11px] leading-4 break-words text-text-secondary')
    expect(source).toContain("display.secondary ? 'mt-1.5 text-xs text-text-secondary' : 'mt-0.5 text-xs text-text-secondary'")
  })

  it('renders collection cards from the resolved display helper so static playable items can surface with a fallback label', () => {
    const source = readWorkspaceShellSource()

    expect(source).toContain('const display = resolveGraphicCollectionItemDisplay(item, group.graphic)')
    expect(source).toContain('{display.primary}')
    expect(source).toContain('Click to preview')
    expect(source).toContain('Available for grouped play')
  })

  it('marks static playable collection items with a lightweight operational indicator instead of treating them like empty data', () => {
    const source = readWorkspaceShellSource()

    expect(source).toContain('const isStaticItem = isStaticPlayableGraphic(group.graphic)')
    expect(source).toContain('>Static<')
    expect(source).toContain('No datasource')
    expect(source).toContain('Operates directly from this graphic config')
  })
})
