import type { AppConfig } from '../../../config/types'
import { resolveRendererModules } from '@/shared/modules/registry'

export function registerRendererModuleRegistry(config: AppConfig) {
  return resolveRendererModules([], config)
}
