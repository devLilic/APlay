export function normalizeCellValue(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export function isBlankLine(value: string): boolean {
  return value.trim().length === 0
}

export function isBlockDelimiter(value: string): boolean {
  return /^---.+---$/.test(value.trim())
}

export function parseBlockName(value: string): string {
  return value.trim().slice(3, -3).trim()
}

export function combineTitleParts(number: string | undefined, title: string | undefined): string | undefined {
  const parts = [number, title].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(' ') : undefined
}
