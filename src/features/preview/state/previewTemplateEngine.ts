import type {
  PreviewBackgroundFitMode,
  PreviewElementDefinition,
  PreviewTextAlign,
  PreviewTemplateDefinition,
  TextBehaviorConfig,
  TransformOrigin,
} from '@/settings/models/appConfig'
import { calculateScaleToFit } from '@/features/preview/state/scaleToFit'

export interface PreviewSize {
  width: number
  height: number
}

export interface PreviewScale {
  scaleX: number
  scaleY: number
  scale: number
}

export interface PreviewTemplateLayoutElement {
  id: string
  kind: PreviewElementDefinition['kind']
  sourceField: string
  content: string
  style: {
    left: number
    top: number
    width: number
    height: number
    borderRadius?: number
    transformOrigin: TransformOrigin
    zIndex: number
    color?: string
    backgroundColor?: string
    borderColor?: string
    fontSize?: number
    fontFamily?: string
    scaleX?: number
    fitInBox?: boolean
    minScaleX?: number
    whiteSpace?: 'nowrap'
    textAlign?: PreviewTextAlign
    paddingLeft?: number
    paddingRight?: number
  }
}

export interface PreviewBackgroundStyle {
  imagePath: string
  opacity: number
  objectFit: PreviewBackgroundFitMode
  objectPosition: 'center'
  zIndex: number
}

export interface PreviewTemplateLayout {
  scale: PreviewScale
  elements: PreviewTemplateLayoutElement[]
}

export interface CompositePreviewItemInput {
  graphicConfigId: string
  template: PreviewTemplateDefinition
  content: Record<string, string | undefined>
}

export interface CompositePreviewItemLayout {
  graphicConfigId: string
  templateId: string
  elements: PreviewTemplateLayoutElement[]
}

export interface CompositePreviewLayout {
  items: CompositePreviewItemLayout[]
  overlayElements: PreviewTemplateLayoutElement[]
}

export interface TextMeasurement {
  measuredTextWidth: number
}

export interface TextElementCalculationInput {
  content: string
  boxWidth: number
  transformOrigin: TransformOrigin
  text?: TextBehaviorConfig
}

export interface TextElementCalculationResult {
  content: string
  style: {
    transformOrigin: TransformOrigin
    scaleX: number
    whiteSpace: 'nowrap'
  }
}

export function calculatePreviewScale(input: {
  designWidth: number
  designHeight: number
  actualWidth: number
  actualHeight: number
}): PreviewScale {
  const scaleX = input.actualWidth / input.designWidth
  const scaleY = input.actualHeight / input.designHeight

  return {
    scaleX,
    scaleY,
    scale: Math.min(scaleX, scaleY),
  }
}

export function calculatePreviewTemplateLayout(
  template: PreviewTemplateDefinition,
  previewSize: PreviewSize,
  content: Record<string, string | undefined>,
): PreviewTemplateLayout {
  const scale = calculatePreviewScale({
    designWidth: template.designWidth,
    designHeight: template.designHeight,
    actualWidth: previewSize.width,
    actualHeight: previewSize.height,
  })

  return {
    scale,
    elements: template.elements.map((element) =>
      calculatePreviewElementLayout(element, scale, content[element.sourceField]),
    ).filter((element): element is PreviewTemplateLayoutElement => element !== undefined),
  }
}

export function calculateCompositePreviewLayout(
  items: CompositePreviewItemInput[],
  previewSize: PreviewSize,
): CompositePreviewLayout {
  const validItems = items.flatMap((item) => {
    if (!isValidPreviewTemplate(item.template)) {
      return []
    }

    try {
      const layout = calculatePreviewTemplateLayout(item.template, previewSize, item.content)
      return [{
        graphicConfigId: item.graphicConfigId,
        templateId: item.template.id,
        elements: layout.elements,
      }]
    } catch {
      return []
    }
  })

  return {
    items: validItems,
    overlayElements: validItems.flatMap((item) =>
      item.elements.map((element) => ({
        ...element,
        id: `${item.graphicConfigId}:${element.id}`,
      }))
    ),
  }
}

