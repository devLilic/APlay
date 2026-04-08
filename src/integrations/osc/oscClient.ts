import osc, { type OscMessage, type UDPPortOptions } from 'osc'

export interface OscArg {
  type: 's' | 'i' | 'f'
  value: string | number
}

export type OscTransportStage = 'opened' | 'ready' | 'sent' | 'error'

export interface OscClient {
  send(address: string, args: OscArg[]): Promise<OscTransportStage[]>
}

export interface OscClientConfig {
  host: string
  port: number
}

export interface OscPortLike {
  open: () => void
  close: () => void
  send: (message: OscMessage) => void
  on: (eventName: string, listener: (...args: unknown[]) => void) => OscPortLike
  off?: (eventName: string, listener: (...args: unknown[]) => void) => OscPortLike
}

export type OscPortFactory = (options: UDPPortOptions) => OscPortLike

export interface OscClientDependencies {
  createPort: OscPortFactory
  log: typeof console.log
}

export class OscTransportError extends Error {
  readonly stages: OscTransportStage[]

  constructor(message: string, stages: OscTransportStage[]) {
    super(message)
    this.name = 'OscTransportError'
    this.stages = stages
  }
}

const defaultDependencies: OscClientDependencies = {
  createPort(options) {
    const { UDPPort } = osc
    return new UDPPort(options)
  },
  log: console.log.bind(console),
}

export function createOscClient(
  config: OscClientConfig,
  dependencies: OscClientDependencies = defaultDependencies,
): OscClient {
  const normalizedConfig = validateOscClientConfig(config)

  return {
    send(address: string, args: OscArg[]): Promise<OscTransportStage[]> {
      const normalizedAddress = validateOscAddress(address)
      const normalizedArgs = validateOscArgs(args)

      dependencies.log('OSC SEND', {
        address: normalizedAddress,
        args: normalizedArgs,
        host: normalizedConfig.host,
        port: normalizedConfig.port,
      })

      const port = dependencies.createPort({
        localAddress: '0.0.0.0',
        localPort: 0,
        remoteAddress: normalizedConfig.host,
        remotePort: normalizedConfig.port,
        metadata: true,
      })

      return new Promise<OscTransportStage[]>((resolve, reject) => {
        let settled = false
        const stages: OscTransportStage[] = []

        const cleanup = () => {
          if (typeof port.off === 'function') {
            port.off('ready', handleReady)
            port.off('error', handleError)
          }
        }

        const finalizeResolve = () => {
          if (settled) {
            return
          }

          settled = true
          cleanup()
          queueMicrotask(() => safelyClosePort(port))
          resolve([...stages])
        }

        const finalizeReject = (error: unknown) => {
          if (settled) {
            return
          }

          settled = true
          cleanup()
          queueMicrotask(() => safelyClosePort(port))
          const message = error instanceof Error ? error.message : 'OSC send failed'
          reject(new OscTransportError(message, [...stages]))
        }

        const handleReady = () => {
          stages.push('ready')
          dependencies.log('OSC READY', {
            address: normalizedAddress,
            args: normalizedArgs,
            host: normalizedConfig.host,
            port: normalizedConfig.port,
          })

          try {
            port.send({
              address: normalizedAddress,
              args: normalizedArgs,
            })
            stages.push('sent')
            dependencies.log('OSC SENT', {
              address: normalizedAddress,
              args: normalizedArgs,
              host: normalizedConfig.host,
              port: normalizedConfig.port,
            })
            finalizeResolve()
          } catch (error) {
            stages.push('error')
            dependencies.log('OSC ERROR', {
              address: normalizedAddress,
              args: normalizedArgs,
              host: normalizedConfig.host,
              port: normalizedConfig.port,
              error: error instanceof Error ? error.message : 'OSC send failed',
              stages: [...stages],
            })
            finalizeReject(error)
          }
        }

        const handleError = (error: unknown) => {
          stages.push('error')
          dependencies.log('OSC ERROR', {
            address: normalizedAddress,
            args: normalizedArgs,
            host: normalizedConfig.host,
            port: normalizedConfig.port,
            error: error instanceof Error ? error.message : 'OSC port error',
            stages: [...stages],
          })
          finalizeReject(error instanceof Error ? error : new Error('OSC port error'))
        }

        port.on('ready', handleReady)
        port.on('error', handleError)

        try {
          stages.push('opened')
          dependencies.log('OSC OPEN', {
            address: normalizedAddress,
            args: normalizedArgs,
            host: normalizedConfig.host,
            port: normalizedConfig.port,
          })
          port.open()
        } catch (error) {
          stages.push('error')
          dependencies.log('OSC ERROR', {
            address: normalizedAddress,
            args: normalizedArgs,
            host: normalizedConfig.host,
            port: normalizedConfig.port,
            error: error instanceof Error ? error.message : 'OSC open failed',
            stages: [...stages],
          })
          finalizeReject(error)
        }
      })
    },
  }
}

function validateOscClientConfig(config: OscClientConfig): OscClientConfig {
  const host = config.host.trim()
  if (host.length === 0) {
    throw new Error('OSC host must be a non-empty string')
  }

  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    throw new Error('OSC port must be an integer between 1 and 65535')
  }

  return {
    host,
    port: config.port,
  }
}

function validateOscAddress(address: string): string {
  const normalized = address.trim()
  if (!normalized.startsWith('/') || normalized.length < 2) {
    throw new Error('OSC address must start with "/"')
  }

  return normalized
}

function validateOscArgs(args: OscArg[]): OscArg[] {
  if (!Array.isArray(args)) {
    throw new Error('OSC args must be an array')
  }

  return args.map((arg, index) => {
    if (!arg || typeof arg !== 'object' || Array.isArray(arg)) {
      throw new Error(`OSC arg at index ${index} must be an object with type metadata`)
    }

    if (arg.type !== 's' && arg.type !== 'i' && arg.type !== 'f') {
      throw new Error(`OSC arg at index ${index} must use type "s", "i", or "f"`)
    }

    if (arg.type === 's') {
      if (typeof arg.value !== 'string') {
        throw new Error(`OSC string arg at index ${index} must use a string value`)
      }
      return { type: arg.type, value: arg.value }
    }

    if (typeof arg.value !== 'number' || !Number.isFinite(arg.value)) {
      throw new Error(`OSC numeric arg at index ${index} must use a finite number value`)
    }

    if (arg.type === 'i' && !Number.isInteger(arg.value)) {
      throw new Error(`OSC integer arg at index ${index} must use an integer value`)
    }

    return { type: arg.type, value: arg.value }
  })
}

function safelyClosePort(port: OscPortLike): void {
  try {
    port.close()
  } catch {
    // Preserve fire-and-forget behavior even if the transport close step fails.
  }
}
