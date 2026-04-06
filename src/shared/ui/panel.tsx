import type { PropsWithChildren, ReactNode } from 'react'

interface PanelProps extends PropsWithChildren {
  title: string
  eyebrow?: string
  aside?: ReactNode
}

export function Panel({ title, eyebrow, aside, children }: PanelProps) {
  return (
    <section className='flex min-h-0 flex-col rounded-3xl border border-border/80 bg-panel shadow-panel'>
      <header className='flex items-start justify-between gap-4 border-b border-border/80 px-5 py-4'>
        <div className='space-y-1'>
          {eyebrow ? <p className='text-xs font-semibold uppercase tracking-[0.22em] text-accent'>{eyebrow}</p> : null}
          <h2 className='text-lg font-semibold text-ink'>{title}</h2>
        </div>
        {aside}
      </header>
      <div className='flex min-h-0 flex-1 flex-col p-5'>{children}</div>
    </section>
  )
}
