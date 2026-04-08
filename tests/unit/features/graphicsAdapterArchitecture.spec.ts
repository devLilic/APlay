import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function readSourceFile(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

describe('graphics adapter architecture boundaries', () => {
  it('keeps the UI layer free of direct OscClient or osc library imports', () => {
    const settingsPanelSource = readSourceFile('src/features/settings/components/SettingsPanel.tsx')
    const workspaceShellSource = readSourceFile('src/features/workspace/components/WorkspaceShell.tsx')

    expect(settingsPanelSource).not.toContain('OscClient')
    expect(settingsPanelSource).not.toContain("from 'osc'")
    expect(settingsPanelSource).not.toContain('integrations/osc')

    expect(workspaceShellSource).not.toContain('OscClient')
    expect(workspaceShellSource).not.toContain("from 'osc'")
    expect(workspaceShellSource).not.toContain('integrations/osc')
  })

  it('keeps orchestration and graphic output layers free of direct osc library imports', () => {
    const selectedEntityControlSource = readSourceFile('src/features/workspace/state/selectedEntityControl.ts')
    const oscGraphicOutputSource = readSourceFile('src/adapters/graphic-output/oscGraphicOutput.ts')

    expect(selectedEntityControlSource).not.toContain("from 'osc'")
    expect(selectedEntityControlSource).not.toContain('UDPPort')

    expect(oscGraphicOutputSource).not.toContain("from 'osc'")
    expect(oscGraphicOutputSource).not.toContain('UDPPort')
  })

  it('uses the graphic config name for UI display instead of rendering the id as the primary label', () => {
    const settingsPanelSource = readSourceFile('src/features/settings/components/SettingsPanel.tsx')
    const workspaceShellSource = readSourceFile('src/features/workspace/components/WorkspaceShell.tsx')

    expect(settingsPanelSource).toContain('graphic.name')
    expect(settingsPanelSource).not.toContain('<p className=\'truncate text-sm font-semibold text-ink\'>{graphic.id}</p>')
    expect(workspaceShellSource).toContain('<h3 className=\'text-sm font-semibold text-ink\'>{group.graphic.name}</h3>')
    expect(workspaceShellSource).not.toContain('<h3 className=\'text-sm font-semibold text-ink\'>{group.graphic.id}</h3>')
  })

  it('switching graphic configs uses names in selectors and selected-preview labels', () => {
    const settingsPanelSource = readSourceFile('src/features/settings/components/SettingsPanel.tsx')
    const workspaceShellSource = readSourceFile('src/features/workspace/components/WorkspaceShell.tsx')

    expect(settingsPanelSource).toContain('{graphic.name} | {graphic.entityType}')
    expect(settingsPanelSource).not.toContain('{graphic.name} | {graphic.entityType} | {graphic.id}')
    expect(workspaceShellSource).toContain('<span>{selectedGraphic.name}</span>')
    expect(workspaceShellSource).not.toContain('<span>{selectedGraphic.id}</span>')
  })

  it('name updates are wired to the UI immediately through controlled inputs', () => {
    const settingsPanelSource = readSourceFile('src/features/settings/components/SettingsPanel.tsx')

    expect(settingsPanelSource).toContain('value={graphic.name}')
    expect(settingsPanelSource).toContain("onChange={(event) => updateGraphic((current) => ({ ...current, name: event.target.value }))}")
  })
})
