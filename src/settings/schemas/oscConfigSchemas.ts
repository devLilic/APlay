import type {
  OscArgConfig,
  OscCommandConfig,
  OscTargetConfig,
} from '../models/appConfig'
import {
  SchemaValidationError,
  assertRecord,
  createSchema,
  parseRequiredNumber,
  parseRequiredString,
} from '@/shared/validation/schema'

const oscArgTypes = ['s', 'i', 'f'] as const

export const oscArgConfigSchema = createSchema<OscArgConfig>((input) => {
  const value = assertRecord(input, 'oscArgConfig')
  const type = parseRequiredString(value, 'type', 'oscArgConfig')
  if (!oscArgTypes.includes(type as typeof oscArgTypes[number])) {
    throw new SchemaValidationError('oscArgConfig.type must be one of: s, i, f')
  }

  const rawValue = value.value
  if (type === 's') {
    if (typeof rawValue !== 'string') {
      throw new SchemaValidationError('oscArgConfig.value must be a string when type is s')
    }

    return {
      type: 's',
      value: rawValue,
    }
  }

  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    throw new SchemaValidationError(`oscArgConfig.value must be a finite number when type is ${type}`)
  }

  if (type === 'i' && !Number.isInteger(rawValue)) {
    throw new SchemaValidationError('oscArgConfig.value must be an integer when type is i')
  }

  return {
    type,
    value: rawValue,
  } as OscArgConfig
})

export const oscTargetConfigSchema = createSchema<OscTargetConfig>((input) => {
  const value = assertRecord(input, 'oscTargetConfig')
  const host = parseRequiredString(value, 'host', 'oscTargetConfig').trim()
  const port = parseRequiredNumber(value, 'port', 'oscTargetConfig')

  validateOscHost(host)
  validateOscPort(port)

  return {
    host,
    port,
  }
})

export const oscCommandConfigSchema = createSchema<OscCommandConfig>((input) => {
  const value = assertRecord(input, 'oscCommandConfig')
  const address = parseRequiredString(value, 'address', 'oscCommandConfig').trim()
  validateOscAddress(address)

  const rawArgs = value.args
  if (!Array.isArray(rawArgs)) {
    throw new SchemaValidationError('oscCommandConfig.args must be an array')
  }

  return {
    address,
    args: rawArgs.map((arg) => oscArgConfigSchema.parse(arg)),
  }
})

export function parseGraphicOscCommandConfig(
  input: unknown,
  key: 'play' | 'stop' | 'resume',
): string | OscCommandConfig {
  if (typeof input === 'string') {
    const address = input.trim()
    validateOscAddress(address, `graphicControlConfig.${key}`)
    return address
  }

  return oscCommandConfigSchema.parse(input)
}

export function resolveOscCommandAddress(command: string | OscCommandConfig): string {
  return typeof command === 'string' ? command : command.address
}

export function resolveOscCommandArgs(command: string | OscCommandConfig): OscArgConfig[] {
  return typeof command === 'string' ? [] : command.args
}

export function validateOscAddress(address: string, context = 'oscCommandConfig.address'): void {
  if (!address.startsWith('/') || address.length < 2) {
    throw new SchemaValidationError(`${context} must start with "/"`)
  }
}

export function validateOscHost(host: string, context = 'oscTargetConfig.host'): void {
  if (host.length === 0) {
    throw new SchemaValidationError(`${context} must be a non-empty string`)
  }
}

export function validateOscPort(port: number, context = 'oscTargetConfig.port'): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new SchemaValidationError(`${context} must be an integer between 1 and 65535`)
  }
}
