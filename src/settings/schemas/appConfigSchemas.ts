import { actionTypes, type ActionType } from '@/core/actions/actionTypes'
import { supportedEntityTypes } from '@/core/entities/entityTypes'
import type {
  ActionButtonConfig,
  AppConfig,
  AppSettings,
  GraphicFieldBinding,
  GraphicControlConfig,
  GraphicInstanceConfig,
  PreviewElementDefinition,
  PreviewElementKind,
  PreviewTemplateDefinition,
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
  const textSettings = value.text === undefined
    ? undefined
    : assertRecord(value.text, 'previewElementDefinition.text')

  return {
    id: parseRequiredString(value, 'id', 'previewElementDefinition'),
    kind: parseEnumValue(
      value.kind,
      previewElementKinds,
      'previewElementDefinition',
      'kind',
    ),
    sourceField: parseRequiredString(value, 'sourceField', 'previewElementDefinition'),
    transformOrigin: value.transformOrigin === undefined
      ? 'top-left'
      : parseEnumValue(
        value.transformOrigin,
        transformOrigins,
        'previewElementDefinition',
        'transformOrigin',
      ),
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
    ...(textSettings
      ? {
        text: {
          ...(parseOptionalBoolean(textSettings, 'allCaps', 'previewElementDefinition.text') !== undefined
            ? { allCaps: parseOptionalBoolean(textSettings, 'allCaps', 'previewElementDefinition.text') }
            : {}),
          ...(parseOptionalBoolean(textSettings, 'fitInBox', 'previewElementDefinition.text') !== undefined
            ? { fitInBox: parseOptionalBoolean(textSettings, 'fitInBox', 'previewElementDefinition.text') }
            : {}),
          ...(textSettings.minScaleX !== undefined
            ? { minScaleX: parseRequiredNumber(textSettings, 'minScaleX', 'previewElementDefinition.text') }
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
    graphicConfigIds,
  }
})

export const appSettingsSchema = createSchema<AppSettings>((input) => {
  const value = assertRecord(input, 'appSettings')
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
    profiles,
    graphics,
  }
})

export const appConfigSchema = {
  parse(input: unknown): AppConfig {
    return appSettingsSchema.parse(input)
  },
}
