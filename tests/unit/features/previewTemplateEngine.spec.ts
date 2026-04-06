import { describe, expect, it } from 'vitest'
import type { PreviewTemplateDefinition } from '@/settings/models/appConfig'
import {
  calculatePreviewBackgroundStyle,
  calculatePreviewScale,
  calculatePreviewTemplateLayout,
  calculateTextElementStyle,
} from '@/features/preview/state/previewTemplateEngine'

const previewTemplate: PreviewTemplateDefinition = {
  id: 'title-preview',
  designWidth: 1920,
  designHeight: 1080,
  background: {
    referenceImageId: 'ref-title',
    opacity: 0.45,
    fitMode: 'contain',
    position: 'center',
  },
  elements: [
    {
      id: 'headline',
      kind: 'text',
      sourceField: 'text',
      transformOrigin: 'top-left',
      box: {
        x: 120,
        y: 180,
        width: 840,
        height: 140,
      },
      behavior: {
        allCaps: false,
        fitInBox: false,
      },
    },
    {
      id: 'panel',
      kind: 'box',
      sourceField: 'panel',
      transformOrigin: 'center',
      box: {
        x: 80,
        y: 760,
        width: 600,
        height: 180,
      },
    },
    {
      id: 'logo',
      kind: 'image',
      sourceField: 'logoUrl',
      box: {
        x: 1600,
        y: 80,
        width: 180,
        height: 180,
      },
    },
  ],
}

describe('preview scaling', () => {
  it('scales from base design space to actual preview size proportionally', () => {
    expect(
      calculatePreviewScale({
        designWidth: 1920,
        designHeight: 1080,
        actualWidth: 960,
        actualHeight: 540,
      }),
    ).toEqual({
      scaleX: 0.5,
      scaleY: 0.5,
      scale: 0.5,
    })
  })
})

describe('transform origin behavior', () => {
  it('defaults transformOrigin to top-left', () => {
    const layout = calculatePreviewTemplateLayout(
      {
        ...previewTemplate,
        elements: [
          {
            id: 'headline',
            kind: 'text',
            sourceField: 'text',
            box: {
              x: 100,
              y: 100,
              width: 500,
              height: 120,
            },
          },
        ],
      },
      { width: 960, height: 540 },
      { text: 'Headline' },
    )

    expect(layout.elements[0]?.style.transformOrigin).toBe('top-left')
  })

  it('applies custom transformOrigin values', () => {
    const layout = calculatePreviewTemplateLayout(
      previewTemplate,
      { width: 960, height: 540 },
      { text: 'Headline', logoUrl: '/logo.png' },
    )

    expect(layout.elements[1]?.style.transformOrigin).toBe('center')
  })
})