export function calculateTextElementStyle(
  input: TextElementCalculationInput,
  measurement: TextMeasurement,
): TextElementCalculationResult {
  const allCaps = input.text?.allCaps ?? false
  const content = allCaps ? input.content.toUpperCase() : input.content
  const scaleX = calculateScaleToFit({
    availableWidth: Math.max(
      input.boxWidth - (input.text?.paddingLeft ?? 0) - (input.text?.paddingRight ?? 0),
      0,
    ),
    textWidth: measurement.measuredTextWidth,
    fitInBox: input.text?.fitInBox,
    minScaleX: input.text?.minScaleX,
  })

  return {
    content,
    style: {
      transformOrigin: input.transformOrigin,
      scaleX,
      whiteSpace: 'nowrap',
    },
  }
}

export function calculatePreviewBackgroundStyle(
  template: PreviewTemplateDefinition,
  imagePath: string | undefined,
): PreviewBackgroundStyle | undefined {
  const normalizedPath = imagePath?.trim()
  const background = template.background

  if (!background?.referenceImageId || !normalizedPath) {
    return undefined
  }

  return {
    imagePath: normalizedPath,
    opacity: background.opacity ?? 1,
    objectFit: background.fitMode ?? 'contain',
    objectPosition: background.position ?? 'center',
    zIndex: 0,
  }
}

function calculatePreviewElementLayout(
  element: PreviewElementDefinition,
  scale: PreviewScale,
  rawContent: string | undefined,
): PreviewTemplateLayoutElement | undefined {
  if (element.visible === false) {
    return undefined
  }

  const transformOrigin = element.transformOrigin ?? 'top-left'
  const content = element.previewText ?? rawContent ?? ''
  const behavior = element.behavior ?? element.text
  const baseStyle = {
    left: element.box.x * scale.scaleX,
    top: element.box.y * scale.scaleY,
    width: element.box.width * scale.scaleX,
    height: element.box.height * scale.scaleY,
    ...(element.borderRadius !== undefined
      ? { borderRadius: element.borderRadius * scale.scale }
      : {}),
    transformOrigin,
    zIndex: 1,
    ...(element.textColor ? { color: element.textColor } : {}),
    ...(element.backgroundColor ? { backgroundColor: element.backgroundColor } : {}),
    ...(element.borderColor ? { borderColor: element.borderColor } : {}),
    ...(behavior?.fontSize !== undefined
      ? { fontSize: behavior.fontSize * scale.scale }
      : {}),
    ...(behavior?.fontFamily
      ? { fontFamily: behavior.fontFamily }
      : element.kind === 'text'
        ? { fontFamily: 'Arial' }
        : {}),
  }

  if (element.kind === 'text') {
    const textStyle = calculateTextElementStyle(
      {
        content,
        boxWidth: element.box.width,
        transformOrigin,
        text: behavior,
      },
      {
        measuredTextWidth: content.length * 10,
      },
    )

    return {
      id: element.id,
      kind: element.kind,
      sourceField: element.sourceField,
      content: textStyle.content,
      style: {
        ...baseStyle,
        scaleX: textStyle.style.scaleX,
        fitInBox: behavior?.fitInBox,
        minScaleX: behavior?.minScaleX,
        whiteSpace: textStyle.style.whiteSpace,
        textAlign: behavior?.textAlign ?? 'left',
        paddingLeft: (behavior?.paddingLeft ?? 0) * scale.scaleX,
        paddingRight: (behavior?.paddingRight ?? 0) * scale.scaleX,
      },
    }
  }

  return {
    id: element.id,
    kind: element.kind,
    sourceField: element.sourceField,
    content,
    style: baseStyle,
  }
}

function isValidPreviewTemplate(template: PreviewTemplateDefinition | undefined): template is PreviewTemplateDefinition {
  return Boolean(
    template &&
    Number.isFinite(template.designWidth) &&
    template.designWidth > 0 &&
    Number.isFinite(template.designHeight) &&
    template.designHeight > 0 &&
    Array.isArray(template.elements),
  )
}
