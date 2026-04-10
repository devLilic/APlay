import type { PropsWithChildren, ReactNode } from 'react'
import { controlClassNames } from '@/shared/ui/theme'

interface PanelProps extends PropsWithChildren {
  title: string
  eyebrow?: string
  aside?: ReactNode
  className?: string
  contentClassName?: string
}

export function Panel({
  title,
  eyebrow,
  aside,
  className,
  contentClassName,
  children,
}: PanelProps) {
  return (
    <section className={[
      'ap-panel flex min-h-0 flex-col',
      className,
    ].filter(Boolean).join(' ')}
    >
      <header className='ap-panel-header'>
        <div className='space-y-1'>
          {eyebrow ? <p className='ap-section-eyebrow'>{eyebrow}</p> : null}
          {title ? <h2 className={controlClassNames.panelTitle}>{title}</h2> : null}
        </div>
        {aside}
      </header>
      <div className={[
        'flex min-h-0 flex-1 flex-col p-5',
        contentClassName,
      ].filter(Boolean).join(' ')}
      >
        {children}
      </div>
    </section>
  )
}
