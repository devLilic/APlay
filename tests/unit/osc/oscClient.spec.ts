import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UDPPortOptions } from 'osc'

const udpPortMock = vi.fn()

vi.mock('osc', () => {
  class MockUdpPort {
    private listeners = new Map<string, ((...args: unknown[]) => void)[]>()

    constructor(options: UDPPortOptions) {
      udpPortMock(options)
    }

    open() {
      for (const listener of this.listeners.get('ready') ?? []) {
        listener()
      }
    }

    close() {
      return undefined
    }

    send() {
      return undefined
    }

    on(eventName: string, listener: (...args: unknown[]) => void) {
      const current = this.listeners.get(eventName) ?? []
      current.push(listener)
      this.listeners.set(eventName, current)
      return this
    }

    off(eventName: string, listener: (...args: unknown[]) => void) {
      this.listeners.set(
        eventName,
        (this.listeners.get(eventName) ?? []).filter((candidate) => candidate !== listener),
      )
      return this
    }
  }

  return {
    UDPPort: MockUdpPort,
  }
})

import {
  createOscClient,
  type OscArg,
  type OscClient,
  type OscClientDependencies,
  type OscPortLike,
} from '@/integrations/osc/oscClient'

describe('OscArg contract', () => {
  it('supports string argument type "s"', () => {
    const arg: OscArg = { type: 's', value: 'play' }

    expect(arg).toEqual({ type: 's', value: 'play' })
  })

  it('supports integer argument type "i"', () => {
    const arg: OscArg = { type: 'i', value: 1 }

    expect(arg).toEqual({ type: 'i', value: 1 })
  })

  it('supports float argument type "f"', () => {
    const arg: OscArg = { type: 'f', value: 0.5 }

    expect(arg).toEqual({ type: 'f', value: 0.5 })
  })
})

describe('OscClient contract', () => {
  beforeEach(() => {
    udpPortMock.mockReset()
  })

  it('exposes send(address, args): Promise<void>', async () => {
    const client = createOscClient(
      { host: '127.0.0.1', port: 9000 },
      createDependenciesWithAutoReady(),
    )

    await expect(client.send('/aplay/play', [])).resolves.toBeUndefined()
  })

  it('preserves outgoing OSC message address and typed args', async () => {
    const sentMessages: Array<{ address: string; args: OscArg[] }> = []
    const client = createOscClient(
      { host: '127.0.0.1', port: 9000 },
      createDependenciesWithAutoReady({
        onSend(message) {
          sentMessages.push(message as { address: string; args: OscArg[] })
        },
      }),
    )
    const args: OscArg[] = [
      { type: 's', value: 'title-main' },
      { type: 'i', value: 1 },
      { type: 'f', value: 0.5 },
    ]

    await client.send('/aplay/play', args)

    expect(sentMessages).toEqual([
      {
        address: '/aplay/play',
        args,
      },
    ])
  })

  it('passes typed args with metadata enabled', async () => {
    let createdOptions: UDPPortOptions | undefined
    let sentArgs: OscArg[] | undefined
    const client = createOscClient(
      { host: '127.0.0.1', port: 9000 },
      createDependenciesWithAutoReady({
        onCreate(options) {
          createdOptions = options
        },
        onSend(message) {
          sentArgs = message.args as OscArg[]
        },
      }),
    )

    await client.send('/aplay/play', [{ type: 's', value: 'title-main' }])

    expect(createdOptions?.metadata).toBe(true)
    expect(sentArgs).toEqual([{ type: 's', value: 'title-main' }])
  })

  it('configures UDPPort with local and remote addresses plus metadata=true', async () => {
    const client = createOscClient({
      host: '192.168.0.10',
      port: 53000,
    })

    await expect(client.send('/aplay/play', [])).resolves.toBeUndefined()

    expect(udpPortMock).toHaveBeenCalledWith({
      localAddress: '0.0.0.0',
      localPort: 0,
      remoteAddress: '192.168.0.10',
      remotePort: 53000,
      metadata: true,
    })
  })

  it('handles invalid host/port configuration safely', () => {
    expect(() => createOscClient({ host: '', port: 9000 })).toThrow('host')
    expect(() => createOscClient({ host: '127.0.0.1', port: 0 })).toThrow('port')
    expect(() => createOscClient({ host: '127.0.0.1', port: 65536 })).toThrow('port')
  })

  it('handles invalid OSC address safely', async () => {
    const client = createOscClient(
      { host: '127.0.0.1', port: 9000 },
      createDependenciesWithAutoReady(),
    )

    expect(() => client.send('play', [])).toThrow('OSC address')
  })

  it('allows an empty args array when a command needs no payload', async () => {
    const sentMessages: Array<{ address: string; args: OscArg[] }> = []
    const client = createOscClient(
      { host: '127.0.0.1', port: 9000 },
      createDependenciesWithAutoReady({
        onSend(message) {
          sentMessages.push(message as { address: string; args: OscArg[] })
        },
      }),
    )

    await expect(client.send('/aplay/stop', [])).resolves.toBeUndefined()
    expect(sentMessages).toEqual([{ address: '/aplay/stop', args: [] }])
  })

  it('does not allow raw untyped string args through the API', async () => {
    const client = createOscClient(
      { host: '127.0.0.1', port: 9000 },
      createDependenciesWithAutoReady(),
    )

    expect(() =>
      client.send('/aplay/play', ['title-main'] as unknown as OscArg[]),
    ).toThrow('type metadata')
  })

  it('opens the UDP port before sending', async () => {
    const sequence: string[] = []
    const client = createOscClient(
      { host: '127.0.0.1', port: 9000 },
      createDependenciesWithAutoReady({
        onOpen() {
          sequence.push('open')
        },
        onSend() {
          sequence.push('send')
        },
      }),
    )

    await client.send('/aplay/play', [])

    expect(sequence).toEqual(['open', 'send'])
  })

  it('resolves after the ready/send sequence completes', async () => {
    let readyListener: (() => void) | undefined
    let resolved = false
    const client = createOscClient(
      { host: '127.0.0.1', port: 9000 },
      createDependencies({
        createPort() {
          return createFakePort({
            on(eventName, listener) {
              if (eventName === 'ready') {
                readyListener = listener as () => void
              }
            },
          })
        },
      }),
    )

    const promise = client.send('/aplay/play', []).then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toBe(false)

    readyListener?.()
    await promise

    expect(resolved).toBe(true)
  })

  it('logs debug output before send', async () => {
    const sequence: string[] = []
    const log = vi.fn(() => {
      sequence.push('log')
    })
    const client = createOscClient(
      { host: '127.0.0.1', port: 9000 },
      createDependenciesWithAutoReady({
        log,
        onSend() {
          sequence.push('send')
        },
      }),
    )
    const args: OscArg[] = [{ type: 's', value: 'title-main' }]

    await client.send('/aplay/play', args)

    expect(log).toHaveBeenCalledWith('OSC SEND', '/aplay/play', args)
    expect(sequence).toEqual(['log', 'send'])
  })

  it('does not perform retry logic', async () => {
    let openCount = 0
    let sendCount = 0
    const client = createOscClient(
      { host: '127.0.0.1', port: 9000 },
      createDependenciesWithAutoReady({
        onOpen() {
          openCount += 1
        },
        onSend() {
          sendCount += 1
          throw new Error('send failed')
        },
      }),
    )

    await expect(client.send('/aplay/play', [])).rejects.toThrow('send failed')
    expect(openCount).toBe(1)
    expect(sendCount).toBe(1)
  })

  it('preserves simple fire-and-forget sender behavior', async () => {
    let closeCount = 0
    const client = createOscClient(
      { host: '127.0.0.1', port: 9000 },
      createDependenciesWithAutoReady({
        onClose() {
          closeCount += 1
        },
      }),
    )

    await expect(client.send('/aplay/resume', [])).resolves.toBeUndefined()
    expect(closeCount).toBe(1)
  })

  it('does not require any UI layer for these tests', () => {
    expect(typeof window).toBe('undefined')
  })
})

