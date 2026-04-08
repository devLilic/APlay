import { useEffect, useRef, useState } from 'react'
import type { PreviewTemplateDefinition } from '@/settings/models/appConfig'
import {
  calculatePreviewBackgroundStyle,
  calculatePreviewTemplateLayout,
  type PreviewTemplateLayoutElement,
} from '@/features/preview/state/previewTemplateEngine'
import { useScaleToFit } from '@/features/preview/state/scaleToFit'

interface PreviewCanvasProps {
  template: PreviewTemplateDefinition
  content: Record<string, string | undefined>
  backgroundImagePath?: string
}

export function PreviewCanvas({ template, content, backgroundImagePath }: PreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [resolvedBackgroundImageSrc, setResolvedBackgroundImageSrc] = useState<string | undefined>()
  const [resolvedElementImageSources, setResolvedElementImageSources] = useState<Record<string, string | undefined>>({})

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    const resolveBackgroundImage = async () => {
      if (!backgroundImagePath) {
        setResolvedBackgroundImageSrc(undefined)
        return
      }

      if (isDirectPreviewImageSource(backgroundImagePath)) {
        setResolvedBackgroundImageSrc(backgroundImagePath)
        return
      }

      const dataUrl = await window.settingsApi?.readReferenceImage?.(backgroundImagePath)
      if (!cancelled) {
        setResolvedBackgroundImageSrc(dataUrl ?? undefined)
      }
    }

    void resolveBackgroundImage()

    return () => {
      cancelled = true
    }
  }, [backgroundImagePath])

  const layout = size.width > 0 && size.height > 0
    ? calculatePreviewTemplateLayout(template, size, content)
    : null
  const backgroundStyle = calculatePreviewBackgroundStyle(template, resolvedBackgroundImageSrc)

  useEffect(() => {
    let cancelled = false

    const resolveElementImages = async () => {
      const imageElements = (layout?.elements ?? []).filter((element) => element.kind === 'image')
      if (imageElements.length === 0) {
        setResolvedElementImageSources({})
        return
      }

      const resolvedEntries = await Promise.all(
        imageElements.map(async (element) => [
          element.id,
          await resolvePreviewImageSource(element.content),
        ] as const),
      )

      if (!cancelled) {
        setResolvedElementImageSources(Object.fromEntries(resolvedEntries))
      }
    }

    void resolveElementImages()

    return () => {
      cancelled = true
    }
  }, [layout])

  return (
    <div
      ref={containerRef}
      className='relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,_rgba(15,23,42,1),_rgba(30,41,59,0.96))]'
    >
      {backgroundStyle ? (
        <div className='absolute inset-0 z-0 flex items-center justify-center overflow-hidden'>
          <img
            src={backgroundStyle.imagePath}
            alt=''
            className={`h-full w-full ${backgroundStyle.objectFit === 'cover' ? 'object-cover' : 'object-contain'}`}
            style={{
              opacity: backgroundStyle.opacity,
              objectPosition: backgroundStyle.objectPosition,
            }}
          />
        </div>
      ) : null}

      {layout ? layout.elements.map((element) => {
        if (element.kind === 'text') {
          return <PreviewTextElement key={element.id} element={element} />
        }

        if (element.kind === 'image') {
          return (
            <div
              key={element.id}
              className='absolute z-10 overflow-hidden rounded-xl border border-white/10 bg-white/5'
              style={{
                left: `${element.style.left}px`,
                top: `${element.style.top}px`,
                width: `${element.style.width}px`,
                height: `${element.style.height}px`,
                borderRadius: element.style.borderRadius !== undefined
                  ? `${element.style.borderRadius}px`
                  : undefined,
                transformOrigin: element.style.transformOrigin,
                backgroundColor: element.style.backgroundColor,
                borderColor: element.style.borderColor,
                borderWidth: element.style.borderColor ? '1px' : undefined,
                borderStyle: element.style.borderColor ? 'solid' : undefined,
                zIndex: element.style.zIndex,
              }}
            >
              {resolvedElementImageSources[element.id] ? (
                <img
                  src={resolvedElementImageSources[element.id]}
                  alt=''
                  className='h-full w-full object-contain'
                />
              ) : null}
            </div>
          )
        }

        return (
          <div
            key={element.id}
            className='absolute z-10 rounded-2xl border border-white/15 bg-white/10'
            style={{
              left: `${element.style.left}px`,
              top: `${element.style.top}px`,
              width: `${element.style.width}px`,
              height: `${element.style.height}px`,
              borderRadius: element.style.borderRadius !== undefined
                ? `${element.style.borderRadius}px`
                : undefined,
              transformOrigin: element.style.transformOrigin,
              backgroundColor: element.style.backgroundColor,
              borderColor: element.style.borderColor,
              borderWidth: element.style.borderColor ? '1px' : undefined,
              borderStyle: element.style.borderColor ? 'solid' : undefined,
              zIndex: element.style.zIndex,
            }}
          />
        )
      }) : null}
    </div>
  )
}

