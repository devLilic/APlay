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

function readStringField(entity: unknown, field: string): string {
  const value = (entity as Record<string, unknown>)[field]
  return typeof value === 'string' ? value.trim() : ''
}

function joinNonEmptyParts(parts: string[], separator = ' | '): string {
  return parts.filter((part) => part.length > 0).join(separator)
}
