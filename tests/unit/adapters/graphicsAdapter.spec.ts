import { describe, expect, it, vi } from 'vitest'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import { createGraphicsAdapter } from '@/adapters/graphics/graphicsAdapter'

const graphicConfig: GraphicInstanceConfig = {
  id: 'title-main',
  entityType: 'title',
  dataFileName: 'title-main.json',
  control: {
    oscTarget: {
      host: '127.0.0.1',
      port: 9000,
    },
    play: {
      address: '/lb/title/play',
      args: [
        { type: 's', value: 'TemplateName' },
        { type: 'i', value: 1 },
        { type: 'f', value: 0.5 },
      ],
    },
    stop: {
      address: '/lb/title/stop',
      args: [],
    },
    resume: {
      address: '/lb/title/resume',
      args: [{ type: 's', value: 'resume' }],
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

describe('GraphicsAdapter', () => {
  it('writes datasource first, then sends OSC play', async () => {
    const calls: string[] = []
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
      entity: { text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
    })

    expect(calls).toEqual(['write', 'osc'])
    expect(result).toMatchObject({
      success: true,
      actionType: 'playGraphic',
      targetFile: 'datasources/title-main.json',
      command: {
        host: '127.0.0.1',
        port: 9000,
        address: '/lb/title/play',
        args: [
          { type: 's', value: 'TemplateName' },
          { type: 'i', value: 1 },
          { type: 'f', value: 0.5 },
        ],
      },
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
      entity: { text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
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
      entity: { text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
    })

    expect(result.success).toBe(true)
    expect(write).not.toHaveBeenCalled()
    expect(send).toHaveBeenCalledWith('/lb/title/stop', [])
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
      entity: { text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
    })

    expect(result.success).toBe(true)
    expect(send).toHaveBeenCalledWith('/lb/title/resume', [{ type: 's', value: 'resume' }])
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
      entity: { text: 'Morning Briefing' },
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
    })

    expect(result).toMatchObject({
      success: false,
      diagnostics: [
        {
          code: 'missing-osc-address',
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
      entity: { text: 'Morning Briefing' },
      graphic: {
        ...graphicConfig,
        control: {
          ...graphicConfig.control,
          stop: {
            address: '',
            args: [],
          },
        },
      },
      bindings: graphicConfig.bindings,
    })

    const resumeResult = await adapter.resume({
      entityType: 'title',
      entity: { text: 'Morning Briefing' },
      graphic: {
        ...graphicConfig,
        control: {
          ...graphicConfig.control,
          resume: {
            address: '',
            args: [],
          },
        },
      },
      bindings: graphicConfig.bindings,
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
      entity: { text: 'Morning Briefing' },
      graphic: {
        ...graphicConfig,
        control: {
          ...graphicConfig.control,
          oscTarget: undefined,
        },
      },
      bindings: graphicConfig.bindings,
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
      entity: { text: 'Morning Briefing' },
      graphic: graphicConfig,
      bindings: graphicConfig.bindings,
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
})