describe('text behavior calculations', () => {
  it('applies scale when fitInBox is on in element behavior config', () => {
    const layout = calculatePreviewTemplateLayout(
      {
        ...previewTemplate,
        elements: [
          {
            id: 'headline',
            kind: 'text',
            sourceField: 'text',
            transformOrigin: 'top-left',
            box: {
              x: 0,
              y: 0,
              width: 200,
              height: 80,
            },
            behavior: {
              fitInBox: true,
            },
          },
        ],
      },
      { width: 960, height: 540 },
      { text: 'Long headline for fitting' },
    )

    expect(layout.elements[0]?.style.scaleX).toBeLessThanOrEqual(1)
  })

  it('does not apply scaling when fitInBox is off in element behavior config', () => {
    const layout = calculatePreviewTemplateLayout(
      {
        ...previewTemplate,
        elements: [
          {
            id: 'headline',
            kind: 'text',
            sourceField: 'text',
            transformOrigin: 'top-left',
            box: {
              x: 0,
              y: 0,
              width: 200,
              height: 80,
            },
            behavior: {
              fitInBox: false,
            },
          },
        ],
      },
      { width: 960, height: 540 },
      { text: 'Long headline for fitting' },
    )

    expect(layout.elements[0]?.style.scaleX).toBe(1)
  })

  it('transforms text to all caps before measurement when allCaps is enabled in behavior config', () => {
    const result = calculateTextElementStyle(
      {
        content: 'headline',
        boxWidth: 240,
        transformOrigin: 'top-left',
        text: {
          allCaps: true,
          fitInBox: true,
        },
      },
      { measuredTextWidth: 320 },
    )

    expect(result.content).toBe('HEADLINE')
    expect(result.style.scaleX).toBe(0.75)
  })

  it('applies transformOrigin from element config correctly', () => {
    const layout = calculatePreviewTemplateLayout(
      {
        ...previewTemplate,
        elements: [
          {
            id: 'headline',
            kind: 'text',
            sourceField: 'text',
            transformOrigin: 'bottom-right',
            box: {
              x: 0,
              y: 0,
              width: 200,
              height: 80,
            },
            behavior: {
              fitInBox: true,
            },
          },
        ],
      },
      { width: 960, height: 540 },
      { text: 'Headline' },
    )

    expect(layout.elements[0]?.style.transformOrigin).toBe('bottom-right')
  })

  it('respects minScaleX from element behavior config', () => {
    const layout = calculatePreviewTemplateLayout(
      {
        ...previewTemplate,
        elements: [
          {
            id: 'headline',
            kind: 'text',
            sourceField: 'text',
            transformOrigin: 'top-left',
            box: {
              x: 0,
              y: 0,
              width: 200,
              height: 80,
            },
            behavior: {
              fitInBox: true,
              minScaleX: 0.7,
            },
          },
        ],
      },
      { width: 960, height: 540 },
      { text: 'Very long headline for fitting' },
    )

    expect(layout.elements[0]?.style.scaleX).toBe(0.7)
  })

  it('keeps scaleX at 1 without fitInBox and keeps nowrap clipping semantics', () => {
    const result = calculateTextElementStyle(
      {
        content: 'Overflowing headline',
        boxWidth: 120,
        transformOrigin: 'top-left',
        text: {
          fitInBox: false,
        },
      },
      { measuredTextWidth: 420 },
    )

    expect(result.style.scaleX).toBe(1)
    expect(result.style.whiteSpace).toBe('nowrap')
  })

  it('keeps text unchanged when allCaps is off', () => {
    const result = calculateTextElementStyle(
      {
        content: 'Main Headline',
        boxWidth: 400,
        transformOrigin: 'top-left',
        text: {
          allCaps: false,
          fitInBox: false,
        },
      },
      { measuredTextWidth: 220 },
    )

    expect(result.content).toBe('Main Headline')
  })

  it('converts text to uppercase when allCaps is on', () => {
    const result = calculateTextElementStyle(
      {
        content: 'Main Headline',
        boxWidth: 400,
        transformOrigin: 'top-left',
        text: {
          allCaps: true,
          fitInBox: false,
        },
      },
      { measuredTextWidth: 220 },
    )

    expect(result.content).toBe('MAIN HEADLINE')
  })

  it('leaves scaleX unchanged when fitInBox is off', () => {
    const result = calculateTextElementStyle(
      {
        content: 'Long Headline',
        boxWidth: 200,
        transformOrigin: 'top-left',
        text: {
          fitInBox: false,
        },
      },
      { measuredTextWidth: 420 },
    )

    expect(result.style.scaleX).toBe(1)
  })

  it('computes scaleX when fitInBox is on and text exceeds box width', () => {
    const result = calculateTextElementStyle(
      {
        content: 'Long Headline',
        boxWidth: 200,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 400 },
    )

    expect(result.style.scaleX).toBe(0.5)
  })

  it('uses containerWidth / textWidth for fitInBox scaling', () => {
    const result = calculateTextElementStyle(
      {
        content: 'Long headline',
        boxWidth: 180,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 360 },
    )

    expect(result.style.scaleX).toBe(0.5)
    expect(result.style.scaleX).toBeLessThanOrEqual(1)
  })

  it('keeps scaleX at 1 for empty text', () => {
    const result = calculateTextElementStyle(
      {
        content: '',
        boxWidth: 200,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 0 },
    )

    expect(result.content).toBe('')
    expect(result.style.scaleX).toBe(1)
  })

  it('reduces scaleX correctly for very long text so it fits the container width', () => {
    const result = calculateTextElementStyle(
      {
        content: 'This is a very long headline that must fit',
        boxWidth: 160,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 640 },
    )

    expect(result.style.scaleX).toBe(0.25)
    expect(640 * result.style.scaleX).toBeLessThanOrEqual(160)
  })

  it('falls back safely to scaleX 1 when containerWidth is 0', () => {
    const result = calculateTextElementStyle(
      {
        content: 'Headline',
        boxWidth: 0,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 240 },
    )

    expect(result.style.scaleX).toBe(1)
  })

  it('falls back safely to scaleX 1 when textWidth is 0', () => {
    const result = calculateTextElementStyle(
      {
        content: 'Headline',
        boxWidth: 240,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 0 },
    )

    expect(result.style.scaleX).toBe(1)
  })

  it('respects minScaleX when fitInBox is enabled', () => {
    const result = calculateTextElementStyle(
      {
        content: 'Very Long Headline',
        boxWidth: 200,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
          minScaleX: 0.7,
        },
      },
      { measuredTextWidth: 500 },
    )

    expect(result.style.scaleX).toBe(0.7)
  })

  it('keeps the same stable scaleX for equivalent float inputs', () => {
    const first = calculateTextElementStyle(
      {
        content: 'Headline',
        boxWidth: 199.9999999,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 399.9999998 },
    )
    const second = calculateTextElementStyle(
      {
        content: 'Headline',
        boxWidth: 200,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 400 },
    )

    expect(first.style.scaleX).toBeCloseTo(second.style.scaleX, 8)
  })

  it('recalculates when text changes', () => {
    const shortText = calculateTextElementStyle(
      {
        content: 'Short',
        boxWidth: 200,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 100 },
    )
    const longText = calculateTextElementStyle(
      {
        content: 'Very long headline',
        boxWidth: 200,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 400 },
    )

    expect(shortText.style.scaleX).toBe(1)
    expect(longText.style.scaleX).toBe(0.5)
  })

  it('recalculates when available width changes', () => {
    const narrow = calculateTextElementStyle(
      {
        content: 'Headline',
        boxWidth: 160,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 320 },
    )
    const wide = calculateTextElementStyle(
      {
        content: 'Headline',
        boxWidth: 320,
        transformOrigin: 'top-left',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 320 },
    )

    expect(narrow.style.scaleX).toBe(0.5)
    expect(wide.style.scaleX).toBe(1)
  })

  it('calculates text style values for scalable HTML/CSS rendering', () => {
    const result = calculateTextElementStyle(
      {
        content: 'Headline',
        boxWidth: 400,
        transformOrigin: 'center',
        text: {
          allCaps: false,
          fitInBox: true,
        },
      },
      { measuredTextWidth: 200 },
    )

    expect(result.style).toEqual({
      transformOrigin: 'center',
      scaleX: 1,
      whiteSpace: 'nowrap',
    })
  })

  it('keeps fit-in-box logic independent from UI, OSC, and JSON publishing concerns', () => {
    const result = calculateTextElementStyle(
      {
        content: 'Headline',
        boxWidth: 200,
        transformOrigin: 'center',
        text: {
          fitInBox: true,
        },
      },
      { measuredTextWidth: 300 },
    )

    expect(result).not.toHaveProperty('component')
    expect(result).not.toHaveProperty('osc')
    expect(result).not.toHaveProperty('payload')
  })
})

