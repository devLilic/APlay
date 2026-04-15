import { actionTypes, type ActionType } from '@/core/actions/actionTypes'
import { supportedEntityTypes } from '@/core/entities/entityTypes'
import type {
  ActionButtonConfig,
  AppConfig,
  AppSettings,
  CsvBlockDetectionConfig,
  CsvEntityMappingConfig,
  CsvSourceSchemaConfig,
  GraphicFieldBinding,
  GraphicControlConfig,
  GraphicConfigKind,
  GraphicOnAirConfig,
  GraphicInstanceConfig,
  OscCommandSetConfig,
  OscSettingsConfig,
  OscCommandConfig,
  OscTargetConfig,
  PreviewBackgroundConfig,
  ShowProfileSourceConfig,
  PreviewElementDefinition,
  PreviewElementKind,
  PreviewTemplateDefinition,
  ReferenceImageAsset,
  ShowProfileConfig,
  StaticGraphicAssetConfig,
  StaticGraphicAssetType,
  TransformOrigin,
} from '@/settings/models/appConfig'
import {
  oscArgConfigSchema,
  oscCommandConfigSchema,
  oscTargetConfigSchema,
  parseGraphicOscCommandConfig,
} from '@/settings/schemas/oscConfigSchemas'
import {
  SchemaValidationError,
  assertRecord,
  createSchema,
  parseEnumValue,
  parseOptionalBoolean,
  parseOptionalString,
  parseRequiredArray,
  parseRequiredNumber,
  parseRequiredString,
} from '@/shared/validation/schema'

const transformOrigins = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'center',
] as const

const previewElementKinds = ['text', 'box', 'image'] as const
const previewBackgroundFitModes = ['contain', 'cover'] as const
const previewBackgroundPositions = ['center'] as const
const contentSourceTypes = ['csv'] as const
const sourceSchemaTypes = ['csv'] as const
const csvBlockDetectionModes = ['columnRegex'] as const
const previewTextAlignValues = ['left', 'center'] as const
const graphicConfigKinds = ['dynamic', 'static'] as const
const staticGraphicAssetTypes = ['image'] as const
const staticGraphicEntityTypes = ['image', 'staticImage'] as const
const graphicOnAirModes = ['manual', 'autoHide'] as const

export const referenceImageAssetSchema = createSchema<ReferenceImageAsset>((input) => {
  const value = assertRecord(input, 'referenceImageAsset')
  const filePath = parseRequiredString(value, 'filePath', 'referenceImageAsset')

  if (!isSafeReferenceImagePath(filePath)) {
    throw new SchemaValidationError('referenceImageAsset.filePath must be a valid non-empty file path')
  }

  return {
    id: parseRequiredString(value, 'id', 'referenceImageAsset'),
    name: parseRequiredString(value, 'name', 'referenceImageAsset'),
    filePath,
  }
})

export const previewBackgroundConfigSchema = createSchema<PreviewBackgroundConfig>((input) => {
  const value = input === undefined ? {} : assertRecord(input, 'previewBackgroundConfig')
  const opacity = value.opacity === undefined
    ? 1
    : parseRequiredNumber(value, 'opacity', 'previewBackgroundConfig')

  if (opacity < 0 || opacity > 1) {
    throw new SchemaValidationError('previewBackgroundConfig.opacity must be between 0 and 1')
  }

  return {
    ...(parseOptionalString(value, 'referenceImageId', 'previewBackgroundConfig')
      ? { referenceImageId: parseOptionalString(value, 'referenceImageId', 'previewBackgroundConfig') }
      : {}),
    opacity,
    fitMode: value.fitMode === undefined
      ? 'contain'
      : parseEnumValue(
        value.fitMode,
        previewBackgroundFitModes,
        'previewBackgroundConfig',
        'fitMode',
      ),
    position: value.position === undefined
      ? 'center'
      : parseEnumValue(
        value.position,
        previewBackgroundPositions,
        'previewBackgroundConfig',
        'position',
      ),
  }
})

