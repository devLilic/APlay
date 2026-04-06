import type { ActionType } from '@/core/actions/actionTypes'
import type { SupportedEntityType } from '@/core/entities/entityTypes'

export type TransformOrigin = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
export type PreviewElementKind = 'text' | 'box' | 'image'
export type PreviewBackgroundFitMode = 'contain' | 'cover'
export type PreviewBackgroundPosition = 'center'

export interface TextBehaviorConfig {
  allCaps?: boolean
  fitInBox?: boolean
  minScaleX?: number
}

export interface ReferenceImageAsset {
  id: string
  name: string
  filePath: string
}

export interface PreviewBackgroundConfig {
  referenceImageId?: string
  opacity?: number
  fitMode?: PreviewBackgroundFitMode
  position?: PreviewBackgroundPosition
}

export interface GraphicFieldBinding {
  sourceField: string
  targetField: string
  required?: boolean
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
  textColor?: string
  backgroundColor?: string
  borderColor?: string
  text?: TextBehaviorConfig
}

export interface PreviewTemplateDefinition {
  id: string
  designWidth: number
  designHeight: number
  background?: PreviewBackgroundConfig
  elements: PreviewElementDefinition[]
}

// Preview configuration is application-side only. It drives APlay's HTML/CSS
// preview and does not style LiveBoard directly, which only receives data values
// and external trigger commands.
export interface GraphicInstanceConfig {
  id: string
  entityType: SupportedEntityType
  dataFileName: string
  datasourcePath?: string
  control: GraphicControlConfig
  bindings?: GraphicFieldBinding[]
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
  referenceImages: ReferenceImageAsset[]
  profiles: ShowProfileConfig[]
  graphics: GraphicInstanceConfig[]
}

export type AppConfig = AppSettings
