import { actionTypes, type ActionType } from '@/core/actions/actionTypes'
import { supportedEntityTypes } from '@/core/entities/entityTypes'
import type {
  ActionButtonConfig,
  AppConfig,
  AppSettings,
  GraphicFieldBinding,
  GraphicControlConfig,
  GraphicInstanceConfig,
  PreviewBackgroundConfig,
  ShowProfileSourceConfig,
  PreviewElementDefinition,
  PreviewElementKind,
  PreviewTemplateDefinition,
  ReferenceImageAsset,
  ShowProfileConfig,
  TransformOrigin,
} from '@/settings/models/appConfig'
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
const previewTextAlignValues = ['left', 'center'] as const

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
    play: parseRequiredString(value, 'play', 'graphicControlConfig'),
    stop: parseRequiredString(value, 'stop', 'graphicControlConfig'),
    resume: parseRequiredString(value, 'resume', 'graphicControlConfig'),
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
  const bindings = value.bindings === undefined
    ? undefined
    : parseRequiredArray(value, 'bindings', 'graphicInstanceConfig').map((binding) =>
      graphicFieldBindingSchema.parse(binding),
    )

  return {
    id: parseRequiredString(value, 'id', 'graphicInstanceConfig'),
    entityType: parseEnumValue(
      value.entityType,
      supportedEntityTypes,
      'graphicInstanceConfig',
      'entityType',
    ),
    dataFileName: parseRequiredString(value, 'dataFileName', 'graphicInstanceConfig'),
    ...(parseOptionalString(value, 'datasourcePath', 'graphicInstanceConfig')
      ? { datasourcePath: parseOptionalString(value, 'datasourcePath', 'graphicInstanceConfig') }
      : {}),
    control: graphicControlConfigSchema.parse(value.control),
    ...(bindings ? { bindings } : {}),
    preview: previewTemplateDefinitionSchema.parse(value.preview),
    actions,
  }
})

export const showProfileSourceConfigSchema = createSchema<ShowProfileSourceConfig>((input) => {
  const value = assertRecord(input, 'showProfileConfig.source')
  const filePath = parseOptionalString(value, 'filePath', 'showProfileConfig.source')

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
    referenceImages,
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