export const graphicControlConfigSchema = createSchema<GraphicControlConfig>((input) => {
  const value = assertRecord(input, 'graphicControlConfig')

  return {
    ...(parseOptionalString(value, 'templateName', 'graphicControlConfig')
      ? { templateName: parseOptionalString(value, 'templateName', 'graphicControlConfig') }
      : {}),
    ...(value.oscTarget !== undefined
      ? { oscTarget: oscTargetConfigSchema.parse(value.oscTarget) as OscTargetConfig }
      : {}),
    ...(value.play !== undefined
      ? { play: parseGraphicOscCommandConfig(value.play, 'play') as string | OscCommandConfig }
      : {}),
    ...(value.stop !== undefined
      ? { stop: parseGraphicOscCommandConfig(value.stop, 'stop') as string | OscCommandConfig }
      : {}),
    ...(value.resume !== undefined
      ? { resume: parseGraphicOscCommandConfig(value.resume, 'resume') as string | OscCommandConfig }
      : {}),
  }
})

export const oscCommandSetConfigSchema = createSchema<OscCommandSetConfig>((input) => {
  const value = assertRecord(input, 'oscSettings.commands')
  if (value.play === undefined) {
    throw new SchemaValidationError('oscSettings.commands.play is required')
  }
  if (value.stop === undefined) {
    throw new SchemaValidationError('oscSettings.commands.stop is required')
  }
  if (value.resume === undefined) {
    throw new SchemaValidationError('oscSettings.commands.resume is required')
  }

  return {
    play: oscCommandConfigSchema.parse(value.play),
    stop: oscCommandConfigSchema.parse(value.stop),
    resume: oscCommandConfigSchema.parse(value.resume),
    stopall: value.stopall === undefined
      ? {
        address: '/liveboard/stopall',
        args: [],
      }
      : oscCommandConfigSchema.parse(value.stopall),
  }
})

export const graphicOnAirConfigSchema = createSchema<GraphicOnAirConfig>((input) => {
  const value = input === undefined ? {} : assertRecord(input, 'graphicInstanceConfig.onAir')
  const mode = value.mode === undefined
    ? 'manual'
    : parseEnumValue(
      value.mode,
      graphicOnAirModes,
      'graphicInstanceConfig.onAir',
      'mode',
    )

  if (mode === 'manual') {
    return {
      mode: 'manual',
    }
  }

  const durationSeconds = parseRequiredNumber(value, 'durationSeconds', 'graphicInstanceConfig.onAir')
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new SchemaValidationError('graphicInstanceConfig.onAir.durationSeconds must be a positive number')
  }

  return {
    mode: 'autoHide',
    durationSeconds,
  }
})

export const oscSettingsConfigSchema = createSchema<OscSettingsConfig>((input) => {
  const value = assertRecord(input, 'oscSettings')

  return {
    target: oscTargetConfigSchema.parse(value.target),
    commands: oscCommandSetConfigSchema.parse(value.commands),
  }
})

export const actionButtonConfigSchema = createSchema<ActionButtonConfig>((input) => {
  const value = assertRecord(input, 'actionButtonConfig')

  return {
    actionType: parseEnumValue(
      value.actionType,
      Object.values(actionTypes),
      'actionButtonConfig',
      'actionType',
    ),
    label: parseRequiredString(value, 'label', 'actionButtonConfig'),
  }
})

