import { describe, expect, it, vi } from 'vitest'
import type { GraphicInstanceConfig, OscSettingsConfig } from '@/settings/models/appConfig'
import { createGraphicsAdapter } from '@/adapters/graphics/graphicsAdapter'

const graphicConfig: GraphicInstanceConfig = {
  id: 'title-main',
  name: 'Title main',
  entityType: 'title',
  dataFileName: 'title-main.json',
  control: {
    templateName: 'TemplateName',
    play: {
      address: '',
      args: [],
    },
    stop: {
      address: '',
      args: [],
    },
    resume: {
      address: '',
      args: [],
    },
  },
  bindings: [{ sourceField: 'text', targetField: 'text', required: true }],
  preview: {
    id: 'title-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      {
        id: 'headline',
        kind: 'text',
        sourceField: 'text',
        box: { x: 0, y: 0, width: 100, height: 20 },
      },
    ],
  },
  actions: [
    { actionType: 'playGraphic', label: 'Play' },
    { actionType: 'stopGraphic', label: 'Stop' },
    { actionType: 'resumeGraphic', label: 'Resume' },
  ],
}

const oscSettings: OscSettingsConfig = {
  target: {
    host: '127.0.0.1',
    port: 9000,
  },
  commands: {
    play: {
      address: '/lb/play',
      args: [
        { type: 's', value: '{{templateName}}' },
        { type: 'i', value: 1 },
        { type: 'f', value: 0.5 },
      ],
    },
    stop: {
      address: '/lb/stop',
      args: [{ type: 's', value: '{{templateName}}' }],
    },
    resume: {
      address: '/lb/resume',
      args: [{ type: 's', value: '{{templateName}}' }],
    },
  },
}

