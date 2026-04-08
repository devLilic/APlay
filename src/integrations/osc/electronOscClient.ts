import type { OscClient, OscClientConfig } from '@/integrations/osc/oscClient'

export function createElectronOscClient(config: OscClientConfig): OscClient {
  return {
    async send(address, args) {
      if (!window.settingsApi?.sendOscMessage) {
        throw new Error('OSC send is unavailable in this environment.')
      }

      await window.settingsApi.sendOscMessage(config.host, config.port, address, args)
    },
  }
}
