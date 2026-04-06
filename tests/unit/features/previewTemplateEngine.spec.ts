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
      text: {
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