function createDependenciesWithAutoReady(options: {
  log?: typeof console.log
  onCreate?: (options: UDPPortOptions) => void
  onOpen?: () => void
  onSend?: (message: { address: string; args: OscArg[] }) => void
  onClose?: () => void
} = {}): OscClientDependencies {
  return createDependencies({
    log: options.log,
    createPort(portOptions) {
      options.onCreate?.(portOptions)
      const listeners = new Map<string, ((...args: unknown[]) => void)[]>()

      return createFakePort({
        open() {
          options.onOpen?.()
          emit(listeners, 'ready')
        },
        send(message) {
          options.onSend?.(message as { address: string; args: OscArg[] })
        },
        close() {
          options.onClose?.()
        },
        on(eventName, listener) {
          const current = listeners.get(eventName) ?? []
          current.push(listener)
          listeners.set(eventName, current)
        },
        off(eventName, listener) {
          listeners.set(
            eventName,
            (listeners.get(eventName) ?? []).filter((candidate) => candidate !== listener),
          )
        },
      })
    },
  })
}

function createDependencies(options: {
  createPort: (options: UDPPortOptions) => OscPortLike
  log?: typeof console.log
}): OscClientDependencies {
  return {
    createPort: options.createPort,
    log: options.log ?? vi.fn(),
  }
}

function createFakePort(handlers: {
  open?: () => void
  close?: () => void
  send?: (message: { address: string; args: OscArg[] }) => void
  on?: (eventName: string, listener: (...args: unknown[]) => void) => void
  off?: (eventName: string, listener: (...args: unknown[]) => void) => void
} = {}): OscPortLike {
  return {
    open() {
      handlers.open?.()
    },
    close() {
      handlers.close?.()
    },
    send(message) {
      handlers.send?.(message as { address: string; args: OscArg[] })
    },
    on(eventName, listener) {
      handlers.on?.(eventName, listener)
      return this
    },
    off(eventName, listener) {
      handlers.off?.(eventName, listener)
      return this
    },
  }
}

function emit(
  listeners: Map<string, ((...args: unknown[]) => void)[]>,
  eventName: string,
  ...args: unknown[]
) {
  for (const listener of listeners.get(eventName) ?? []) {
    listener(...args)
  }
}
