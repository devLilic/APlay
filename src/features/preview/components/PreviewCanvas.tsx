import { useEffect, useRef, useState } from 'react'
import type { PreviewTemplateDefinition } from '@/settings/models/appConfig'
import {
  calculatePreviewBackgroundStyle,
  calculatePreviewTemplateLayout,
} from '@/features/preview/state/previewTemplateEngine'

interface PreviewCanvasProps {
  template: PreviewTemplateDefinition
  content: Record<string, string | undefined>
  backgroundImagePath?: string
}

export function PreviewCanvas({ template, content, backgroundImagePath }: PreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

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

  const layout = size.width > 0 && size.height > 0
    ? calculatePreviewTemplateLayout(template, size, content)
    : null
  const backgroundStyle = calculatePreviewBackgroundStyle(template, backgroundImagePath)

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
          return (
            <div
              key={element.id}
              className='absolute z-10 flex items-center font-semibold tracking-tight text-white'
              style={{
                left: `${element.style.left}px`,
                top: `${element.style.top}px`,
                width: `${element.style.width}px`,
                height: `${element.style.height}px`,
                transformOrigin: element.style.transformOrigin,
                transform: `scaleX(${element.style.scaleX ?? 1})`,
                whiteSpace: element.style.whiteSpace,
                color: element.style.color,
                backgroundColor: element.style.backgroundColor,
                borderColor: element.style.borderColor,
                zIndex: element.style.zIndex,
              }}
            >
              {element.content}
            </div>
          )
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
                transformOrigin: element.style.transformOrigin,
                backgroundColor: element.style.backgroundColor,
                borderColor: element.style.borderColor,
                zIndex: element.style.zIndex,
              }}
            >
              {element.content ? (
                <img
                  src={element.content}
                  alt=''
                  className='h-full w-full object-cover'
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
              transformOrigin: element.style.transformOrigin,
              backgroundColor: element.style.backgroundColor,
              borderColor: element.style.borderColor,
              zIndex: element.style.zIndex,
            }}
          />
        )
      }) : null}
    </div>
  )
}
