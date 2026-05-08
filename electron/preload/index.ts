import { loadConfig } from '../../config/loadConfig'
import { setupLoadingScreen, type LoadingScreenTimeoutHandle } from './loadingScreen'
import { registerPreloadModuleRegistry } from './registerPreloadModuleRegistry'

registerPreloadModuleRegistry(loadConfig())
setupLoadingScreen({
  document,
  window,
  setTimeout: globalThis.setTimeout,
  clearTimeout: (handle) => globalThis.clearTimeout(handle as LoadingScreenTimeoutHandle),
})
