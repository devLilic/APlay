export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchemaValidationError'
  }
}

export interface Schema<T> {
  parse: (input: unknown) => T
}

export function createSchema<T>(parser: (input: unknown) => T): Schema<T> {
  return {
    parse(input) {
      return parser(input)
    },
  }
}

export function assertRecord(
  input: unknown,
  context: string,
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SchemaValidationError(`${context} must be an object`)
  }

  return input as Record<string, unknown>
}

export function parseRequiredString(
  input: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = input[key]

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SchemaValidationError(`${context}.${key} must be a non-empty string`)
  }

  return value
}

export function parseOptionalString(
  input: Record<string, unknown>,
  key: string,
  context: string,
): string | undefined {
  const value = input[key]

  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SchemaValidationError(`${context}.${key} must be a non-empty string when provided`)
  }

  return value
}

export function parseRequiredNumber(
  input: Record<string, unknown>,
  key: string,
  context: string,
): number {
  const value = input[key]

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new SchemaValidationError(`${context}.${key} must be a number`)
  }

  return value
}

export function parseOptionalBoolean(
  input: Record<string, unknown>,
  key: string,
  context: string,
): boolean | undefined {
  const value = input[key]

  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'boolean') {
    throw new SchemaValidationError(`${context}.${key} must be a boolean when provided`)
  }

  return value
}

export function parseRequiredArray(
  input: Record<string, unknown>,
  key: string,
  context: string,
): unknown[] {
  const value = input[key]

  if (!Array.isArray(value)) {
    throw new SchemaValidationError(`${context}.${key} must be an array`)
  }

  return value
}

export function parseOptionalArray(
  input: Record<string, unknown>,
  key: string,
  context: string,
): unknown[] | undefined {
  const value = input[key]

  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value)) {
    throw new SchemaValidationError(`${context}.${key} must be an array when provided`)
  }

  return value
}

export function parseEnumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  context: string,
  key: string,
): T {
  if (typeof value !== 'string' || !allowedValues.includes(value as T)) {
    throw new SchemaValidationError(
      `${context}.${key} must be one of: ${allowedValues.join(', ')}`,
    )
  }

  return value as T
}
