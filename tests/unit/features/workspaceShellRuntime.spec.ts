import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GraphicInstanceConfig, OscSettingsConfig } from '@/settings/models/appConfig'
import type { SelectedEntityContext } from '@/features/workspace/state/workspaceSelectionState'
import {
  createEntityPreviewContent,
  resolveGraphicForSelection,
  runWorkspaceGraphicAction,
} from '@/features/workspace/state/workspaceShellRuntime'

const titleMainGraphic: GraphicInstanceConfig = {
  id: 'pa_title_main',
  entityType: 'title',
  dataFileName: 'pa_title_main.json',
  datasourcePath: 'datasources/pa_title_main.json',
  control: {
    templateName: 'PA_TITLE_MAIN',
    play: '/graphics/pa_title_main/play',
    stop: '/graphics/pa_title_main/stop',
    resume: '/graphics/pa_title_main/resume',
  },
  bindings: [
    { sourceField: 'Titlu', targetField: 'text', required: true },
    { sourceField: 'Nr', targetField: 'number' },
  ],
  preview: {
    id: 'pa-title-main-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [{ id: 'title-text', kind: 'text', sourceField: 'text', box: { x: 0, y: 0, width: 100, height: 20 } }],
  },
  actions: [],
}

const titleWaitingGraphic: GraphicInstanceConfig = {
  id: 'pa_title_waiting',
  entityType: 'title',
  dataFileName: 'pa_title_waiting.json',
  datasourcePath: 'datasources/pa_title_waiting.json',
  control: {
    templateName: 'PA_TITLE_WAITING',
    play: '/graphics/pa_title_waiting/play',
    stop: '/graphics/pa_title_waiting/stop',
    resume: '/graphics/pa_title_waiting/resume',
  },
  bindings: [
    { sourceField: 'Titlu Asteptare', targetField: 'text', required: true },
    { sourceField: 'Locatie Asteptare', targetField: 'location' },
  ],
  preview: {
    id: 'pa-title-waiting-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      { id: 'waiting-text', kind: 'text', sourceField: 'text', box: { x: 0, y: 0, width: 100, height: 20 } },
      { id: 'waiting-location', kind: 'text', sourceField: 'location', box: { x: 0, y: 20, width: 100, height: 20 } },
    ],
  },
  actions: [],
}

const selectedWaitingItem: SelectedEntityContext = {
  blockIndex: 0,
  blockName: 'INVITATI',
  graphicConfigId: 'pa_title_waiting',
  entityIndex: 0,
  entity: {
    text: 'DECLARATII IMPORTANTE',
    location: 'PIATA MARII ADUNARI NATIONALE',
  },
}

const oscSettings: OscSettingsConfig = {
  target: {
    host: '127.0.0.1',
    port: 53000,
  },
  commands: {
    play: {
      address: '/global/play',
      args: [{ type: 's', value: '{{templateName}}' }],
    },
    stop: {
      address: '/global/stop',
      args: [{ type: 's', value: '{{templateName}}' }],
    },
    resume: {
      address: '/global/resume',
      args: [{ type: 's', value: '{{templateName}}' }],
    },
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('workspace shell runtime with graphicConfig-based collections', () => {
  it('selecting an item passes its fields to preview content', () => {
    expect(createEntityPreviewContent(selectedWaitingItem)).toEqual({
      text: 'DECLARATII IMPORTANTE',
      location: 'PIATA MARII ADUNARI NATIONALE',
    })
  })

  it('resolves preview/play graphic by graphicConfigId even when multiple graphics share the same entityType', () => {
    const graphic = resolveGraphicForSelection(
      {
        pa_title_main: titleMainGraphic,
        pa_title_waiting: titleWaitingGraphic,
      },
      selectedWaitingItem,
    )

    expect(graphic?.id).toBe('pa_title_waiting')
    expect(graphic?.preview.id).toBe('pa-title-waiting-preview')
  })

  it('play writes the correct datasource JSON and sends OSC for the selected graphic config', async () => {
    const writeDatasourceFileSync = vi.fn()
    const sendOscMessage = vi.fn(async () => undefined)
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync,
        sendOscMessage,
      },
    })

    const result = await runWorkspaceGraphicAction(
      'playGraphic',
      selectedWaitingItem,
      {
        pa_title_main: titleMainGraphic,
        pa_title_waiting: titleWaitingGraphic,
      },
      oscSettings,
    )

    expect(result.kind).toBe('success')
    expect(writeDatasourceFileSync).toHaveBeenCalledWith(
      'datasources/pa_title_waiting.json',
      '{\n  "text": "DECLARATII IMPORTANTE",\n  "location": "PIATA MARII ADUNARI NATIONALE"\n}',
    )
    expect(sendOscMessage).toHaveBeenCalledWith(
      '127.0.0.1',
      53000,
      '/graphics/pa_title_waiting/play',
      [],
    )
  })

  it('stop and resume use graphicConfig-specific OSC mappings', async () => {
    const sendOscMessage = vi.fn(async () => undefined)
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn(),
        sendOscMessage,
      },
    })

    await runWorkspaceGraphicAction(
      'stopGraphic',
      selectedWaitingItem,
      { pa_title_waiting: titleWaitingGraphic },
      oscSettings,
    )
    await runWorkspaceGraphicAction(
      'resumeGraphic',
      selectedWaitingItem,
      { pa_title_waiting: titleWaitingGraphic },
      oscSettings,
    )

    expect(sendOscMessage).toHaveBeenNthCalledWith(
      1,
      '127.0.0.1',
      53000,
      '/graphics/pa_title_waiting/stop',
      [],
    )
    expect(sendOscMessage).toHaveBeenNthCalledWith(
      2,
      '127.0.0.1',
      53000,
      '/graphics/pa_title_waiting/resume',
      [],
    )
  })
})
