import { useEffect, useRef, useState } from 'react'
import type { PreviewTemplateDefinition } from '@/settings/models/appConfig'
import { calculatePreviewTemplateLayout } from '@/features/preview/state/previewTemplateEngine'

interface PreviewCanvasProps {
  template: PreviewTemplateDefinition
  content: Record<string, string | undefined>
}

export function PreviewCanvas({ template, content }: PreviewCanvasProps) {
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

  return (
    <div
      ref={containerRef}
      className='relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,_rgba(15,23,42,1),_rgba(30,41,59,0.96))]'
    >
      {layout ? layout.elements.map((element) => {
        if (element.kind === 'text') {
          return (
            <div
              key={element.id}
              className='absolute flex items-center font-semibold tracking-tight text-white'
              style={{
                left: `${element.style.left}px`,
                top: `${element.style.top}px`,
                width: `${element.style.width}px`,
                height: `${element.style.height}px`,
                transformOrigin: element.style.transformOrigin,
                transform: `scaleX(${element.style.scaleX ?? 1})`,
                whiteSpace: element.style.whiteSpace,
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
              className='absolute overflow-hidden rounded-xl border border-white/10 bg-white/5'
              style={{
                left: `${element.style.left}px`,
                top: `${element.style.top}px`,
                width: `${element.style.width}px`,
                height: `${element.style.height}px`,
                transformOrigin: element.style.transformOrigin,
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
            className='absolute rounded-2xl border border-white/15 bg-white/10'
            style={{
              left: `${element.style.left}px`,
              top: `${element.style.top}px`,
              width: `${element.style.width}px`,
              height: `${element.style.height}px`,
              transformOrigin: element.style.transformOrigin,
            }}
          />
        )
      }) : null}
    </div>
  )
}