export const previewElementDefinitionSchema = createSchema<PreviewElementDefinition>((input) => {
  const value = assertRecord(input, 'previewElementDefinition')
  const box = assertRecord(value.box, 'previewElementDefinition.box')
  const behaviorSettings = value.behavior === undefined
    ? (value.text === undefined ? undefined : assertRecord(value.text, 'previewElementDefinition.text'))
    : assertRecord(value.behavior, 'previewElementDefinition.behavior')
  const legacyTextSettings = value.text === undefined
    ? undefined
    : assertRecord(value.text, 'previewElementDefinition.text')
  const parsedBehavior = behaviorSettings
    ? {
      ...(parseOptionalBoolean(behaviorSettings, 'allCaps', 'previewElementDefinition.behavior') !== undefined
        ? { allCaps: parseOptionalBoolean(behaviorSettings, 'allCaps', 'previewElementDefinition.behavior') }
        : {}),
      ...(parseOptionalBoolean(behaviorSettings, 'fitInBox', 'previewElementDefinition.behavior') !== undefined
        ? { fitInBox: parseOptionalBoolean(behaviorSettings, 'fitInBox', 'previewElementDefinition.behavior') }
        : {}),
      ...(behaviorSettings.minScaleX !== undefined
        ? { minScaleX: parseRequiredNumber(behaviorSettings, 'minScaleX', 'previewElementDefinition.behavior') }
        : {}),
      ...(behaviorSettings.fontSize !== undefined
        ? { fontSize: parseRequiredNumber(behaviorSettings, 'fontSize', 'previewElementDefinition.behavior') }
        : {}),
      ...(parseOptionalString(behaviorSettings, 'fontFamily', 'previewElementDefinition.behavior')
        ? { fontFamily: parseOptionalString(behaviorSettings, 'fontFamily', 'previewElementDefinition.behavior') }
        : {}),
      ...(behaviorSettings.textAlign !== undefined
        ? {
          textAlign: parseEnumValue(
            behaviorSettings.textAlign,
            previewTextAlignValues,
            'previewElementDefinition.behavior',
            'textAlign',
          ),
        }
        : {}),
      ...(behaviorSettings.paddingLeft !== undefined
        ? { paddingLeft: parseRequiredNumber(behaviorSettings, 'paddingLeft', 'previewElementDefinition.behavior') }
        : {}),
      ...(behaviorSettings.paddingRight !== undefined
        ? { paddingRight: parseRequiredNumber(behaviorSettings, 'paddingRight', 'previewElementDefinition.behavior') }
        : {}),
    }
    : undefined

  return {
    id: parseRequiredString(value, 'id', 'previewElementDefinition'),
    kind: parseEnumValue(
      value.kind,
      previewElementKinds,
      'previewElementDefinition',
      'kind',
    ),
    sourceField: parseRequiredString(value, 'sourceField', 'previewElementDefinition'),
    ...(parseOptionalString(value, 'previewText', 'previewElementDefinition')
      ? { previewText: parseOptionalString(value, 'previewText', 'previewElementDefinition') }
      : {}),
    ...(parseOptionalBoolean(value, 'visible', 'previewElementDefinition') !== undefined
      ? { visible: parseOptionalBoolean(value, 'visible', 'previewElementDefinition') }
      : {}),
    transformOrigin: value.transformOrigin === undefined
      ? 'top-left'
      : parseEnumValue(
        value.transformOrigin,
        transformOrigins,
        'previewElementDefinition',
        'transformOrigin',
      ),
    ...(value.borderRadius !== undefined
      ? { borderRadius: parseRequiredNumber(value, 'borderRadius', 'previewElementDefinition') }
      : {}),
    box: {
      x: parseRequiredNumber(box, 'x', 'previewElementDefinition.box'),
      y: parseRequiredNumber(box, 'y', 'previewElementDefinition.box'),
      width: parseRequiredNumber(box, 'width', 'previewElementDefinition.box'),
      height: parseRequiredNumber(box, 'height', 'previewElementDefinition.box'),
    },
    ...(parseOptionalString(value, 'textColor', 'previewElementDefinition')
      ? { textColor: parseOptionalString(value, 'textColor', 'previewElementDefinition') }
      : {}),
    ...(parseOptionalString(value, 'backgroundColor', 'previewElementDefinition')
      ? { backgroundColor: parseOptionalString(value, 'backgroundColor', 'previewElementDefinition') }
      : {}),
    ...(parseOptionalString(value, 'borderColor', 'previewElementDefinition')
      ? { borderColor: parseOptionalString(value, 'borderColor', 'previewElementDefinition') }
      : {}),
    ...(parsedBehavior
      ? {
        behavior: parsedBehavior,
      }
      : {}),
    ...(legacyTextSettings
      ? {
        text: {
          ...(parseOptionalBoolean(legacyTextSettings, 'allCaps', 'previewElementDefinition.text') !== undefined
            ? { allCaps: parseOptionalBoolean(legacyTextSettings, 'allCaps', 'previewElementDefinition.text') }
            : {}),
          ...(parseOptionalBoolean(legacyTextSettings, 'fitInBox', 'previewElementDefinition.text') !== undefined
            ? { fitInBox: parseOptionalBoolean(legacyTextSettings, 'fitInBox', 'previewElementDefinition.text') }
            : {}),
          ...(legacyTextSettings.minScaleX !== undefined
            ? { minScaleX: parseRequiredNumber(legacyTextSettings, 'minScaleX', 'previewElementDefinition.text') }
            : {}),
          ...(legacyTextSettings.fontSize !== undefined
            ? { fontSize: parseRequiredNumber(legacyTextSettings, 'fontSize', 'previewElementDefinition.text') }
            : {}),
          ...(parseOptionalString(legacyTextSettings, 'fontFamily', 'previewElementDefinition.text')
            ? { fontFamily: parseOptionalString(legacyTextSettings, 'fontFamily', 'previewElementDefinition.text') }
            : {}),
          ...(legacyTextSettings.textAlign !== undefined
            ? {
              textAlign: parseEnumValue(
                legacyTextSettings.textAlign,
                previewTextAlignValues,
                'previewElementDefinition.text',
                'textAlign',
              ),
            }
            : {}),
          ...(legacyTextSettings.paddingLeft !== undefined
            ? { paddingLeft: parseRequiredNumber(legacyTextSettings, 'paddingLeft', 'previewElementDefinition.text') }
            : {}),
          ...(legacyTextSettings.paddingRight !== undefined
            ? { paddingRight: parseRequiredNumber(legacyTextSettings, 'paddingRight', 'previewElementDefinition.text') }
            : {}),
        },
      }
      : {}),
  }
})

