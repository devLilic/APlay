import { supportedEntityTypes, type SupportedEntityType } from '@/core/entities/entityTypes'
import type {
  EditorialBlock,
  EditorialDocument,
  GraphicConfigEntityCollections,
  PersonEntity,
  PhoneEntity,
  TextValueEntity,
  TitleEntity,
} from '@/core/models/editorial'
import {
  assertRecord,
  createSchema,
  parseOptionalArray,
  parseOptionalString,
  parseRequiredArray,
  parseRequiredString,
  type Schema,
} from '@/shared/validation/schema'

export const titleEntitySchema = createSchema<TitleEntity>((input) => {
  const value = assertRecord(input, 'titleEntity')
  const number = parseOptionalString(value, 'number', 'titleEntity')

  return {
    id: parseRequiredString(value, 'id', 'titleEntity'),
    ...(number ? { number } : {}),
    text: parseRequiredString(value, 'text', 'titleEntity'),
  }
})

export const personEntitySchema = createSchema<PersonEntity>((input) => {
  const value = assertRecord(input, 'personEntity')
  const role = parseOptionalString(value, 'role', 'personEntity')

  return {
    name: parseRequiredString(value, 'name', 'personEntity'),
    ...(role ? { role } : {}),
  }
})

export const textValueEntitySchema = createSchema<TextValueEntity>((input) => {
  const value = assertRecord(input, 'textValueEntity')

  return {
    value: parseRequiredString(value, 'value', 'textValueEntity'),
  }
})

export const phoneEntitySchema = createSchema<PhoneEntity>((input) => {
  const value = assertRecord(input, 'phoneEntity')

  return {
    label: parseRequiredString(value, 'label', 'phoneEntity'),
    number: parseRequiredString(value, 'number', 'phoneEntity'),
  }
})

function parseCollection<T>(
  input: Record<string, unknown>,
  key: string,
  context: string,
  schema: Schema<T>,
): T[] {
  const values = parseOptionalArray(input, key, context) ?? []
  return values.map((item, index) => schema.parse(withCollectionContext(item, `${context}.${key}[${index}]`)))
}

function withCollectionContext(
  input: unknown,
  context: string,
): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input
  }

  return Object.assign(Object.create(null), input, { __context: context })
}

function stripContext<T extends Record<string, unknown>>(value: T): T {
  if ('__context' in value) {
    const { __context: _ignored, ...rest } = value
    return rest as T
  }

  return value
}

function parseEntityWithContext<T>(
  input: unknown,
  fallbackContext: string,
  parser: (value: Record<string, unknown>, context: string) => T,
): T {
  const record = assertRecord(input, fallbackContext)
  const context = typeof record.__context === 'string' ? record.__context : fallbackContext
  return parser(stripContext(record), context)
}

const titleEntityCollectionSchema = createSchema<TitleEntity>((input) =>
  parseEntityWithContext(input, 'titleEntity', (value, context) => {
    const number = parseOptionalString(value, 'number', context)

    return {
      id: parseRequiredString(value, 'id', context),
      ...(number ? { number } : {}),
      text: parseRequiredString(value, 'text', context),
    }
  }),
)

const personEntityCollectionSchema = createSchema<PersonEntity>((input) =>
  parseEntityWithContext(input, 'personEntity', (value, context) => {
    const role = parseOptionalString(value, 'role', context)

    return {
      name: parseRequiredString(value, 'name', context),
      ...(role ? { role } : {}),
    }
  }),
)

const textValueEntityCollectionSchema = createSchema<TextValueEntity>((input) =>
  parseEntityWithContext(input, 'textValueEntity', (value, context) => ({
    value: parseRequiredString(value, 'value', context),
  })),
)

const phoneEntityCollectionSchema = createSchema<PhoneEntity>((input) =>
  parseEntityWithContext(input, 'phoneEntity', (value, context) => ({
    label: parseRequiredString(value, 'label', context),
    number: parseRequiredString(value, 'number', context),
  })),
)

export const editorialBlockSchema = createSchema<EditorialBlock>((input) => {
  const value = assertRecord(input, 'editorialBlock')

  return {
    name: parseRequiredString(value, 'name', 'editorialBlock'),
    titles: parseCollection(value, 'titles', 'editorialBlock', titleEntityCollectionSchema),
    persons: parseCollection(value, 'persons', 'editorialBlock', personEntityCollectionSchema),
    locations: parseCollection(
      value,
      'locations',
      'editorialBlock',
      textValueEntityCollectionSchema,
    ),
    phones: parseCollection(value, 'phones', 'editorialBlock', phoneEntityCollectionSchema),
    ...(value.entityCollections !== undefined
      ? { entityCollections: parseGraphicConfigEntityCollections(value.entityCollections) }
      : {}),
  }
})

export const editorialDocumentSchema = createSchema<EditorialDocument>((input) => {
  const value = assertRecord(input, 'editorialDocument')
  const blocks = parseRequiredArray(value, 'blocks', 'editorialDocument')

  return {
    blocks: blocks.map((block, index) =>
      editorialBlockSchema.parse(withCollectionContext(block, `editorialDocument.blocks[${index}]`)),
    ),
  }
})

export function isSupportedEntityType(value: string): value is SupportedEntityType {
  return supportedEntityTypes.includes(value as SupportedEntityType)
}

function parseGraphicConfigEntityCollections(input: unknown): GraphicConfigEntityCollections {
  const value = assertRecord(input, 'editorialBlock.entityCollections')

  return Object.fromEntries(
    Object.entries(value).map(([graphicConfigId, items]) => {
      const parsedItems = parseRequiredArray(
        { items },
        'items',
        `editorialBlock.entityCollections.${graphicConfigId}`,
      ).map((item, index) =>
        parseGraphicConfigEntityItem(item, `editorialBlock.entityCollections.${graphicConfigId}[${index}]`))

      return [graphicConfigId, parsedItems]
    }),
  )
}

function parseGraphicConfigEntityItem(
  input: unknown,
  context: string,
): Record<string, string> {
  const value = assertRecord(input, context)

  return Object.fromEntries(
    Object.entries(value).map(([key, itemValue]) => [
      key,
      parseRequiredString(
        { value: itemValue },
        'value',
        `${context}.${key}`,
      ),
    ]),
  )
}
