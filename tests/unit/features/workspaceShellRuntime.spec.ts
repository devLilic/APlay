import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GraphicInstanceConfig, OscSettingsConfig } from '@/settings/models/appConfig'
import type { SelectedEntityContext, SelectedMultiEntityContext } from '@/features/workspace/state/workspaceSelectionState'
import {
  createEntityPreviewContent,
  resolveGraphicForSelection,
  runWorkspaceGraphicAction,
  runWorkspaceMultiGraphicAction,
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

const staticLogoGraphic: GraphicInstanceConfig = {
  id: 'logo-main',
  name: 'Logo main',
  entityType: 'image',
  kind: 'static',
  dataFileName: 'logo-main.json',
  control: {
    templateName: 'LOGO_MAIN',
  },
  staticAsset: { assetPath: 'assets/logo.png', assetType: 'image' },
  preview: {
    id: 'logo-main-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      { id: 'logo-image', kind: 'image', sourceField: 'staticAsset', box: { x: 0, y: 0, width: 100, height: 20 } },
    ],
  },
  actions: [],
}

const localOverrideTitleGraphic: GraphicInstanceConfig = {
  ...titleWaitingGraphic,
  id: 'pa_title_local_override',
  name: 'PA title local override',
  dataFileName: 'pa_title_local_override.json',
  datasourcePath: 'datasources/pa_title_local_override.json',
  control: {
    templateName: 'PA_TITLE_LOCAL_OVERRIDE',
    play: {
      address: '/local/play',
      args: [{ type: 's', value: '{{templateName}}' }],
    },
    stop: {
      address: '/local/stop',
      args: [{ type: 's', value: '{{templateName}}' }],
    },
    resume: {
      address: '/local/resume',
      args: [{ type: 's', value: '{{templateName}}' }],
    },
  },
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

const selectedTitleItem: SelectedMultiEntityContext = {
  blockIndex: 0,
  blockName: 'INVITATI',
  graphicConfigId: 'pa_title_waiting',
  entityIndex: 0,
  entity: {
    text: 'DECLARATII IMPORTANTE',
    location: 'PIATA MARII ADUNARI NATIONALE',
  },
}

const selectedLocationItem: SelectedMultiEntityContext = {
  blockIndex: 0,
  blockName: 'INVITATI',
  graphicConfigId: 'window-box',
  entityIndex: 0,
  entity: {
    title: 'DECLARATII IMPORTANTE',
    location: 'PIATA MARII ADUNARI NATIONALE',
  },
}

const selectedLogoItem: SelectedMultiEntityContext = {
  blockIndex: 0,
  blockName: 'INVITATI',
  graphicConfigId: 'logo-main',
  entityIndex: 0,
  entity: {
    staticAsset: 'assets/logo.png',
  },
}

const selectedLocalOverrideItem: SelectedMultiEntityContext = {
  blockIndex: 0,
  blockName: 'INVITATI',
  graphicConfigId: 'pa_title_local_override',
  entityIndex: 0,
  entity: {
    text: 'LOCAL OVERRIDE TITLE',
    location: 'STUDIO',
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
    stopall: {
      address: '/global/stopall',
      args: [],
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

  it('graphic collection display settings do not change datasource and preview payload fields', async () => {
    const writeDatasourceFileSync = vi.fn()
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync,
        sendOscMessage,
      },
    })

    const configuredPersonGraphic = {
      ...titleWaitingGraphic,
      id: 'person-raw',
      name: 'Person raw',
      entityType: 'person',
      dataFileName: 'person-raw.json',
      datasourcePath: 'datasources/person-raw.json',
      bindings: [
        { sourceField: 'Nr', targetField: 'number', required: true },
        { sourceField: 'Nume', targetField: 'name', required: true },
        { sourceField: 'Functie', targetField: 'role' },
        { sourceField: 'Locatie', targetField: 'location' },
      ],
      collectionDisplay: {
        primarySourceField: 'Nume',
        secondarySourceField: 'Functie',
      },
      preview: {
        id: 'person-raw-preview',
        designWidth: 1920,
        designHeight: 1080,
        elements: [
          { id: 'person-name', kind: 'text', sourceField: 'name', box: { x: 0, y: 0, width: 100, height: 20 } },
          { id: 'person-role', kind: 'text', sourceField: 'role', box: { x: 0, y: 20, width: 100, height: 20 } },
          { id: 'person-location', kind: 'text', sourceField: 'location', box: { x: 0, y: 40, width: 100, height: 20 } },
        ],
      },
    } as unknown as GraphicInstanceConfig

    const selectedRawPersonItem: SelectedEntityContext = {
      blockIndex: 0,
      blockName: 'INVITATI',
      graphicConfigId: 'person-raw',
      entityIndex: 0,
      entity: {
        Nr: '12',
        Nume: 'ANA RUSU',
        Functie: 'MODERATOR',
        Locatie: 'CHISINAU',
      },
    }

    expect(createEntityPreviewContent(selectedRawPersonItem, configuredPersonGraphic)).toEqual({
      Nr: '12',
      Nume: 'ANA RUSU',
      Functie: 'MODERATOR',
      Locatie: 'CHISINAU',
    })

    const result = await runWorkspaceGraphicAction(
      'playGraphic',
      selectedRawPersonItem,
      { 'person-raw': configuredPersonGraphic },
      oscSettings,
    )

    expect(result.kind).toBe('success')
    expect(writeDatasourceFileSync).toHaveBeenCalledWith(
      'datasources/person-raw.json',
      '{\n  "number": "12",\n  "name": "ANA RUSU",\n  "role": "MODERATOR",\n  "location": "CHISINAU"\n}',
    )
  })

  it('includes static asset paths in preview content for image graphics', () => {
    expect(createEntityPreviewContent(undefined, {
      id: 'logo-main',
      name: 'Logo main',
      entityType: 'image',
      kind: 'static',
      dataFileName: 'logo-main.json',
      staticAsset: {
        assetPath: 'assets/logo.png',
        assetType: 'image',
      },
      control: { templateName: 'LOGO_MAIN' },
      preview: {
        id: 'logo-main-preview',
        designWidth: 1920,
        designHeight: 1080,
        elements: [],
      },
      actions: [],
    })).toEqual({
      staticAsset: 'assets/logo.png',
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

describe('workspace shell runtime grouped multi-selection actions', () => {
  it('play selected runs all selected items', async () => {
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
    const writeDatasourceFileSync = vi.fn()
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync,
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocationItem, selectedLogoItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
        'logo-main': staticLogoGraphic,
      },
      oscSettings,
    )

    expect(result.kind).toBe('success')
    expect(sendOscMessage).toHaveBeenCalledTimes(3)
  })

  it('each selected item uses its own resolved OSC command', async () => {
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn(),
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocalOverrideItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        pa_title_local_override: localOverrideTitleGraphic,
      },
      oscSettings,
    )

    expect(result.kind).toBe('success')
    expect(sendOscMessage).toHaveBeenNthCalledWith(
      1,
      '127.0.0.1',
      53000,
      '/global/play',
      [{ type: 's', value: 'PA_TITLE_WAITING' }],
    )
    expect(sendOscMessage).toHaveBeenNthCalledWith(
      2,
      '127.0.0.1',
      53000,
      '/local/play',
      [{ type: 's', value: 'PA_TITLE_LOCAL_OVERRIDE' }],
    )
  })

  it('stop selected runs all selected items', async () => {
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn(),
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'stopGraphic',
      [selectedTitleItem, selectedLocationItem, selectedLogoItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
        'logo-main': staticLogoGraphic,
      },
      oscSettings,
    )

    expect(result.kind).toBe('success')
    expect(sendOscMessage).toHaveBeenCalledTimes(3)
  })

  it('resume selected runs all selected items', async () => {
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn(),
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'resumeGraphic',
      [selectedTitleItem, selectedLocationItem, selectedLogoItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
        'logo-main': staticLogoGraphic,
      },
      oscSettings,
    )

    expect(result.kind).toBe('success')
    expect(sendOscMessage).toHaveBeenCalledTimes(3)
  })

  it('dynamic items write all datasources before grouped play sends OSC', async () => {
    const calls: string[] = []
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn((filePath: string) => {
          calls.push(`write:${filePath}`)
        }),
        sendOscMessage: vi.fn(async (_host: string, _port: number, address: string, args: unknown[]) => {
          calls.push(`osc:${address}:${JSON.stringify(args)}`)
          return ['opened', 'ready', 'sent']
        }),
      },
    })

    await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocationItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
      },
      oscSettings,
    )

    expect(calls).toEqual([
      'write:datasources/pa_title_waiting.json',
      'write:datasources/window-box.json',
      'osc:/global/play:[{"type":"s","value":"PA_TITLE_WAITING"}]',
      'osc:/global/play:[{"type":"s","value":"WINDOW_BOX"}]',
    ])
  })

  it('play selected writes datasource for each selected dynamic item to its own target file', async () => {
    const writeDatasourceFileSync = vi.fn()
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync,
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocationItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
      },
      oscSettings,
    )

    expect(result.kind).toBe('success')
    expect(writeDatasourceFileSync).toHaveBeenCalledTimes(2)
    expect(writeDatasourceFileSync).toHaveBeenNthCalledWith(
      1,
      'datasources/pa_title_waiting.json',
      '{\n  "text": "DECLARATII IMPORTANTE",\n  "location": "PIATA MARII ADUNARI NATIONALE"\n}',
    )
    expect(writeDatasourceFileSync).toHaveBeenNthCalledWith(
      2,
      'datasources/window-box.json',
      '{\n  "title": "DECLARATII IMPORTANTE",\n  "location": "PIATA MARII ADUNARI NATIONALE"\n}',
    )
  })

  it('each selected item uses its own payload mapping when grouped play writes datasources', async () => {
    const writtenPayloads = new Map<string, string>()
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn((targetFile: string, content: string) => {
          writtenPayloads.set(targetFile, content)
        }),
        sendOscMessage: vi.fn(async () => ['opened', 'ready', 'sent']),
      },
    })

    await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocationItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
      },
      oscSettings,
    )

    expect(writtenPayloads.get('datasources/pa_title_waiting.json')).toBe(
      '{\n  "text": "DECLARATII IMPORTANTE",\n  "location": "PIATA MARII ADUNARI NATIONALE"\n}',
    )
    expect(writtenPayloads.get('datasources/window-box.json')).toBe(
      '{\n  "title": "DECLARATII IMPORTANTE",\n  "location": "PIATA MARII ADUNARI NATIONALE"\n}',
    )
  })

  it('datasource writes for multiple selected items are deterministic', async () => {
    const writtenFiles: string[] = []
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn((targetFile: string) => {
          writtenFiles.push(targetFile)
        }),
        sendOscMessage: vi.fn(async () => ['opened', 'ready', 'sent']),
      },
    })

    await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocationItem, selectedLogoItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
        'logo-main': staticLogoGraphic,
      },
      oscSettings,
    )

    expect(writtenFiles).toEqual([
      'datasources/pa_title_waiting.json',
      'datasources/window-box.json',
    ])
  })

  it('static items skip datasource writes and still send OSC when configured', async () => {
    const writeDatasourceFileSync = vi.fn()
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync,
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedLogoItem],
      {
        'logo-main': staticLogoGraphic,
      },
      oscSettings,
    )

    expect(result.kind).toBe('success')
    expect(writeDatasourceFileSync).not.toHaveBeenCalled()
    expect(sendOscMessage).toHaveBeenCalledWith(
      '127.0.0.1',
      53000,
      '/global/play',
      [{ type: 's', value: 'LOGO_MAIN' }],
    )
  })

  it('datasource write failure for one selected item stops grouped play before any OSC phase starts', async () => {
    const writeDatasourceFileSync = vi.fn((targetFile: string) => {
      if (targetFile === 'datasources/window-box.json') {
        throw new Error('disk full')
      }
    })
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync,
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocationItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
      },
      oscSettings,
    )

    expect(result.kind).toBe('error')
    expect(sendOscMessage).not.toHaveBeenCalled()
    expect(result.details.some((detail) => detail.includes('[PA title waiting] Datasource updated: datasources/pa_title_waiting.json'))).toBe(true)
    expect(result.details.some((detail) => detail.includes('[Window Box] Unable to write datasource file "datasources/window-box.json"'))).toBe(true)
  })

  it('grouped action fails safely and reports partial progress according to error policy', async () => {
    const sendOscMessage = vi.fn(async (_host: string, _port: number, _address: string, args: Array<{ value: string }>) => {
      if (args[0]?.value === 'WINDOW_BOX') {
        throw new Error('osc failed')
      }

      return ['opened', 'ready', 'sent']
    })
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn(),
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocationItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
      },
      oscSettings,
    )

    expect(result.kind).toBe('error')
    expect(result.details.some((detail) => detail.includes('osc failed'))).toBe(true)
  })

  it('execution order is deterministic across selected items', async () => {
    const orderedAddresses: string[] = []
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn(),
        sendOscMessage: vi.fn(async (_host: string, _port: number, _address: string, args: Array<{ value: string }>) => {
          orderedAddresses.push(args[0]?.value ?? '')
          return ['opened', 'ready', 'sent']
        }),
      },
    })

    await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocationItem, selectedLogoItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
        'logo-main': staticLogoGraphic,
      },
      oscSettings,
    )

    expect(orderedAddresses).toEqual([
      'PA_TITLE_WAITING',
      'WINDOW_BOX',
      'LOGO_MAIN',
    ])
  })

  it('empty multi-selection does nothing safely', async () => {
    const sendOscMessage = vi.fn()
    const writeDatasourceFileSync = vi.fn()
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync,
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [],
      {},
      oscSettings,
    )

    expect(result.kind).toBe('error')
    expect(result.details).toEqual(['Select at least one item before sending commands to LiveBoard.'])
    expect(writeDatasourceFileSync).not.toHaveBeenCalled()
    expect(sendOscMessage).not.toHaveBeenCalled()
  })

  it('missing OSC config is handled safely for grouped actions', async () => {
    const sendOscMessage = vi.fn()
    const writeDatasourceFileSync = vi.fn()
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync,
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem],
      {
        pa_title_waiting: {
          ...titleWaitingGraphic,
          control: {
            templateName: 'PA_TITLE_WAITING',
          },
        },
      },
      undefined,
    )

    expect(result.kind).toBe('error')
    expect(result.details.some((detail) => detail.includes('Missing OSC target for graphic "pa_title_waiting"'))).toBe(true)
    expect(sendOscMessage).not.toHaveBeenCalled()
    expect(writeDatasourceFileSync).not.toHaveBeenCalled()
  })
})