export const graphicFieldBindingSchema = createSchema<GraphicFieldBinding>((input) => {
  const value = assertRecord(input, 'graphicFieldBinding')

  return {
    sourceField: parseRequiredString(value, 'sourceField', 'graphicFieldBinding'),
    targetField: parseRequiredString(value, 'targetField', 'graphicFieldBinding'),
    ...(parseOptionalBoolean(value, 'required', 'graphicFieldBinding') !== undefined
      ? { required: parseOptionalBoolean(value, 'required', 'graphicFieldBinding') }
      : {}),
  }
})

export const staticGraphicAssetConfigSchema = createSchema<StaticGraphicAssetConfig>((input) => {
  const value = assertRecord(input, 'graphicInstanceConfig.staticAsset')
  const assetPath = parseRequiredString(value, 'assetPath', 'graphicInstanceConfig.staticAsset')

  if (!isSafeStaticAssetPath(assetPath)) {
    throw new SchemaValidationError('graphicInstanceConfig.staticAsset.assetPath must be a valid non-empty file path')
  }

  return {
    assetPath,
    assetType: parseEnumValue(
      value.assetType,
      staticGraphicAssetTypes,
      'graphicInstanceConfig.staticAsset',
      'assetType',
    ) as StaticGraphicAssetType,
  }
})

export const csvBlockDetectionConfigSchema = createSchema<CsvBlockDetectionConfig>((input) => {
  const value = assertRecord(input, 'csvBlockDetectionConfig')
  const pattern = parseRequiredString(value, 'pattern', 'csvBlockDetectionConfig')

  try {
    // Validate once so malformed patterns fail early in settings, not at parse time.
    new RegExp(pattern)
  } catch {
    throw new SchemaValidationError('csvBlockDetectionConfig.pattern must be a valid regex')
  }

  return {
    mode: parseEnumValue(
      value.mode,
      csvBlockDetectionModes,
      'csvBlockDetectionConfig',
      'mode',
    ),
    sourceColumn: parseRequiredString(value, 'sourceColumn', 'csvBlockDetectionConfig'),
    pattern,
  }
})

export const csvEntityMappingConfigSchema = createSchema<CsvEntityMappingConfig>((input) => {
  const value = assertRecord(input, 'csvEntityMappingConfig')

  return {
    title: parseTitleMapping(assertRecord(value.title, 'csvEntityMappingConfig.title')),
    person: parsePersonMapping(assertRecord(value.person, 'csvEntityMappingConfig.person')),
    location: parseValueMapping(assertRecord(value.location, 'csvEntityMappingConfig.location'), 'location'),
    phone: parsePhoneMapping(assertRecord(value.phone, 'csvEntityMappingConfig.phone')),
  }
})

