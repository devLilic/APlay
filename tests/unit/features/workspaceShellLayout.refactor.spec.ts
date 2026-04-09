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

    expect(source).toContain("title='Navigation'")
    expect(source).toContain("eyebrow='Left panel'")
    expect(source).toContain("title='Entity collections'")
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

    expect(source).toContain('Selected preview')
    expect(source).toContain('Preview target')
    expect(source).toContain('On-air output')
    expect(source).toContain('No on-air graphic')
    expect(source).toContain('Waiting for live output')
  })

  it('does not depend on the old three-column shell with a dedicated right panel track', () => {
    const source = readWorkspaceShellSource()

    expect(source).not.toContain('xl:grid-cols-[minmax(18rem,22rem),minmax(26rem,1fr),minmax(30rem,42rem)]')
    expect(source).toContain('xl:grid-cols-[minmax(18rem,22rem),minmax(26rem,1fr)]')
  })
})