function isDirectPreviewImageSource(source: string): boolean {
  return /^(data:|https?:|blob:)/i.test(source)
}

async function resolvePreviewImageSource(source: string | undefined): Promise<string | undefined> {
  const normalizedSource = source?.trim()
  if (!normalizedSource) {
    return undefined
  }

  if (isDirectPreviewImageSource(normalizedSource)) {
    return normalizedSource
  }

  return await window.settingsApi?.readReferenceImage?.(normalizedSource) ?? normalizedSource
}

function PreviewTextElement({ element }: { element: PreviewTemplateLayoutElement }) {
  const textRef = useRef<HTMLSpanElement | null>(null)
  const scaleX = useScaleToFit({
    availableWidth: Math.max(
      element.style.width - (element.style.paddingLeft ?? 0) - (element.style.paddingRight ?? 0),
      0,
    ),
    fitInBox: element.style.fitInBox,
    minScaleX: element.style.minScaleX,
    measureRef: textRef,
    dependencies: [
      element.content,
      element.style.width,
      element.style.fontSize,
      element.style.fontFamily,
    ],
  })

  return (
    <div
      className='absolute z-10 flex items-center overflow-hidden whitespace-nowrap border border-transparent font-semibold tracking-tight text-white'
      style={{
        left: `${element.style.left}px`,
        top: `${element.style.top}px`,
        width: `${element.style.width}px`,
        height: `${element.style.height}px`,
        borderRadius: element.style.borderRadius !== undefined
          ? `${element.style.borderRadius}px`
          : undefined,
        color: element.style.color,
        backgroundColor: element.style.backgroundColor,
        borderColor: element.style.borderColor,
        borderWidth: element.style.borderColor ? '1px' : undefined,
        borderStyle: element.style.borderColor ? 'solid' : undefined,
        zIndex: element.style.zIndex,
        justifyContent: element.style.textAlign === 'center' ? 'center' : 'flex-start',
        textAlign: element.style.textAlign ?? 'left',
        paddingLeft: element.style.paddingLeft !== undefined ? `${element.style.paddingLeft}px` : undefined,
        paddingRight: element.style.paddingRight !== undefined ? `${element.style.paddingRight}px` : undefined,
        boxSizing: 'border-box',
      }}
    >
      <span
        ref={textRef}
        className='inline-block whitespace-nowrap'
        style={{
          transformOrigin: element.style.fitInBox ? 'center left' : element.style.transformOrigin,
          transform: `scaleX(${scaleX})`,
          fontSize: element.style.fontSize !== undefined
            ? `${element.style.fontSize}px`
            : undefined,
          fontFamily: element.style.fontFamily ?? 'Arial',
          textAlign: element.style.textAlign ?? 'left',
        }}
      >
        {element.content}
      </span>
    </div>
  )
}