describe('preview element calculations', () => {
  it('calculates box element style values', () => {
    const layout = calculatePreviewTemplateLayout(
      previewTemplate,
      { width: 960, height: 540 },
      { panel: '' },
    )

    expect(layout.elements[1]).toEqual({
      id: 'panel',
      kind: 'box',
      sourceField: 'panel',
      content: '',
      style: {
        left: 40,
        top: 380,
        width: 300,
        height: 90,
        transformOrigin: 'center',
        zIndex: 1,
      },
    })
  })

  it('supports text, box, and image element definitions at render-calculation level', () => {
    const layout = calculatePreviewTemplateLayout(
      previewTemplate,
      { width: 960, height: 540 },
      {
        text: 'Headline',
        panel: '',
        logoUrl: '/logo.png',
      },
    )

    expect(layout.elements.map((element) => element.kind)).toEqual([
      'text',
      'box',
      'image',
    ])
  })

  it('keeps preview calculations independent from LiveBoard output logic', () => {
    const layout = calculatePreviewTemplateLayout(
      previewTemplate,
      { width: 960, height: 540 },
      {
        text: 'Headline',
        panel: '',
        logoUrl: '/logo.png',
      },
    )

    expect(layout).not.toHaveProperty('osc')
    expect(layout).not.toHaveProperty('datasourceFile')
  })
})

