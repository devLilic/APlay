declare module 'osc' {
  export interface OscMetadataArg {
    type: string
    value: unknown
  }

  export interface OscMessage {
    address: string
    args: OscMetadataArg[]
  }

  export interface UDPPortOptions {
    localAddress: string
    localPort: number
    remoteAddress: string
    remotePort: number
    metadata: boolean
  }

  export class UDPPort {
    constructor(options: UDPPortOptions)
    open(): void
    close(): void
    send(message: OscMessage): void
    on(eventName: string, listener: (...args: unknown[]) => void): this
    off(eventName: string, listener: (...args: unknown[]) => void): this
  }

  const osc: {
    UDPPort: typeof UDPPort
  }

  export default osc
}
