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
})
