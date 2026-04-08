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
  bindings: [{ sourceField: 'Titlu', targetField: 'text', required: true }],
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
  bindings: [{ sourceField: 'Nume', targetField: 'name', required: true }],
}

const titleSelection: SelectedEntityContext = {
  blockIndex: 0,
  blockName: 'Opening',
  graphicConfigId: 'title-main',
  entityIndex: 0,
  entity: { text: 'Morning Briefing', number: '1' },
}

const personSelection: SelectedEntityContext = {
  blockIndex: 0,
  blockName: 'Opening',
  graphicConfigId: 'person-main',
  entityIndex: 0,
  entity: { name: 'Ana Rusu', role: 'Anchor' },
}

describe('selected entity control resolution', () => {
  it('resolves the selected graphic by graphicConfigId', () => {
    const graphic = resolveGraphicControlForSelectedEntity(
      {
        'title-main': titleGraphic,
        'person-main': personGraphic,
      },
      personSelection,
    )

    expect(graphic?.id).toBe('person-main')
    expect(graphic?.control.play).toBe('/aplay/person/play')
  })
})

describe('selected entity publish and command orchestration', () => {
  it('publishes to the correct datasource file for the selected graphic config', () => {
    const publishCalls: Array<{ entityType: string; targetFile: string }> = []
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsById: { 'title-main': titleGraphic },
      bindingsByGraphicId: {},
      publishTarget: {
        publishEntity(input) {
          publishCalls.push({ entityType: input.entityType, targetFile: input.targetFile })
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
            command: { actionType: 'playGraphic', address: '/aplay/title/play', args: [] },
            diagnostics: [],
          }
        },
      },
    })

    const result = orchestrator.play(titleSelection)

    expect(result.kind).toBe('success')
    expect(publishCalls).toEqual([{ entityType: 'title', targetFile: 'datasources/title-main.json' }])
  })

  it('uses graphic-id fallback bindings when the graphic has no embedded bindings', () => {
    const publishCalls: Array<{ bindings: Array<{ sourceField: string; targetField: string }> }> = []
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsById: {
        'title-main': {
          ...titleGraphic,
          bindings: undefined,
        },
      },
      bindingsByGraphicId: {
        'title-main': [{ sourceField: 'Titlu', targetField: 'text', required: true }],
      },
      publishTarget: {
        publishEntity(input) {
          publishCalls.push({ bindings: input.bindings })
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
            command: { actionType: 'playGraphic', address: '/aplay/title/play', args: [] },
            diagnostics: [],
          }
        },
      },
    })

    orchestrator.play(titleSelection)

    expect(publishCalls).toEqual([
      { bindings: [{ sourceField: 'Titlu', targetField: 'text', required: true }] },
    ])
  })

  it('does not publish on stop and resume', () => {
    const calls: string[] = []
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsById: { 'title-main': titleGraphic },
      bindingsByGraphicId: {},
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
        sendForGraphic(input) {
          calls.push(input.actionType)
          return {
            success: true,
            command: { actionType: input.actionType, address: '/aplay/title/stop', args: [] },
            diagnostics: [],
          }
        },
      },
    })

    orchestrator.stop(titleSelection)
    orchestrator.resume(titleSelection)

    expect(calls).toEqual(['stopGraphic', 'resumeGraphic'])
  })

  it('returns a safe error when the selected graphic config is unavailable', () => {
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsById: {},
      bindingsByGraphicId: {},
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
      details: ['No graphic configuration is loaded for "title-main".'],
    })
  })

  it('surfaces publish failures', () => {
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsById: { 'title-main': titleGraphic },
      bindingsByGraphicId: {},
      publishTarget: {
        publishEntity() {
          return {
            success: false,
            targetFile: 'datasources/title-main.json',
            payload: {},
            diagnostics: [{ severity: 'error', code: 'invalid-target-path', message: 'Unable to write datasource file' }],
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
      details: ['Unable to write datasource file'],
    })
  })

  it('surfaces output failures', () => {
    const orchestrator = createSelectedEntityControlOrchestrator({
      graphicsById: { 'title-main': titleGraphic },
      bindingsByGraphicId: {},
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
            command: { actionType: 'playGraphic', address: '/aplay/title/play', args: [] },
            diagnostics: [{ severity: 'error', code: 'osc-send-failed', message: 'OSC failed' }],
          }
        },
      },
    })

    expect(orchestrator.play(titleSelection)).toEqual({
      kind: 'error',
      title: 'Output failed',
      details: ['OSC failed'],
    })
  })
})

describe('selected entity preview data', () => {
  it('returns preview content directly from the selected item fields', () => {
    expect(createSelectedEntityPreviewData(personSelection)).toEqual({
      name: 'Ana Rusu',
      role: 'Anchor',
    })
  })
})
