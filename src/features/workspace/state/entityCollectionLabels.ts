import type { GraphicInstanceConfig } from '@/settings/models/appConfig'

export function formatEntityLabel(entity: unknown): string {
  if (!entity || typeof entity !== 'object') {
    return ''
  }

  if ('title' in entity || 'location' in entity) {
    const title = readStringField(entity, 'title')
    const location = readStringField(entity, 'location')
    return joinNonEmptyParts([title, location])
  }

  if ('text' in entity || 'location' in entity) {
    const text = readStringField(entity, 'text')
    const location = readStringField(entity, 'location')
    return joinNonEmptyParts([text, location])
  }

  if ('name' in entity) {
    const name = readStringField(entity, 'name')
    const role = readStringField(entity, 'role')
    return joinNonEmptyParts([name, role])
  }

  if ('value' in entity) {
    return readStringField(entity, 'value')
  }

  if ('label' in entity || 'number' in entity) {
    const label = readStringField(entity, 'label')
    const number = readStringField(entity, 'number')
    return joinNonEmptyParts([label, number])
  }

  return ''
}

export function formatEntityCollectionLabel(entity: unknown): string {
  if (!entity || typeof entity !== 'object') {
    return ''
  }

  if ('number' in entity && 'text' in entity) {
    const number = readStringField(entity, 'number')
    const text = readStringField(entity, 'text')
    return joinNonEmptyParts([number, text], ' ')
  }

  return formatEntityLabel(entity)
}

export function resolveGraphicCollectionItemDisplay(
  entity: unknown,
  graphic: Pick<GraphicInstanceConfig, 'name' | 'entityType' | 'kind' | 'bindings' | 'collectionDisplay' | 'staticAsset'>,
): { primary: string; secondary?: string } {
  const configuredDisplay = resolveConfiguredGraphicCollectionItemDisplay(entity, graphic)
  if (configuredDisplay) {
    return configuredDisplay
  }

  return resolveFallbackGraphicCollectionItemDisplay(entity, graphic)
}

function readStringField(entity: unknown, field: string): string {
  const value = (entity as Record<string, unknown>)[field]
  return typeof value === 'string' ? value.trim() : ''
}

function joinNonEmptyParts(parts: string[], separator = ' | '): string {
  return parts.filter((part) => part.length > 0).join(separator)
}

function resolveConfiguredDisplayFieldValue(
  entity: unknown,
  graphic: Pick<GraphicInstanceConfig, 'bindings'>,
  sourceField: string | undefined,
): string {
  if (!sourceField || !entity || typeof entity !== 'object' || !isBoundSourceField(graphic, sourceField)) {
    return ''
  }

  return readStringField(entity, sourceField)
}

function resolveConfiguredGraphicCollectionItemDisplay(
  entity: unknown,
  graphic: Pick<GraphicInstanceConfig, 'bindings' | 'collectionDisplay'>,
): { primary: string; secondary?: string } | null {
  const primarySourceField = graphic.collectionDisplay?.primarySourceField
  const secondarySourceField = graphic.collectionDisplay?.secondarySourceField

  if (!primarySourceField && !secondarySourceField) {
    return null
  }

  const explicitPrimary = resolveConfiguredDisplayFieldValue(entity, graphic, primarySourceField)
  const explicitSecondary = resolveConfiguredDisplayFieldValue(entity, graphic, secondarySourceField)
  const primary = explicitPrimary || explicitSecondary
  const secondary = explicitPrimary && explicitSecondary && explicitPrimary !== explicitSecondary
    ? explicitSecondary
    : undefined

  if (!primary) {
    return null
  }

  return {
    primary,
    ...(secondary ? { secondary } : {}),
  }
}

function resolveFallbackGraphicCollectionItemDisplay(
  entity: unknown,
  graphic?: Pick<GraphicInstanceConfig, 'name' | 'kind' | 'entityType' | 'staticAsset'>,
): { primary: string; secondary?: string } {
  if (!entity || typeof entity !== 'object') {
    return {
      primary: isStaticPlayableGraphic(graphic)
        ? graphic?.name ?? ''
        : '',
    }
  }

  if ('number' in entity && 'text' in entity) {
    const number = readStringField(entity, 'number')
    const text = readStringField(entity, 'text')

    return {
      primary: joinNonEmptyParts([number, text], ' '),
    }
  }

  if ('title' in entity || 'location' in entity) {
    const title = readStringField(entity, 'title')
    const location = readStringField(entity, 'location')

    return {
      primary: title || location,
      ...(title && location ? { secondary: location } : {}),
    }
  }

  if ('text' in entity || 'location' in entity) {
    const text = readStringField(entity, 'text')
    const location = readStringField(entity, 'location')

    return {
      primary: text || location,
      ...(text && location ? { secondary: location } : {}),
    }
  }

  if ('name' in entity) {
    const name = readStringField(entity, 'name')
    const role = readStringField(entity, 'role')

    return {
      primary: name || role,
      ...(name && role ? { secondary: role } : {}),
    }
  }

  if ('value' in entity) {
    return {
      primary: readStringField(entity, 'value'),
    }
  }

  if ('label' in entity || 'number' in entity) {
    const label = readStringField(entity, 'label')
    const number = readStringField(entity, 'number')

    return {
      primary: label || number,
      ...(label && number ? { secondary: number } : {}),
    }
  }

  if (isStaticPlayableGraphic(graphic)) {
    const staticLabel = readStringField(entity, 'staticPlayableGraphicName') || graphic?.name || ''

    return {
      primary: staticLabel,
    }
  }

  return {
    primary: formatEntityCollectionLabel(entity),
  }
}

function isBoundSourceField(
  graphic: Pick<GraphicInstanceConfig, 'bindings'>,
  sourceField: string,
): boolean {
  return (graphic.bindings ?? []).some((binding) => binding.sourceField === sourceField)
}

function isStaticPlayableGraphic(
  graphic: Pick<GraphicInstanceConfig, 'kind' | 'entityType' | 'staticAsset'> | undefined,
): boolean {
  return Boolean(
    graphic && (
      graphic.kind === 'static' ||
      graphic.entityType === 'image' ||
      graphic.staticAsset !== undefined
    ),
  )
}
