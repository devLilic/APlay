import { describe, expect, it } from 'vitest'
import type {
  PersonEntity,
  PhoneEntity,
  SupertitleEntity,
  TextValueEntity,
  TitleEntity,
} from '@/core/models/editorial'
import { createJsonDatasourcePublishTargetAdapter } from '@/adapters/publish-target/jsonDatasourcePublishTarget'
import { publishTargetAdapterSchema, type PublishTargetPublishInput } from '@/adapters/publish-target/contracts'

const titleEntity: TitleEntity = { text: 'Main Title' }
const supertitleEntity: SupertitleEntity = { text: 'Top Strap' }
const personEntity: PersonEntity = { name: 'Jane Doe', role: 'Anchor' }
const textValueEntity: TextValueEntity = { value: 'Chisinau' }
const phoneEntity: PhoneEntity = { label: 'Desk', number: '111' }

describe('PublishTargetAdapter contract', () => {
  it('defines a publish adapter that writes a payload for a configured target file', () => {
    const adapter = publishTargetAdapterSchema.parse({
      id: 'json-datasource',
      output: 'jsonDatasource',
      publish(input: PublishTargetPublishInput) {
        return {
          success: true,
          payload: input.payload,
          targetFile: input.targetFile,
          diagnostics: [],
        }
      },
    })

    const result = adapter.publish({
      targetFile: 'title-main.json',
      payload: { text: 'Headline' },
    })

    expect(adapter.output).toBe('jsonDatasource')
    expect(result).toEqual({
      success: true,
      payload: { text: 'Headline' },
      targetFile: 'title-main.json',
      diagnostics: [],
    })
  })
})

