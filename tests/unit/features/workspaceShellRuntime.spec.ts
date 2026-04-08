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
  name: 'PA title main',
  entityType: 'title',
  dataFileName: 'pa_title_main.json',
  datasourcePath: 'datasources/pa_title_main.json',
  control: {
    templateName: 'PA_TITLE_MAIN',
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
  name: 'PA title waiting',
  entityType: 'title',
  dataFileName: 'pa_title_waiting.json',
  datasourcePath: 'datasources/pa_title_waiting.json',
  control: {
    templateName: 'PA_TITLE_WAITING',
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

const windowBoxGraphic: GraphicInstanceConfig = {
  id: 'window-box',
  name: 'Window Box',
  entityType: 'title',
  dataFileName: 'window-box.json',
  datasourcePath: 'datasources/window-box.json',
  control: {
    templateName: 'WINDOW_BOX',
  },
  bindings: [
    { sourceField: 'Titlu Asteptare', targetField: 'title' },
    { sourceField: 'Locatie Asteptare', targetField: 'location' },
  ],
  preview: {
    id: 'window-box-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      { id: 'window-box-title', kind: 'text', sourceField: 'title', box: { x: 0, y: 0, width: 100, height: 20 } },
      { id: 'window-box-location', kind: 'text', sourceField: 'location', box: { x: 0, y: 20, width: 100, height: 20 } },
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

const selectedWindowBoxItem: SelectedEntityContext = {
  blockIndex: 0,
  blockName: 'INVITATI',
  graphicConfigId: 'window-box',
  entityIndex: 0,
  entity: {
    title: 'DECLARATII IMPORTANTE',
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

  it('passes composite window-box fields to preview content', () => {
    expect(createEntityPreviewContent(selectedWindowBoxItem)).toEqual({
      title: 'DECLARATII IMPORTANTE',
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
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
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
      '/global/play',
      [{ type: 's', value: 'PA_TITLE_WAITING' }],
    )
  })

  it('writes the datasource before sending OSC when play is triggered', async () => {
    const calls: string[] = []
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn(() => {
          calls.push('write')
        }),
        sendOscMessage: vi.fn(async () => {
          calls.push('osc')
          return ['opened', 'ready', 'sent']
        }),
      },
    })

    const result = await runWorkspaceGraphicAction(
      'playGraphic',
      selectedWaitingItem,
      { pa_title_waiting: titleWaitingGraphic },
      oscSettings,
    )

    expect(result.kind).toBe('success')
    expect(calls).toEqual(['write', 'osc'])
  })

  it('stop and resume use the same global resolution rule when no local override exists', async () => {
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
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
      '/global/stop',
      [{ type: 's', value: 'PA_TITLE_WAITING' }],
    )
    expect(sendOscMessage).toHaveBeenNthCalledWith(
      2,
      '127.0.0.1',
      53000,
      '/global/resume',
      [{ type: 's', value: 'PA_TITLE_WAITING' }],
    )
  })

  it('play writes both fields for a composite window-box graphic item', async () => {
    const writeDatasourceFileSync = vi.fn()
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync,
        sendOscMessage,
      },
    })

    const result = await runWorkspaceGraphicAction(
      'playGraphic',
      selectedWindowBoxItem,
      { 'window-box': windowBoxGraphic },
      oscSettings,
    )

    expect(result.kind).toBe('success')
    expect(writeDatasourceFileSync).toHaveBeenCalledWith(
      'datasources/window-box.json',
      '{\n  "title": "DECLARATII IMPORTANTE",\n  "location": "PIATA MARII ADUNARI NATIONALE"\n}',
    )
    expect(sendOscMessage).toHaveBeenCalledWith(
      '127.0.0.1',
      53000,
      '/global/play',
      [{ type: 's', value: 'WINDOW_BOX' }],
    )
  })
})
