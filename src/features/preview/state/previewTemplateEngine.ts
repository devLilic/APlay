import type {
  PreviewElementDefinition,
  PreviewTemplateDefinition,
  TextBehaviorConfig,
  TransformOrigin,
} from '@/settings/models/appConfig'

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
    transformOrigin: TransformOrigin
    scaleX?: number
    whiteSpace?: 'nowrap'
  }
}

export interface PreviewTemplateLayout {
  scale: PreviewScale
  elements: PreviewTemplateLayoutElement[]
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
    ),
  }
}

export function calculateTextElementStyle(
  input: TextElementCalculationInput,
  measurement: TextMeasurement,
): TextElementCalculationResult {
  const allCaps = input.text?.allCaps ?? false
  const fitInBox = input.text?.fitInBox ?? false
  const minScaleX = input.text?.minScaleX ?? 0
  const content = allCaps ? input.content.toUpperCase() : input.content
  const overflowScaleX = measurement.measuredTextWidth > input.boxWidth && measurement.measuredTextWidth > 0
    ? input.boxWidth / measurement.measuredTextWidth
    : 1
  const scaleX = fitInBox ? Math.max(minScaleX, overflowScaleX) : 1

  return {
    content,
    style: {
      transformOrigin: input.transformOrigin,
      scaleX,
      whiteSpace: 'nowrap',
    },
  }
}

function calculatePreviewElementLayout(
  element: PreviewElementDefinition,
  scale: PreviewScale,
  rawContent: string | undefined,
): PreviewTemplateLayoutElement {
  const transformOrigin = element.transformOrigin ?? 'top-left'
  const content = rawContent ?? ''
  const baseStyle = {
    left: element.box.x * scale.scaleX,
    top: element.box.y * scale.scaleY,
    width: element.box.width * scale.scaleX,
    height: element.box.height * scale.scaleY,
    transformOrigin,
  }

  if (element.kind === 'text') {
    const textStyle = calculateTextElementStyle(
      {
        content,
        boxWidth: element.box.width,
        transformOrigin,
        text: element.text,
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
        whiteSpace: textStyle.style.whiteSpace,
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