describe('workspace shell runtime grouped play two-phase ordering', () => {
  it('grouped Play executes in two distinct phases: write all datasources, then send all OSC play commands', async () => {
    const calls: string[] = []
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn((targetFile: string) => {
          calls.push(`write:${targetFile}`)
        }),
        sendOscMessage: vi.fn(async (_host: string, _port: number, address: string, args: Array<{ value: string }>) => {
          calls.push(`osc:${address}:${args[0]?.value ?? ''}`)
          return ['opened', 'ready', 'sent']
        }),
      },
    })

    await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocationItem, selectedLogoItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
        'logo-main': staticLogoGraphic,
      },
      oscSettings,
    )

    expect(calls).toEqual([
      'write:datasources/pa_title_waiting.json',
      'write:datasources/window-box.json',
      'osc:/global/play:PA_TITLE_WAITING',
      'osc:/global/play:WINDOW_BOX',
      'osc:/global/play:LOGO_MAIN',
    ])
  })

  it('does not send any OSC play command before all datasource writes complete', async () => {
    const calls: string[] = []
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn((targetFile: string) => {
          calls.push(`write:${targetFile}`)
        }),
        sendOscMessage: vi.fn(async (_host: string, _port: number, _address: string, args: Array<{ value: string }>) => {
          calls.push(`osc:${args[0]?.value ?? ''}`)
          return ['opened', 'ready', 'sent']
        }),
      },
    })

    await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocationItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
      },
      oscSettings,
    )

    const firstOscIndex = calls.findIndex((entry) => entry.startsWith('osc:'))
    const lastWriteIndex = calls.reduce((lastIndex, entry, index) => (
      entry.startsWith('write:') ? index : lastIndex
    ), -1)

    expect(firstOscIndex).toBeGreaterThan(lastWriteIndex)
  })

  it('static items are skipped in datasource phase and still included in OSC play phase', async () => {
    const calls: string[] = []
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn((targetFile: string) => {
          calls.push(`write:${targetFile}`)
        }),
        sendOscMessage: vi.fn(async (_host: string, _port: number, address: string, args: Array<{ value: string }>) => {
          calls.push(`osc:${address}:${args[0]?.value ?? ''}`)
          return ['opened', 'ready', 'sent']
        }),
      },
    })

    await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedLogoItem, selectedTitleItem],
      {
        'logo-main': staticLogoGraphic,
        pa_title_waiting: titleWaitingGraphic,
      },
      oscSettings,
    )

    expect(calls).toEqual([
      'write:datasources/pa_title_waiting.json',
      'osc:/global/play:LOGO_MAIN',
      'osc:/global/play:PA_TITLE_WAITING',
    ])
  })

  it('if one datasource write fails, grouped Play follows the chosen error policy safely', async () => {
    const calls: string[] = []
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn((targetFile: string) => {
          calls.push(`write:${targetFile}`)
          if (targetFile === 'datasources/window-box.json') {
            throw new Error('disk full')
          }
        }),
        sendOscMessage: vi.fn(async (_host: string, _port: number, address: string, args: Array<{ value: string }>) => {
          calls.push(`osc:${address}:${args[0]?.value ?? ''}`)
          return ['opened', 'ready', 'sent']
        }),
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocationItem, selectedLogoItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
        'logo-main': staticLogoGraphic,
      },
      oscSettings,
    )

    expect(result.kind).toBe('error')
    expect(calls).toEqual([
      'write:datasources/pa_title_waiting.json',
      'write:datasources/window-box.json',
    ])
  })

  it('execution order is deterministic inside the datasource phase and inside the OSC phase', async () => {
    const datasourceWrites: string[] = []
    const oscSends: string[] = []
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn((targetFile: string) => {
          datasourceWrites.push(targetFile)
        }),
        sendOscMessage: vi.fn(async (_host: string, _port: number, _address: string, args: Array<{ value: string }>) => {
          oscSends.push(args[0]?.value ?? '')
          return ['opened', 'ready', 'sent']
        }),
      },
    })

    await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [selectedTitleItem, selectedLocationItem, selectedLogoItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
        'logo-main': staticLogoGraphic,
      },
      oscSettings,
    )

    expect(datasourceWrites).toEqual([
      'datasources/pa_title_waiting.json',
      'datasources/window-box.json',
    ])
    expect(oscSends).toEqual([
      'PA_TITLE_WAITING',
      'WINDOW_BOX',
      'LOGO_MAIN',
    ])
  })

  it('grouped Stop sends stop commands without a datasource write phase', async () => {
    const writeDatasourceFileSync = vi.fn()
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync,
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'stopGraphic',
      [selectedTitleItem, selectedLocationItem, selectedLogoItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
        'logo-main': staticLogoGraphic,
      },
      oscSettings,
    )

    expect(result.kind).toBe('success')
    expect(writeDatasourceFileSync).not.toHaveBeenCalled()
    expect(sendOscMessage).toHaveBeenCalledTimes(3)
  })

  it('grouped Resume sends resume commands without a datasource write phase', async () => {
    const writeDatasourceFileSync = vi.fn()
    const sendOscMessage = vi.fn(async () => ['opened', 'ready', 'sent'])
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync,
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'resumeGraphic',
      [selectedTitleItem, selectedLocationItem, selectedLogoItem],
      {
        pa_title_waiting: titleWaitingGraphic,
        'window-box': windowBoxGraphic,
        'logo-main': staticLogoGraphic,
      },
      oscSettings,
    )

    expect(result.kind).toBe('success')
    expect(writeDatasourceFileSync).not.toHaveBeenCalled()
    expect(sendOscMessage).toHaveBeenCalledTimes(3)
  })

  it('empty multi-selection does nothing safely for grouped Play two-phase flow', async () => {
    const writeDatasourceFileSync = vi.fn()
    const sendOscMessage = vi.fn()
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync,
        sendOscMessage,
      },
    })

    const result = await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [],
      {},
      oscSettings,
    )

    expect(result.kind).toBe('error')
    expect(writeDatasourceFileSync).not.toHaveBeenCalled()
    expect(sendOscMessage).not.toHaveBeenCalled()
  })

  it('zIndex affects preview only and does not change grouped datasource publish or OSC send order', async () => {
    const datasourceWrites: string[] = []
    const oscSends: string[] = []
    vi.stubGlobal('window', {
      settingsApi: {
        writeDatasourceFileSync: vi.fn((targetFile: string) => {
          datasourceWrites.push(targetFile)
        }),
        sendOscMessage: vi.fn(async (_host: string, _port: number, _address: string, args: Array<{ value: string }>) => {
          oscSends.push(args[0]?.value ?? '')
          return ['opened', 'ready', 'sent']
        }),
      },
    })

    await runWorkspaceMultiGraphicAction(
      'playGraphic',
      [
        {
          ...selectedLocationItem,
          entity: {
            ...selectedLocationItem.entity,
            zIndex: '100',
          },
        },
        {
          ...selectedTitleItem,
          entity: {
            ...selectedTitleItem.entity,
            zIndex: '1',
          },
        },
      ],
      {
        'window-box': windowBoxGraphic,
        pa_title_waiting: titleWaitingGraphic,
      },
      oscSettings,
    )

    expect(datasourceWrites).toEqual([
      'datasources/window-box.json',
      'datasources/pa_title_waiting.json',
    ])
    expect(oscSends).toEqual([
      'WINDOW_BOX',
      'PA_TITLE_WAITING',
    ])
  })
})
