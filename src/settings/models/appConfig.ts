import type { ActionType } from '@/core/actions/actionTypes'
import type { SupportedEntityType } from '@/core/entities/entityTypes'

export type TransformOrigin = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
export type PreviewElementKind = 'text' | 'box' | 'image'
export type PreviewBackgroundFitMode = 'contain' | 'cover'
export type PreviewBackgroundPosition = 'center'
export type ContentSourceType = 'csv'
export type PreviewTextAlign = 'left' | 'center'
export type SourceSchemaType = 'csv'
export type CsvBlockDetectionMode = 'columnRegex'
export type OscArgType = 's' | 'i' | 'f'
export type GraphicConfigKind = 'dynamic' | 'static'
export type StaticGraphicAssetType = 'image'

export interface TextBehaviorConfig {
  allCaps?: boolean
  fitInBox?: boolean
  minScaleX?: number
  fontSize?: number
  fontFamily?: string
  textAlign?: PreviewTextAlign
  paddingLeft?: number
  paddingRight?: number
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

export interface StaticGraphicAssetConfig {
  assetPath: string
  assetType: StaticGraphicAssetType
}

export interface OscArgConfig {
  type: OscArgType
  value: string | number
}

export interface OscTargetConfig {
  host: string
  port: number
}

export interface OscCommandConfig {
  address: string
  args: OscArgConfig[]
}

export interface OscCommandSetConfig {
  play: OscCommandConfig
  stop: OscCommandConfig
  resume: OscCommandConfig
}

export interface OscSettingsConfig {
  target: OscTargetConfig
  commands: OscCommandSetConfig
}

export interface GraphicControlConfig {
  templateName?: string
  oscTarget?: OscTargetConfig
  play?: string | OscCommandConfig
  stop?: string | OscCommandConfig
  resume?: string | OscCommandConfig
}

export interface ActionButtonConfig {
  actionType: ActionType
  label: string
}

export interface PreviewElementDefinition {
  id: string
  kind: PreviewElementKind
  sourceField: string
  previewText?: string
  visible?: boolean
  behavior?: TextBehaviorConfig
  transformOrigin?: TransformOrigin
  borderRadius?: number
  box: {
    x: number
    y: number
    width: number
    height: number
  }
  textColor?: string
  backgroundColor?: string
  borderColor?: string
  // Deprecated compatibility alias. New configs should use `behavior`.
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
  kind?: GraphicConfigKind
  dataFileName: string
  datasourcePath?: string
  control: GraphicControlConfig
  bindings?: GraphicFieldBinding[]
  staticAsset?: StaticGraphicAssetConfig
  preview: PreviewTemplateDefinition
  actions: ActionButtonConfig[]
}

export interface CsvBlockDetectionConfig {
  mode: CsvBlockDetectionMode
  sourceColumn: string
  pattern: string
}

export interface CsvEntityTitleMappingConfig {
  enabled: boolean
  fields?: {
    number: string
    title: string
  }
}

export interface CsvEntitySupertitleMappingConfig {
  enabled: boolean
  fields?: {
    text: string
  }
}

export interface CsvEntityPersonMappingConfig {
  enabled: boolean
  fields?: {
    name: string
    role: string
  }
}

export interface CsvEntityValueMappingConfig {
  enabled: boolean
  fields?: {
    value: string
  }
}

export interface CsvEntityPhoneMappingConfig {
  enabled: boolean
  fields?: {
    label: string
    number: string
  }
}

export interface CsvEntityMappingConfig {
  title: CsvEntityTitleMappingConfig
  supertitle: CsvEntitySupertitleMappingConfig
  person: CsvEntityPersonMappingConfig
  location: CsvEntityValueMappingConfig
  breakingNews: CsvEntityValueMappingConfig
  waitingTitle: CsvEntityValueMappingConfig
  waitingLocation: CsvEntityValueMappingConfig
  phone: CsvEntityPhoneMappingConfig
}

export interface CsvSourceSchemaConfig {
  id: string
  name: string
  type: SourceSchemaType
  delimiter: string
  hasHeader: boolean
  blockDetection: CsvBlockDetectionConfig
  entityMappings: CsvEntityMappingConfig
}

export interface ShowProfileSourceConfig {
  type: ContentSourceType
  filePath?: string
  schemaId?: string
}

// A show/emission profile determines which separately stored graphic configs
// are active for the selected production context. Source file selection also
// belongs to the profile so switching shows can swap the working source without
// changing graphic definitions.
export interface ShowProfileConfig {
  id: string
  label: string
  source?: ShowProfileSourceConfig
  graphicConfigIds: string[]
}

export interface AppSettings {
  selectedProfileId: string
  osc?: OscSettingsConfig
  referenceImages: ReferenceImageAsset[]
  sourceSchemas: CsvSourceSchemaConfig[]
  profiles: ShowProfileConfig[]
  graphics: GraphicInstanceConfig[]
}

export type AppConfig = AppSettings
