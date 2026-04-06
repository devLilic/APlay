import type { ActionType } from '@/core/actions/actionTypes'
import type { SupportedEntityType } from '@/core/entities/entityTypes'

export type TransformOrigin = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
export type PreviewElementKind = 'text' | 'box' | 'image'

export interface TextBehaviorConfig {
  allCaps?: boolean
  fitInBox?: boolean
  minScaleX?: number
}

export interface GraphicControlConfig {
  play: string
  stop: string
  resume: string
}

export interface ActionButtonConfig {
  actionType: ActionType
  label: string
}

export interface PreviewElementDefinition {
  id: string
  kind: PreviewElementKind
  sourceField: string
  transformOrigin?: TransformOrigin
  box: {
    x: number
    y: number
    width: number
    height: number
  }
  text?: TextBehaviorConfig
}

export interface PreviewTemplateDefinition {
  id: string
  designWidth: number
  designHeight: number
  elements: PreviewElementDefinition[]
}

// Preview configuration is application-side only. It drives APlay's HTML/CSS
// preview and does not style LiveBoard directly, which only receives data values
// and external trigger commands.
export interface GraphicInstanceConfig {
  id: string
  entityType: SupportedEntityType
  dataFileName: string
  control: GraphicControlConfig
  preview: PreviewTemplateDefinition
  actions: ActionButtonConfig[]
}

// A show/emission profile determines which separately stored graphic configs
// are active for the selected production context.
export interface ShowProfileConfig {
  id: string
  label: string
  graphicConfigIds: string[]
}

export interface AppSettings {
  selectedProfileId: string
  profiles: ShowProfileConfig[]
  graphics: GraphicInstanceConfig[]
}

export type AppConfig = AppSettings
