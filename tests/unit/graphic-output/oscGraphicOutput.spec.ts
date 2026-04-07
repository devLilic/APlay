import { describe, expect, it } from 'vitest'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import { actionTypes } from '@/core/actions/actionTypes'
import {
  graphicOutputAdapterSchema,
  type GraphicOutputCommand,
} from '@/adapters/graphic-output/contracts'
import { createOscGraphicOutputAdapter } from '@/adapters/graphic-output/oscGraphicOutput'

const graphicConfig: GraphicInstanceConfig = {
  id: 'title-main',
  entityType: 'title',
  dataFileName: 'title-main.json',
  control: {
    play: '/lb/title/play',
    stop: '/lb/title/stop',
    resume: '/lb/title/resume',
  },
  preview: {
    id: 'title-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      {
        id: 'headline',
        kind: 'text',
        sourceField: 'text',
        transformOrigin: 'top-left',
        box: {
          x: 0,
          y: 0,
          width: 100,
          height: 20,
        },
      },
    ],
  },
  actions: [
    { actionType: 'playGraphic', label: 'Play' },
    { actionType: 'stopGraphic', label: 'Stop' },
    { actionType: 'resumeGraphic', label: 'Resume' },
  ],
}

const structuredGraphicConfig: GraphicInstanceConfig = {
  ...graphicConfig,
  id: 'title-structured',
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
}

describe('GraphicOutputAdapter contract', () => {
  it('defines an output adapter that executes code-defined actions', () => {
    const adapter = graphicOutputAdapterSchema.parse({
      id: 'osc-output',
      protocol: 'osc',
      supportedActionTypes: Object.values(actionTypes),
      execute(command: GraphicOutputCommand) {
        return {
          success: true,
          command,
          diagnostics: [],
        }
      },
    })

    const result = adapter.execute({
      actionType: 'playGraphic',
      address: '/lb/title/play',
      args: [],
    })

    expect(adapter.protocol).toBe('osc')
    expect(result).toEqual({
      success: true,
      command: {
        actionType: 'playGraphic',
        address: '/lb/title/play',
        args: [],
      },
      diagnostics: [],
    })
  })
})

describe('OSC graphic output', () => {
  it('builds an OSC command for play', () => {
    const adapter = createOscGraphicOutputAdapter()

    expect(
      adapter.buildCommand({
        actionType: 'playGraphic',
        graphic: graphicConfig,
      }),
    ).toEqual({
      actionType: 'playGraphic',
      address: '/lb/title/play',
      args: [],
    })
  })

  it('builds an OSC command for stop', () => {
    const adapter = createOscGraphicOutputAdapter()

    expect(
      adapter.buildCommand({
        actionType: 'stopGraphic',
        graphic: graphicConfig,
      }),
    ).toEqual({
      actionType: 'stopGraphic',
      address: '/lb/title/stop',
      args: [],
    })
  })

  it('builds an OSC command for resume', () => {
    const adapter = createOscGraphicOutputAdapter()

    expect(
      adapter.buildCommand({
        actionType: 'resumeGraphic',
        graphic: graphicConfig,
      }),
    ).toEqual({
      actionType: 'resumeGraphic',
      address: '/lb/title/resume',
      args: [],
    })
  })

  it('preserves the configured structured OSC address and typed args for play', () => {
    const adapter = createOscGraphicOutputAdapter()

    expect(
      adapter.buildCommand({
        actionType: 'playGraphic',
        graphic: structuredGraphicConfig,
      }),
    ).toEqual({
      actionType: 'playGraphic',
      address: '/lb/title/play',
      args: [
        { type: 's', value: 'TemplateName' },
        { type: 'i', value: 1 },
        { type: 'f', value: 0.5 },
      ],
    })
  })

  it('uses the correct mapping for the selected graphic control instance', () => {
    const adapter = createOscGraphicOutputAdapter()
    const otherGraphic: GraphicInstanceConfig = {
      ...graphicConfig,
      id: 'phone-main',
      entityType: 'phone',
      dataFileName: 'phone-main.json',
      control: {
        play: '/lb/phone/play',
        stop: '/lb/phone/stop',
        resume: '/lb/phone/resume',
      },
    }

    expect(
      adapter.buildCommand({
        actionType: 'playGraphic',
        graphic: otherGraphic,
      }),
    ).toEqual({
      actionType: 'playGraphic',
      address: '/lb/phone/play',
      args: [],
    })
  })

  it('behaves safely when OSC mapping is missing', () => {
    const adapter = createOscGraphicOutputAdapter()

    const result = adapter.sendForGraphic(
      {
        actionType: 'resumeGraphic',
        graphic: {
          ...graphicConfig,
          control: {
            ...graphicConfig.control,
            resume: '',
          },
        },
      },
      createInMemoryOscTransport(),
    )

    expect(result.success).toBe(false)
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'missing-osc-address',
        message: 'Missing OSC address for action "resumeGraphic" on graphic "title-main"',
        details: {
          actionType: 'resumeGraphic',
          graphicId: 'title-main',
        },
      },
    ])
  })

  it('behaves safely when OSC send fails', () => {
    const adapter = createOscGraphicOutputAdapter()

    const result = adapter.sendForGraphic(
      {
        actionType: 'playGraphic',
        graphic: graphicConfig,
      },
      createInMemoryOscTransport(true),
    )

    expect(result.success).toBe(false)
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'osc-send-failed',
        message: 'Failed to send OSC command for action "playGraphic"',
        details: {
          actionType: 'playGraphic',
          address: '/lb/title/play',
        },
      },
    ])
  })

  it('keeps config resolution separate from execution transport', () => {
    const adapter = createOscGraphicOutputAdapter()
    const transport = createInMemoryOscTransport()

    const result = adapter.sendForGraphic(
      {
        actionType: 'stopGraphic',
        graphic: graphicConfig,
      },
      transport,
    )

    expect(result.success).toBe(true)
    expect(transport.sentCommands).toEqual([
      {
        actionType: 'stopGraphic',
        address: '/lb/title/stop',
        args: [],
      },
    ])
    expect(result).not.toHaveProperty('preview')
  })

  it('does not let preview reference background config affect OSC mapping', () => {
    const adapter = createOscGraphicOutputAdapter()
    const graphicWithBackground: GraphicInstanceConfig = {
      ...graphicConfig,
      preview: {
        ...graphicConfig.preview,
        background: {
          referenceImageId: 'lb-title-reference',
          opacity: 0.4,
          fitMode: 'contain',
          position: 'center',
        },
      },
    }

    expect(
      adapter.buildCommand({
        actionType: 'playGraphic',
        graphic: graphicWithBackground,
      }),
    ).toEqual({
      actionType: 'playGraphic',
      address: '/lb/title/play',
      args: [],
    })
  })
})

function createInMemoryOscTransport(shouldFail = false) {
  const sentCommands: Array<{
    actionType: string
    address: string
    args: unknown[]
  }> = []

  return {
    sentCommands,
    send(command: { actionType: string; address: string; args: unknown[] }) {
      if (shouldFail) {
        throw new Error('send failed')
      }

      sentCommands.push(command)
    },
  }
}