describe('preview background rendering', () => {
  it('renders a background image when referenceImageId exists', () => {
    const style = calculatePreviewBackgroundStyle(
      previewTemplate,
      '/references/title.png',
    )

    expect(style).toEqual({
      imagePath: '/references/title.png',
      opacity: 0.45,
      objectFit: 'contain',
      objectPosition: 'center',
      zIndex: 0,
    })
  })

  it('does not render a background when no image is selected', () => {
    const style = calculatePreviewBackgroundStyle(
      {
        ...previewTemplate,
        background: undefined,
      },
      undefined,
    )

    expect(style).toBeUndefined()
  })

  it('applies opacity correctly', () => {
    const style = calculatePreviewBackgroundStyle(
      previewTemplate,
      '/references/title.png',
    )

    expect(style?.opacity).toBe(0.45)
  })

  it('applies contain fit mode correctly', () => {
    const style = calculatePreviewBackgroundStyle(
      previewTemplate,
      '/references/title.png',
    )

    expect(style?.objectFit).toBe('contain')
  })

  it('applies cover fit mode correctly', () => {
    const style = calculatePreviewBackgroundStyle(
      {
        ...previewTemplate,
        background: {
          referenceImageId: 'ref-title',
          opacity: 1,
          fitMode: 'cover',
          position: 'center',
        },
      },
      '/references/title.png',
    )

    expect(style?.objectFit).toBe('cover')
  })

  it('defaults background position to center', () => {
    const style = calculatePreviewBackgroundStyle(
      {
        ...previewTemplate,
        background: {
          referenceImageId: 'ref-title',
          opacity: 1,
          fitMode: 'contain',
        },
      },
      '/references/title.png',
    )

    expect(style?.objectPosition).toBe('center')
  })

  it('does not affect element positioning or scaling', () => {
    const withBackground = calculatePreviewTemplateLayout(
      previewTemplate,
      { width: 960, height: 540 },
      { text: 'Headline', panel: '', logoUrl: '/logo.png' },
    )
    const withoutBackground = calculatePreviewTemplateLayout(
      {
        ...previewTemplate,
        background: undefined,
      },
      { width: 960, height: 540 },
      { text: 'Headline', panel: '', logoUrl: '/logo.png' },
    )

    expect(withBackground.scale).toEqual(withoutBackground.scale)
    expect(withBackground.elements).toEqual(withoutBackground.elements)
  })

  it('renders preview elements above the background layer', () => {
    const style = calculatePreviewBackgroundStyle(
      previewTemplate,
      '/references/title.png',
    )
    const layout = calculatePreviewTemplateLayout(
      previewTemplate,
      { width: 960, height: 540 },
      { text: 'Headline', panel: '', logoUrl: '/logo.png' },
    )

    expect(style?.zIndex).toBe(0)
    expect(layout.elements.every((element) => element.style.zIndex === 1)).toBe(true)
  })

  it('does not break preview rendering when image path is invalid', () => {
    const style = calculatePreviewBackgroundStyle(
      previewTemplate,
      '',
    )

    expect(style).toBeUndefined()
  })

  it('can toggle background on and off without affecting preview logic', () => {
    const backgroundOn = calculatePreviewBackgroundStyle(
      previewTemplate,
      '/references/title.png',
    )
    const backgroundOff = calculatePreviewBackgroundStyle(
      previewTemplate,
      undefined,
    )
    const layout = calculatePreviewTemplateLayout(
      previewTemplate,
      { width: 960, height: 540 },
      { text: 'Headline', panel: '', logoUrl: '/logo.png' },
    )

    expect(backgroundOn).toBeDefined()
    expect(backgroundOff).toBeUndefined()
    expect(layout.elements).toHaveLength(3)
  })
})
