import { describe, expect, it } from 'vitest'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import type { SelectedEntityContext } from '@/features/workspace/state/workspaceSelectionState'
import {
  createSelectedEntityControlOrchestrator,
  createSelectedEntityPreviewData,
  resolveGraphicControlForSelectedEntity,
} from '@/features/workspace/state/selectedEntityControl'

const titleGraphic: GraphicInstanceConfig = {
  id: 'title-main',
  entityType: 'title',
  dataFileName: 'title-main.json',
  control: {
    play: '/aplay/title/play',
    stop: '/aplay/title/stop',
    resume: '/aplay/title/resume',
  },
  preview: {
    id: 'title-preview',
    designWidth: 1920,
    designHeight: 1080,
    elements: [
      {
        id: 'title-text',
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

const personGraphic: GraphicInstanceConfig = {
  ...titleGraphic,
  id: 'person-main',
  entityType: 'person',
  dataFileName: 'person-main.json',
  control: {
    play: '/aplay/person/play',
    stop: '/aplay/person/stop',
    resume: '/aplay/person/resume',
  },
}

const structuredOscGraphic: GraphicInstanceConfig = {
  ...titleGraphic,
  id: 'title-structured',
  control: {
    oscTarget: {
      host: '127.0.0.1',
      port: 9000,
    },
    play: {
      address: '/aplay/title/play',
      args: [
        { type: 's', value: 'TitleTemplate' },
        { type: 'i', value: 1 },
        { type: 'f', value: 0.5 },
      ],
    },
    stop: {
      address: '/aplay/title/stop',
      args: [],
    },
    resume: {
      address: '/aplay/title/resume',
      args: [{ type: 's', value: 'resume' }],
    },
  },
}

const titleSelection: SelectedEntityContext = {
  blockIndex: 0,
  blockName: 'Opening',
  entityGroup: 'titles',
  entityIndex: 0,
  entity: { text: 'Morning Briefing' },
}

const personSelection: SelectedEntityContext = {
  blockIndex: 0,
  blockName: 'Opening',
  entityGroup: 'persons',
  entityIndex: 0,
  entity: { name: 'Ana Rusu', role: 'Anchor' },
}

describe('selected entity control resolution', () => {
  it('resolves the correct GraphicControlConfig for a selected entity type', () => {
    const graphic = resolveGraphicControlForSelectedEntity(
      {
        title: titleGraphic,
        person: personGraphic,
      },
      personSelection,
    )

    expect(graphic?.control).toEqual({
      play: '/aplay/person/play',
      stop: '/aplay/person/stop',
      resume: '/aplay/person/resume',
    })
  })
})

describe('selected entity publish and command orchestration', () => {
  it('publishes the selected entity to the correct JSON datasource file', () => {
    const publishCalls: Array<{ targetFile: string }> = []
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: { title: titleGraphic },
      bindingsByEntityType: {
        title: [{ sourceField: 'text', targetField: 'text', required: true }],
      },
      publishTarget: {
        publishEntity(input) {
          publishCalls.push({ targetFile: input.targetFile })
          return {
            success: true,
            targetFile: input.targetFile,
            payload: { text: 'Morning Briefing' },
            diagnostics: [],
          }
        },
      },
      graphicOutput: {
        sendForGraphic() {
          return {
            success: true,
            command: {
              actionType: 'playGraphic',
              address: '/aplay/title/play',
              args: [],
            },
            diagnostics: [],
          }
        },
      },
    })

    orchestrator.play(titleSelection)

    expect(publishCalls).toEqual([{ targetFile: 'datasources/title-main.json' }])
  })

  it('uses the fallback datasource file when no datasource JSON path is configured', () => {
    const publishCalls: Array<{ targetFile: string }> = []
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: {
        title: {
          ...titleGraphic,
          datasourcePath: undefined,
        },
      },
      bindingsByEntityType: {
        title: [{ sourceField: 'text', targetField: 'text', required: true }],
      },
      publishTarget: {
        publishEntity(input) {
          publishCalls.push({ targetFile: input.targetFile })
          return {
            success: true,
            targetFile: input.targetFile,
            payload: { text: 'Morning Briefing' },
            diagnostics: [],
          }
        },
      },
      graphicOutput: {
        sendForGraphic() {
          return {
            success: true,
            command: {
              actionType: 'playGraphic',
              address: '/aplay/title/play',
              args: [],
            },
            diagnostics: [],
          }
        },
      },
    })

    orchestrator.play(titleSelection)

    expect(publishCalls).toEqual([{ targetFile: 'datasources/title-main.json' }])
  })

  it('orchestrates the play action', () => {
    const calls: string[] = []
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: { title: titleGraphic },
      bindingsByEntityType: {
        title: [{ sourceField: 'text', targetField: 'text', required: true }],
      },
      publishTarget: {
        publishEntity() {
          calls.push('publish')
          return {
            success: true,
            targetFile: 'datasources/title-main.json',
            payload: { text: 'Morning Briefing' },
            diagnostics: [],
          }
        },
      },
      graphicOutput: {
        sendForGraphic() {
          calls.push('osc')
          return {
            success: true,
            command: {
              actionType: 'playGraphic',
              address: '/aplay/title/play',
              args: [],
            },
            diagnostics: [],
          }
        },
      },
    })

    const result = orchestrator.play(titleSelection)

    expect(calls).toEqual(['publish', 'osc'])
    expect(result.kind).toBe('success')
  })

  it('passes the selected graphic config through to output so the configured OSC target and typed play args can be resolved', () => {
    let receivedGraphic: GraphicInstanceConfig | undefined
    let receivedActionType: string | undefined
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: { title: structuredOscGraphic },
      bindingsByEntityType: {
        title: [{ sourceField: 'text', targetField: 'text', required: true }],
      },
      publishTarget: {
        publishEntity() {
          return {
            success: true,
            targetFile: 'datasources/title-main.json',
            payload: { text: 'Morning Briefing' },
            diagnostics: [],
          }
        },
      },
      graphicOutput: {
        sendForGraphic(input) {
          receivedGraphic = input.graphic
          receivedActionType = input.actionType
          return {
            success: true,
            command: {
              actionType: 'playGraphic',
              address: '/aplay/title/play',
              args: [
                { type: 's', value: 'TitleTemplate' },
                { type: 'i', value: 1 },
                { type: 'f', value: 0.5 },
              ],
            },
            diagnostics: [],
          }
        },
      },
    })

    const result = orchestrator.play(titleSelection)

    expect(result.kind).toBe('success')
    expect(receivedActionType).toBe('playGraphic')
    expect(receivedGraphic?.control).toEqual(structuredOscGraphic.control)
  })

  it('orchestrates the stop action', () => {
    const calls: string[] = []
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: { title: titleGraphic },
      bindingsByEntityType: { title: [] },
      publishTarget: {
        publishEntity() {
          calls.push('publish')
          return {
            success: true,
            targetFile: 'datasources/title-main.json',
            payload: {},
            diagnostics: [],
          }
        },
      },
      graphicOutput: {
        sendForGraphic() {
          calls.push('osc')
          return {
            success: true,
            command: {
              actionType: 'stopGraphic',
              address: '/aplay/title/stop',
              args: [],
            },
            diagnostics: [],
          }
        },
      },
    })

    const result = orchestrator.stop(titleSelection)

    expect(calls).toEqual(['osc'])
    expect(result.kind).toBe('success')
  })

  it('uses the configured stop OSC command without forcing a datasource write', () => {
    const publishCalls: string[] = []
    const outputCalls: string[] = []
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: { title: structuredOscGraphic },
      bindingsByEntityType: { title: [] },
      publishTarget: {
        publishEntity() {
          publishCalls.push('publish')
          return {
            success: true,
            targetFile: 'datasources/title-main.json',
            payload: {},
            diagnostics: [],
          }
        },
      },
      graphicOutput: {
        sendForGraphic(input) {
          outputCalls.push(input.actionType)
          return {
            success: true,
            command: {
              actionType: 'stopGraphic',
              address: '/aplay/title/stop',
              args: [],
            },
            diagnostics: [],
          }
        },
      },
    })

    const result = orchestrator.stop(titleSelection)

    expect(result.kind).toBe('success')
    expect(publishCalls).toEqual([])
    expect(outputCalls).toEqual(['stopGraphic'])
  })

  it('orchestrates the resume action', () => {
    const calls: string[] = []
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: { title: titleGraphic },
      bindingsByEntityType: { title: [] },
      publishTarget: {
        publishEntity() {
          calls.push('publish')
          return {
            success: true,
            targetFile: 'datasources/title-main.json',
            payload: {},
            diagnostics: [],
          }
        },
      },
      graphicOutput: {
        sendForGraphic() {
          calls.push('osc')
          return {
            success: true,
            command: {
              actionType: 'resumeGraphic',
              address: '/aplay/title/resume',
              args: [],
            },
            diagnostics: [],
          }
        },
      },
    })

    const result = orchestrator.resume(titleSelection)

    expect(calls).toEqual(['osc'])
    expect(result.kind).toBe('success')
  })

  it('uses the configured resume OSC command without forcing a datasource write', () => {
    const publishCalls: string[] = []
    const outputCalls: string[] = []
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: { title: structuredOscGraphic },
      bindingsByEntityType: { title: [] },
      publishTarget: {
        publishEntity() {
          publishCalls.push('publish')
          return {
            success: true,
            targetFile: 'datasources/title-main.json',
            payload: {},
            diagnostics: [],
          }
        },
      },
      graphicOutput: {
        sendForGraphic(input) {
          outputCalls.push(input.actionType)
          return {
            success: true,
            command: {
              actionType: 'resumeGraphic',
              address: '/aplay/title/resume',
              args: [{ type: 's', value: 'resume' }],
            },
            diagnostics: [],
          }
        },
      },
    })

    const result = orchestrator.resume(titleSelection)

    expect(result.kind).toBe('success')
    expect(publishCalls).toEqual([])
    expect(outputCalls).toEqual(['resumeGraphic'])
  })

  it('behaves safely when no config exists for the selected entity type', () => {
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: {},
      bindingsByEntityType: {},
      publishTarget: {
        publishEntity() {
          throw new Error('should not publish')
        },
      },
      graphicOutput: {
        sendForGraphic() {
          throw new Error('should not send')
        },
      },
    })

    expect(orchestrator.play(titleSelection)).toEqual({
      kind: 'error',
      title: 'Graphic unavailable',
      details: ['No graphic configuration is loaded for entity type "title".'],
    })
  })

  it('behaves safely when publish target fails', () => {
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: { title: titleGraphic },
      bindingsByEntityType: {
        title: [{ sourceField: 'text', targetField: 'text', required: true }],
      },
      publishTarget: {
        publishEntity() {
          return {
            success: false,
            targetFile: 'datasources/title-main.json',
            payload: {},
            diagnostics: [
              {
                severity: 'error',
                code: 'invalid-target-path',
                message: 'Unable to write datasource file "datasources/title-main.json"',
              },
            ],
          }
        },
      },
      graphicOutput: {
        sendForGraphic() {
          throw new Error('should not send when publish fails')
        },
      },
    })

    expect(orchestrator.play(titleSelection)).toEqual({
      kind: 'error',
      title: 'Publish failed',
      details: ['Unable to write datasource file "datasources/title-main.json"'],
    })
  })

  it('behaves safely when OSC output fails', () => {
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: { title: titleGraphic },
      bindingsByEntityType: {
        title: [{ sourceField: 'text', targetField: 'text', required: true }],
      },
      publishTarget: {
        publishEntity() {
          return {
            success: true,
            targetFile: 'datasources/title-main.json',
            payload: { text: 'Morning Briefing' },
            diagnostics: [],
          }
        },
      },
      graphicOutput: {
        sendForGraphic() {
          return {
            success: false,
            command: {
              actionType: 'playGraphic',
              address: '/aplay/title/play',
              args: [],
            },
            diagnostics: [
              {
                severity: 'error',
                code: 'osc-send-failed',
                message: 'Failed to send OSC command for action "playGraphic"',
              },
            ],
          }
        },
      },
    })

    expect(orchestrator.play(titleSelection)).toEqual({
      kind: 'error',
      title: 'Output failed',
      details: ['Failed to send OSC command for action "playGraphic"'],
    })
  })

  it('behaves safely when an OSC mapping is missing', () => {
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: {
        title: {
          ...titleGraphic,
          control: {
            play: '',
            stop: '/aplay/title/stop',
            resume: '/aplay/title/resume',
          },
        },
      },
      bindingsByEntityType: {
        title: [{ sourceField: 'text', targetField: 'text', required: true }],
      },
      publishTarget: {
        publishEntity() {
          return {
            success: true,
            targetFile: 'datasources/title-main.json',
            payload: { text: 'Morning Briefing' },
            diagnostics: [],
          }
        },
      },
      graphicOutput: {
        sendForGraphic() {
          return {
            success: false,
            command: {
              actionType: 'playGraphic',
              address: '',
              args: [],
            },
            diagnostics: [
              {
                severity: 'error',
                code: 'missing-osc-address',
                message: 'Missing OSC address for action "playGraphic" on graphic "title-main"',
              },
            ],
          }
        },
      },
    })

    expect(orchestrator.play(titleSelection)).toEqual({
      kind: 'error',
      title: 'Output failed',
      details: ['Missing OSC address for action "playGraphic" on graphic "title-main"'],
    })
  })

  it('behaves safely when the stop command is missing', () => {
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: {
        title: {
          ...titleGraphic,
          control: {
            ...titleGraphic.control,
            stop: '',
          },
        },
      },
      bindingsByEntityType: { title: [] },
      publishTarget: {
        publishEntity() {
          throw new Error('should not publish for stop')
        },
      },
      graphicOutput: {
        sendForGraphic() {
          return {
            success: false,
            command: {
              actionType: 'stopGraphic',
              address: '',
              args: [],
            },
            diagnostics: [
              {
                severity: 'error',
                code: 'missing-osc-address',
                message: 'Missing OSC address for action "stopGraphic" on graphic "title-main"',
              },
            ],
          }
        },
      },
    })

    expect(orchestrator.stop(titleSelection)).toEqual({
      kind: 'error',
      title: 'Output failed',
      details: ['Missing OSC address for action "stopGraphic" on graphic "title-main"'],
    })
  })

  it('behaves safely when the resume command is missing', () => {
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: {
        title: {
          ...titleGraphic,
          control: {
            ...titleGraphic.control,
            resume: '',
          },
        },
      },
      bindingsByEntityType: { title: [] },
      publishTarget: {
        publishEntity() {
          throw new Error('should not publish for resume')
        },
      },
      graphicOutput: {
        sendForGraphic() {
          return {
            success: false,
            command: {
              actionType: 'resumeGraphic',
              address: '',
              args: [],
            },
            diagnostics: [
              {
                severity: 'error',
                code: 'missing-osc-address',
                message: 'Missing OSC address for action "resumeGraphic" on graphic "title-main"',
              },
            ],
          }
        },
      },
    })

    expect(orchestrator.resume(titleSelection)).toEqual({
      kind: 'error',
      title: 'Output failed',
      details: ['Missing OSC address for action "resumeGraphic" on graphic "title-main"'],
    })
  })

  it('behaves safely when required source fields for the selected graphic are missing', () => {
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsByEntityType: {
        title: {
          ...titleGraphic,
          bindings: [{ sourceField: 'headline', targetField: 'text', required: true }],
        },
      },
      bindingsByEntityType: {
        title: [{ sourceField: 'headline', targetField: 'text', required: true }],
      },
      publishTarget: {
        publishEntity() {
          return {
            success: false,
            targetFile: 'datasources/title-main.json',
            payload: {},
            diagnostics: [
              {
                severity: 'error',
                code: 'missing-source-field',
                message: 'Missing required source field "headline" for target field "text"',
              },
            ],
          }
        },
      },
      graphicOutput: {
        sendForGraphic() {
          throw new Error('should not send when required fields are missing')
        },
      },
    })

    expect(orchestrator.play(titleSelection)).toEqual({
      kind: 'error',
      title: 'Publish failed',
      details: ['Missing required source field "headline" for target field "text"'],
    })
  })
})

describe('selected entity preview data', () => {
  it('resolves selected entity preview data independently of play stop resume', () => {
    expect(createSelectedEntityPreviewData(personSelection)).toEqual({
      name: 'Ana Rusu',
      role: 'Anchor',
    })
  })
})