describe('JSON datasource publishing', () => {
  it('maps a title entity to a JSON payload', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()

    const result = adapter.mapEntityToPayload({
      entityType: 'title',
      entity: titleEntity,
      bindings: [{ sourceField: 'text', targetField: 'headline' }],
    })

    expect(result.payload).toEqual({ headline: 'Main Title' })
  })

  it('maps a supertitle entity to a JSON payload', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()

    const result = adapter.mapEntityToPayload({
      entityType: 'supertitle',
      entity: supertitleEntity,
      bindings: [{ sourceField: 'text', targetField: 'strap' }],
    })

    expect(result.payload).toEqual({ strap: 'Top Strap' })
  })

  it('maps a person entity to a JSON payload', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()

    const result = adapter.mapEntityToPayload({
      entityType: 'person',
      entity: personEntity,
      bindings: [
        { sourceField: 'name', targetField: 'name' },
        { sourceField: 'role', targetField: 'role' },
      ],
    })

    expect(result.payload).toEqual({
      name: 'Jane Doe',
      role: 'Anchor',
    })
  })

  it('maps location/breaking/waiting entities to a JSON payload', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()

    expect(
      adapter.mapEntityToPayload({
        entityType: 'location',
        entity: textValueEntity,
        bindings: [{ sourceField: 'value', targetField: 'location' }],
      }).payload,
    ).toEqual({ location: 'Chisinau' })

    expect(
      adapter.mapEntityToPayload({
        entityType: 'breakingNews',
        entity: textValueEntity,
        bindings: [{ sourceField: 'value', targetField: 'line' }],
      }).payload,
    ).toEqual({ line: 'Chisinau' })

    expect(
      adapter.mapEntityToPayload({
        entityType: 'waitingTitle',
        entity: textValueEntity,
        bindings: [{ sourceField: 'value', targetField: 'title' }],
      }).payload,
    ).toEqual({ title: 'Chisinau' })

    expect(
      adapter.mapEntityToPayload({
        entityType: 'waitingLocation',
        entity: textValueEntity,
        bindings: [{ sourceField: 'value', targetField: 'location' }],
      }).payload,
    ).toEqual({ location: 'Chisinau' })
  })

  it('maps a phone entity to a JSON payload', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()

    const result = adapter.mapEntityToPayload({
      entityType: 'phone',
      entity: phoneEntity,
      bindings: [
        { sourceField: 'label', targetField: 'label' },
        { sourceField: 'number', targetField: 'number' },
      ],
    })

    expect(result.payload).toEqual({
      label: 'Desk',
      number: '111',
    })
  })

  it('writes JSON to the configured datasource file', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()
    const target = createInMemoryTargetFileWriter()

    const result = adapter.publishEntity(
      {
        entityType: 'title',
        entity: titleEntity,
        targetFile: 'graphics/title-main.json',
        bindings: [{ sourceField: 'text', targetField: 'headline' }],
      },
      target,
    )

    expect(result.success).toBe(true)
    expect(target.read('graphics/title-main.json')).toBe('{\n  "headline": "Main Title"\n}')
  })

  it('overwrites an existing datasource file safely', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()
    const target = createInMemoryTargetFileWriter({
      'graphics/title-main.json': '{"headline":"Old"}',
    })

    adapter.publishEntity(
      {
        entityType: 'title',
        entity: titleEntity,
        targetFile: 'graphics/title-main.json',
        bindings: [{ sourceField: 'text', targetField: 'headline' }],
      },
      target,
    )

    expect(target.read('graphics/title-main.json')).toBe('{\n  "headline": "Main Title"\n}')
  })

  it('handles an invalid target path safely', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()
    const target = createInMemoryTargetFileWriter({}, ['invalid|path.json'])

    const result = adapter.publishEntity(
      {
        entityType: 'title',
        entity: titleEntity,
        targetFile: 'invalid|path.json',
        bindings: [{ sourceField: 'text', targetField: 'headline' }],
      },
      target,
    )

    expect(result.success).toBe(false)
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'invalid-target-path',
        message: 'Unable to write datasource file "invalid|path.json"',
        details: {
          targetFile: 'invalid|path.json',
        },
      },
    ])
  })

  it('handles invalid binding config safely', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()

    const result = adapter.mapEntityToPayload({
      entityType: 'title',
      entity: titleEntity,
      bindings: [{ sourceField: '', targetField: 'headline' }],
    })

    expect(result.payload).toEqual({})
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'invalid-binding',
        message: 'Invalid binding configuration for target field "headline"',
        details: {
          sourceField: '',
          targetField: 'headline',
        },
      },
    ])
  })

  it('surfaces missing required source fields for a configured graphic element', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()

    const result = adapter.mapEntityToPayload({
      entityType: 'person',
      entity: { name: 'Jane Doe' },
      bindings: [
        { sourceField: 'name', targetField: 'name' },
        { sourceField: 'role', targetField: 'role', required: true },
      ],
    })

    expect(result.payload).toEqual({ name: 'Jane Doe' })
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'missing-source-field',
        message: 'Missing required source field "role" for target field "role"',
        details: {
          sourceField: 'role',
          targetField: 'role',
        },
      },
    ])
  })

  it('keeps publish logic modular and independent from UI concerns', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()

    const result = adapter.publishEntity(
      {
        entityType: 'supertitle',
        entity: supertitleEntity,
        targetFile: 'graphics/supertitle.json',
        bindings: [{ sourceField: 'text', targetField: 'strap' }],
      },
      createInMemoryTargetFileWriter(),
    )

    expect(result.payload).toEqual({ strap: 'Top Strap' })
    expect(result).not.toHaveProperty('preview')
    expect(result).not.toHaveProperty('component')
  })

  it('does not include preview reference background config in the JSON publish payload', () => {
    const adapter = createJsonDatasourcePublishTargetAdapter()

    const result = adapter.publishEntity(
      {
        entityType: 'title',
        entity: titleEntity,
        targetFile: 'graphics/title-main.json',
        bindings: [{ sourceField: 'text', targetField: 'headline' }],
      },
      createInMemoryTargetFileWriter(),
    )

    expect(result.payload).toEqual({ headline: 'Main Title' })
    expect(result.payload).not.toHaveProperty('referenceImageId')
    expect(result.payload).not.toHaveProperty('background')
  })
})

function createInMemoryTargetFileWriter(
  initialFiles: Record<string, string> = {},
  invalidPaths: string[] = [],
) {
  const files = new Map(Object.entries(initialFiles))
  const invalidPathSet = new Set(invalidPaths)

  return {
    write(targetFile: string, content: string) {
      if (invalidPathSet.has(targetFile)) {
        throw new Error('invalid path')
      }

      files.set(targetFile, content)
    },
    read(targetFile: string) {
      return files.get(targetFile)
    },
  }
}