export const csvSourceSchemaConfigSchema = createSchema<CsvSourceSchemaConfig>((input) => {
  const value = assertRecord(input, 'csvSourceSchemaConfig')
  const delimiter = parseRequiredString(value, 'delimiter', 'csvSourceSchemaConfig')
  if (delimiter.trim().length === 0) {
    throw new SchemaValidationError('csvSourceSchemaConfig.delimiter must be a non-empty string')
  }

  return {
    id: parseRequiredString(value, 'id', 'csvSourceSchemaConfig'),
    name: parseRequiredString(value, 'name', 'csvSourceSchemaConfig'),
    type: parseEnumValue(
      value.type,
      sourceSchemaTypes,
      'csvSourceSchemaConfig',
      'type',
    ),
    delimiter,
    hasHeader: parseOptionalBoolean(value, 'hasHeader', 'csvSourceSchemaConfig') ?? false,
    blockDetection: csvBlockDetectionConfigSchema.parse(value.blockDetection),
    entityMappings: csvEntityMappingConfigSchema.parse(value.entityMappings),
  }
})

export const previewTemplateDefinitionSchema = createSchema<PreviewTemplateDefinition>((input) => {
  const value = assertRecord(input, 'previewTemplateDefinition')
  const elements = parseRequiredArray(value, 'elements', 'previewTemplateDefinition').map(
    (element) => previewElementDefinitionSchema.parse(element),
  )

  if (elements.length === 0) {
    throw new SchemaValidationError('previewTemplateDefinition.elements must not be empty')
  }

  return {
    id: parseRequiredString(value, 'id', 'previewTemplateDefinition'),
    designWidth: parseRequiredNumber(value, 'designWidth', 'previewTemplateDefinition'),
    designHeight: parseRequiredNumber(value, 'designHeight', 'previewTemplateDefinition'),
    ...(value.background !== undefined
      ? { background: previewBackgroundConfigSchema.parse(value.background) }
      : {}),
    elements,
  }
})

export const graphicInstanceConfigSchema = createSchema<GraphicInstanceConfig>((input) => {
  const value = assertRecord(input, 'graphicInstanceConfig')
  const actions = parseRequiredArray(value, 'actions', 'graphicInstanceConfig').map((action) =>
    actionButtonConfigSchema.parse(action),
  )
  const normalizedEntityType = value.entityType === 'staticImage'
    ? 'image'
    : value.entityType
  const entityType = parseEnumValue(
    normalizedEntityType,
    supportedEntityTypes,
    'graphicInstanceConfig',
    'entityType',
  )
  const inferredKind = isStaticGraphicEntityType(entityType) ? 'static' : undefined
  const kind = value.kind === undefined
    ? inferredKind
    : parseEnumValue(
      value.kind,
      graphicConfigKinds,
      'graphicInstanceConfig',
      'kind',
    ) as GraphicConfigKind
  const bindings = value.bindings === undefined
    ? undefined
    : parseRequiredArray(value, 'bindings', 'graphicInstanceConfig').map((binding) =>
      graphicFieldBindingSchema.parse(binding),
    )
  const staticAsset = value.staticAsset === undefined
    ? undefined
    : staticGraphicAssetConfigSchema.parse(value.staticAsset)
  const name = parseRequiredString(value, 'name', 'graphicInstanceConfig').trim()

  if (name.length === 0) {
    throw new SchemaValidationError('graphicInstanceConfig.name must be a non-empty string')
  }

  if (kind === 'static' && !staticAsset) {
    throw new SchemaValidationError('graphicInstanceConfig.staticAsset is required for static graphic configs')
  }

  return {
    id: parseRequiredString(value, 'id', 'graphicInstanceConfig'),
    name,
    ...(value.zIndex !== undefined
      ? { zIndex: parseRequiredNumber(value, 'zIndex', 'graphicInstanceConfig') }
      : {}),
    entityType,
    ...(kind ? { kind } : {}),
    dataFileName: parseRequiredString(value, 'dataFileName', 'graphicInstanceConfig'),
    ...(parseOptionalString(value, 'datasourcePath', 'graphicInstanceConfig')
      ? { datasourcePath: parseOptionalString(value, 'datasourcePath', 'graphicInstanceConfig') }
      : {}),
    control: graphicControlConfigSchema.parse(value.control),
    onAir: graphicOnAirConfigSchema.parse(value.onAir),
    ...(bindings ? { bindings } : {}),
    ...(staticAsset ? { staticAsset } : {}),
    preview: previewTemplateDefinitionSchema.parse(value.preview),
    actions,
  }
})