describe('GraphicsAdapter', () => {
  it('writes datasource first, then sends OSC play', async () => {
    const calls: string[] = []
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const adapter = createGraphicsAdapter({
      createOscClient() {
        return {
          send: vi.fn(async () => {
            calls.push('osc')
          }),
        }
      },
      fileWriter: {
        write() {
          calls.push('write')
        },
      },
    })

    const result = await adapter.play({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
      oscSettings,
    })

    expect(calls).toEqual(['write', 'osc'])
    expect(result).toMatchObject({
      success: true,
      actionType: 'playGraphic',
      targetFile: 'datasources/title-main.json',
      command: {
        host: '127.0.0.1',
        port: 9000,
        address: '/lb/play',
        args: [
          { type: 's', value: 'TemplateName' },
          { type: 'i', value: 1 },
          { type: 'f', value: 0.5 },
        ],
      },
    })
    expect(log).toHaveBeenCalledWith('OSC PLAY RESOLUTION', {
      graphicId: 'title-main',
      resolvedTemplateName: 'TemplateName',
      commandSource: 'global',
      address: '/lb/play',
      args: [
        { type: 's', value: 'TemplateName' },
        { type: 'i', value: 1 },
        { type: 'f', value: 0.5 },
      ],
      targetFile: 'datasources/title-main.json',
    })
  })

  it('does not send OSC when datasource write fails', async () => {
    const send = vi.fn(async () => undefined)
    const adapter = createGraphicsAdapter({
      createOscClient() {
        return { send }
      },
      fileWriter: {
        write() {
          throw new Error('disk write failed')
        },
      },
    })

    const result = await adapter.play({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
      oscSettings,
    })

    expect(result.success).toBe(false)
    expect(send).not.toHaveBeenCalled()
    expect(result.diagnostics[0]?.message).toContain('Unable to write datasource file')
  })

  it('sends stop without forcing a datasource write', async () => {
    const write = vi.fn()
    const send = vi.fn(async () => undefined)
    const adapter = createGraphicsAdapter({
      createOscClient(config) {
        expect(config).toEqual({
          host: '127.0.0.1',
          port: 9000,
        })
        return { send }
      },
      fileWriter: {
        write,
      },
    })

    const result = await adapter.stop({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
      oscSettings,
    })

    expect(result.success).toBe(true)
    expect(write).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith('/lb/stop', [{ type: 's', value: 'TemplateName' }])
  })

  it('sends resume with the configured address and typed args', async () => {
    const send = vi.fn(async () => undefined)
    const adapter = createGraphicsAdapter({
      createOscClient() {
        return { send }
      },
      fileWriter: {
        write() {
          throw new Error('resume should not write datasource')
        },
      },
    })

    const result = await adapter.resume({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
      oscSettings,
    })

    expect(result.success).toBe(true)
    expect(send).toHaveBeenCalledWith('/lb/resume', [{ type: 's', value: 'TemplateName' }])
  })

  it('handles missing play command safely', async () => {
    const adapter = createGraphicsAdapter({
      createOscClient() {
        return {
          send: vi.fn(async () => undefined),
        }
      },
      fileWriter: {
        write() {},
      },
    })

    const result = await adapter.play({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: {
        ...graphicConfig,
        control: {
          ...graphicConfig.control,
          templateName: undefined,
        },
      },
      bindings: graphicConfig.bindings,
      oscSettings,
    })

    expect(result).toMatchObject({
      success: false,
      diagnostics: [
        {
          code: 'missing-template-name',
        },
      ],
    })
  })

  it('handles missing stop and resume commands safely', async () => {
    const adapter = createGraphicsAdapter({
      createOscClient() {
        return {
          send: vi.fn(async () => undefined),
        }
      },
      fileWriter: {
        write() {
          throw new Error('stop/resume should not write datasource')
        },
      },
    })

    const stopResult = await adapter.stop({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
      oscSettings: {
        ...oscSettings,
        commands: {
          ...oscSettings.commands,
          stop: {
            address: '',
            args: [],
          },
        },
      },
    })

    const resumeResult = await adapter.resume({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
      oscSettings: {
        ...oscSettings,
        commands: {
          ...oscSettings.commands,
          resume: {
            address: '',
            args: [],
          },
        },
      },
    })

    expect(stopResult.diagnostics[0]?.code).toBe('missing-osc-address')
    expect(resumeResult.diagnostics[0]?.code).toBe('missing-osc-address')
  })

  it('handles missing OSC target safely', async () => {
    const adapter = createGraphicsAdapter({
      createOscClient() {
        return {
          send: vi.fn(async () => undefined),
        }
      },
      fileWriter: {
        write() {},
      },
    })

    const result = await adapter.stop({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
      oscSettings: undefined,
    })

    expect(result.diagnostics[0]?.code).toBe('missing-osc-target')
  })

  it('returns an output error when OSC send fails after datasource write succeeds', async () => {
    const calls: string[] = []
    const adapter = createGraphicsAdapter({
      createOscClient() {
        return {
          send: vi.fn(async () => {
            calls.push('osc')
            throw new Error('udp send failed')
          }),
        }
      },
      fileWriter: {
        write() {
          calls.push('write')
        },
      },
    })

    const result = await adapter.play({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
      oscSettings,
    })

    expect(calls).toEqual(['write', 'osc'])
    expect(result).toMatchObject({
      success: false,
      diagnostics: [
        {
          code: 'osc-send-failed',
          message: 'udp send failed',
        },
      ],
    })
  })

  it('prefers graphic-specific OSC commands over global command addresses', async () => {
    const send = vi.fn(async () => undefined)
    const adapter = createGraphicsAdapter({
      createOscClient() {
        return { send }
      },
      fileWriter: {
        write() {},
      },
    })

    const result = await adapter.stop({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: {
        ...graphicConfig,
        control: {
          ...graphicConfig.control,
          stop: {
            address: '/graphics/title-main/stop',
            args: [],
          },
        },
      },
      bindings: graphicConfig.bindings,
      oscSettings,
    })

    expect(result.success).toBe(true)
    expect(send).toHaveBeenCalledWith('/graphics/title-main/stop', [])
  })

  it('uses a local play command override before the global play command', async () => {
    const send = vi.fn(async () => undefined)
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const adapter = createGraphicsAdapter({
      createOscClient() {
        return { send }
      },
      fileWriter: {
        write() {},
      },
    })

    const result = await adapter.play({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: {
        ...graphicConfig,
        control: {
          ...graphicConfig.control,
          play: {
            address: '/graphics/title-main/play',
            args: [{ type: 's', value: '{{templateName}}' }],
          },
        },
      },
      bindings: graphicConfig.bindings,
      oscSettings,
    })

    expect(result.success).toBe(true)
    expect(send).toHaveBeenCalledWith('/graphics/title-main/play', [
      { type: 's', value: 'TemplateName' },
    ])
    expect(log).toHaveBeenCalledWith('OSC PLAY RESOLUTION', expect.objectContaining({
      graphicId: 'title-main',
      resolvedTemplateName: 'TemplateName',
      commandSource: 'local override',
      address: '/graphics/title-main/play',
      args: [{ type: 's', value: 'TemplateName' }],
    }))
  })

  it('uses the global play command when no explicit local override exists', async () => {
    const send = vi.fn(async () => undefined)
    const adapter = createGraphicsAdapter({
      createOscClient() {
        return { send }
      },
      graphicOutput: {
        buildCommand() {
          return {
            actionType: 'playGraphic',
            address: '/fallback/play',
            args: [{ type: 's', value: 'fallback' }],
          }
        },
      },
      fileWriter: {
        write() {},
      },
    })

    const result = await adapter.play({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: {
        ...graphicConfig,
        control: {
          ...graphicConfig.control,
          play: '/legacy/title/play',
        },
      },
      bindings: graphicConfig.bindings,
      oscSettings,
    })

    expect(result.success).toBe(true)
    expect(send).toHaveBeenCalledWith('/lb/play', [
      { type: 's', value: 'TemplateName' },
      { type: 'i', value: 1 },
      { type: 'f', value: 0.5 },
    ])
  })

  it('falls back to the global play command when the local override is empty or invalid', async () => {
    const send = vi.fn(async () => undefined)
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const adapter = createGraphicsAdapter({
      createOscClient() {
        return { send }
      },
      fileWriter: {
        write() {},
      },
    })

    const result = await adapter.play({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: {
        ...graphicConfig,
        control: {
          ...graphicConfig.control,
          play: {
            address: '',
            args: [],
          },
        },
      },
      bindings: graphicConfig.bindings,
      oscSettings,
    })

    expect(result.success).toBe(true)
    expect(send).toHaveBeenCalledWith('/lb/play', [
      { type: 's', value: 'TemplateName' },
      { type: 'i', value: 1 },
      { type: 'f', value: 0.5 },
    ])
    expect(log).toHaveBeenCalledWith('OSC PLAY RESOLUTION', expect.objectContaining({
      graphicId: 'title-main',
      resolvedTemplateName: 'TemplateName',
      commandSource: 'global',
      address: '/lb/play',
      args: [
        { type: 's', value: 'TemplateName' },
        { type: 'i', value: 1 },
        { type: 'f', value: 0.5 },
      ],
    }))
  })

  it('uses the global stop and resume commands when no explicit local override exists', async () => {
    const send = vi.fn(async () => undefined)
    const adapter = createGraphicsAdapter({
      createOscClient() {
        return { send }
      },
      fileWriter: {
        write() {
          throw new Error('stop/resume should not write datasource')
        },
      },
    })

    const graphicWithoutLocalOverrides = {
      ...graphicConfig,
      control: {
        ...graphicConfig.control,
        stop: '/legacy/title/stop',
        resume: '/legacy/title/resume',
      },
    }

    const stopResult = await adapter.stop({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: graphicWithoutLocalOverrides,
      bindings: graphicConfig.bindings,
      oscSettings,
    })
    const resumeResult = await adapter.resume({
      entityType: 'title',
      entity: { id: 'title-1', text: 'Morning Briefing' },
      graphic: graphicWithoutLocalOverrides,
      bindings: graphicConfig.bindings,
      oscSettings,
    })

    expect(stopResult.success).toBe(true)
    expect(resumeResult.success).toBe(true)
    expect(send).toHaveBeenNthCalledWith(1, '/lb/stop', [{ type: 's', value: 'TemplateName' }])
    expect(send).toHaveBeenNthCalledWith(2, '/lb/resume', [{ type: 's', value: 'TemplateName' }])
  })
})