export const showProfileSourceConfigSchema = createSchema<ShowProfileSourceConfig>((input) => {
  const value = assertRecord(input, 'showProfileConfig.source')
  const filePath = parseOptionalString(value, 'filePath', 'showProfileConfig.source')
  const schemaId = parseOptionalString(value, 'schemaId', 'showProfileConfig.source')

  if (filePath && !isSafeContentSourcePath(filePath)) {
    throw new SchemaValidationError('showProfileConfig.source.filePath must be a valid non-empty file path when provided')
  }

  return {
    type: parseEnumValue(
      value.type,
      contentSourceTypes,
      'showProfileConfig.source',
      'type',
    ),
    ...(filePath ? { filePath } : {}),
    ...(schemaId ? { schemaId } : {}),
  }
})

export const showProfileConfigSchema = createSchema<ShowProfileConfig>((input) => {
  const value = assertRecord(input, 'showProfileConfig')
  const graphicConfigIds = parseRequiredArray(value, 'graphicConfigIds', 'showProfileConfig').map(
    (item, index) => {
      if (typeof item !== 'string' || item.trim().length === 0) {
        throw new SchemaValidationError(
          `showProfileConfig.graphicConfigIds[${index}] must be a non-empty string`,
        )
      }

      return item
    },
  )

  return {
    id: parseRequiredString(value, 'id', 'showProfileConfig'),
    label: parseRequiredString(value, 'label', 'showProfileConfig'),
    ...(value.source !== undefined
      ? { source: showProfileSourceConfigSchema.parse(value.source) }
      : {}),
    graphicConfigIds,
  }
})

export const appSettingsSchema = createSchema<AppSettings>((input) => {
  const value = assertRecord(input, 'appSettings')
  const referenceImages = (value.referenceImages === undefined
    ? []
    : parseRequiredArray(value, 'referenceImages', 'appSettings').map((referenceImage) =>
      referenceImageAssetSchema.parse(referenceImage),
    )) as ReferenceImageAsset[]
  const sourceSchemas = (value.sourceSchemas === undefined
    ? []
    : parseRequiredArray(value, 'sourceSchemas', 'appSettings').map((sourceSchema) =>
      csvSourceSchemaConfigSchema.parse(sourceSchema),
    )) as CsvSourceSchemaConfig[]
  const profiles = parseRequiredArray(value, 'profiles', 'appSettings').map((profile) =>
    showProfileConfigSchema.parse(profile),
  )
  const graphics = parseRequiredArray(value, 'graphics', 'appSettings').map((graphic) =>
    graphicInstanceConfigSchema.parse(graphic),
  )
  const selectedProfileId = parseRequiredString(value, 'selectedProfileId', 'appSettings')

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId)
  if (!selectedProfile) {
    throw new SchemaValidationError(`appSettings.selectedProfileId references unknown profile: ${selectedProfileId}`)
  }

  const availableSourceSchemaIds = new Set(sourceSchemas.map((sourceSchema) => sourceSchema.id))
  for (const profile of profiles) {
    const schemaId = profile.source?.schemaId
    if (schemaId && !availableSourceSchemaIds.has(schemaId)) {
      throw new SchemaValidationError(
        `appSettings profile "${profile.id}" references unknown source schema: ${schemaId}`,
      )
    }
  }

  const availableGraphicIds = new Set(graphics.map((graphic) => graphic.id))
  for (const profile of profiles) {
    for (const graphicConfigId of profile.graphicConfigIds) {
      if (!availableGraphicIds.has(graphicConfigId)) {
        throw new SchemaValidationError(
          `appSettings profile "${profile.id}" references unknown graphic config: ${graphicConfigId}`,
        )
      }
    }
  }

  return {
    selectedProfileId,
    ...(value.osc !== undefined
      ? { osc: oscSettingsConfigSchema.parse(value.osc) }
      : {}),
    referenceImages,
    sourceSchemas,
    profiles,
    graphics,
  }
})

export const appConfigSchema = {
  parse(input: unknown): AppConfig {
    return appSettingsSchema.parse(input)
  },
}

function isSafeReferenceImagePath(filePath: string): boolean {
  const normalizedPath = filePath.trim()
  if (normalizedPath.length === 0) {
    return false
  }

  return !/[<>:"|?*]/.test(normalizedPath.replace(/^[a-zA-Z]:\\/, ''))
}

function isSafeContentSourcePath(filePath: string): boolean {
  const normalizedPath = filePath.trim()
  if (normalizedPath.length === 0) {
    return false
  }

  return !/[<>:"|?*]/.test(normalizedPath.replace(/^[a-zA-Z]:\\/, ''))
}

function isSafeStaticAssetPath(filePath: string): boolean {
  const normalizedPath = filePath.trim()
  if (normalizedPath.length === 0) {
    return false
  }

  return !/[<>:"|?*]/.test(normalizedPath.replace(/^[a-zA-Z]:\\/, ''))
}

function isStaticGraphicEntityType(value: string): value is typeof staticGraphicEntityTypes[number] {
  return staticGraphicEntityTypes.includes(value as typeof staticGraphicEntityTypes[number])
}

function parseTitleMapping(value: Record<string, unknown>) {
  const enabled = parseOptionalBoolean(value, 'enabled', 'csvEntityMappingConfig.title')
  if (enabled === undefined) {
    throw new SchemaValidationError('csvEntityMappingConfig.title.enabled is required')
  }

  if (!enabled) {
    return { enabled: false }
  }

  const fields = assertRecord(value.fields, 'csvEntityMappingConfig.title.fields')

  return {
    enabled: true,
    fields: {
      number: parseRequiredString(fields, 'number', 'csvEntityMappingConfig.title.fields'),
      title: parseRequiredString(fields, 'title', 'csvEntityMappingConfig.title.fields'),
    },
  }
}

function parsePersonMapping(value: Record<string, unknown>) {
  const enabled = parseOptionalBoolean(value, 'enabled', 'csvEntityMappingConfig.person')
  if (enabled === undefined) {
    throw new SchemaValidationError('csvEntityMappingConfig.person.enabled is required')
  }

  if (!enabled) {
    return { enabled: false }
  }

  const fields = assertRecord(value.fields, 'csvEntityMappingConfig.person.fields')

  return {
    enabled: true,
    fields: {
      name: parseRequiredString(fields, 'name', 'csvEntityMappingConfig.person.fields'),
      role: parseRequiredString(fields, 'role', 'csvEntityMappingConfig.person.fields'),
    },
  }
}

function parseValueMapping(value: Record<string, unknown>, contextKey: string) {
  const enabled = parseOptionalBoolean(value, 'enabled', `csvEntityMappingConfig.${contextKey}`)
  if (enabled === undefined) {
    throw new SchemaValidationError(`csvEntityMappingConfig.${contextKey}.enabled is required`)
  }

  if (!enabled) {
    return { enabled: false }
  }

  const fields = assertRecord(value.fields, `csvEntityMappingConfig.${contextKey}.fields`)

  return {
    enabled: true,
    fields: {
      value: parseRequiredString(fields, 'value', `csvEntityMappingConfig.${contextKey}.fields`),
    },
  }
}

function parsePhoneMapping(value: Record<string, unknown>) {
  const enabled = parseOptionalBoolean(value, 'enabled', 'csvEntityMappingConfig.phone')
  if (enabled === undefined) {
    throw new SchemaValidationError('csvEntityMappingConfig.phone.enabled is required')
  }

  if (!enabled) {
    return { enabled: false }
  }

  const fields = assertRecord(value.fields, 'csvEntityMappingConfig.phone.fields')

  return {
    enabled: true,
    fields: {
      label: parseRequiredString(fields, 'label', 'csvEntityMappingConfig.phone.fields'),
      number: parseRequiredString(fields, 'number', 'csvEntityMappingConfig.phone.fields'),
    },
  }
}
