import { actionTypes } from '@/core/actions/actionTypes'
import { supportedEntityTypes } from '@/core/entities/entityTypes'
import { Panel } from '@/shared/ui/panel'

const placeholderBlocks = [
  'Opening Headlines',
  'Studio Guest',
  'Field Update',
]

const placeholderCollections = supportedEntityTypes.map((entityType) => ({
  entityType,
  count: 0,
}))

export function WorkspaceScaffold() {
  return (
    <>
      <header className='flex flex-col gap-4 rounded-[2rem] border border-border/80 bg-slate-950 px-6 py-6 text-slate-50 shadow-panel lg:flex-row lg:items-end lg:justify-between'>
        <div className='space-y-3'>
          <p className='text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300'>APlay foundation</p>
          <div className='space-y-2'>
            <h1 className='text-3xl font-semibold tracking-tight'>Modular desktop scaffold for editorial graphics control</h1>
            <p className='max-w-3xl text-sm text-slate-300'>
              V1 is prepared for block-based content ingestion, HTML/CSS preview rendering, JSON datasource publishing, and OSC-triggered playback.
            </p>
          </div>
        </div>
        <div className='grid gap-2 text-sm text-slate-200 sm:grid-cols-3'>
          <div className='rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
            <p className='text-xs uppercase tracking-[0.2em] text-slate-400'>Source</p>
            <p className='mt-1 font-medium'>CSV now, JSON-ready core</p>
          </div>
          <div className='rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
            <p className='text-xs uppercase tracking-[0.2em] text-slate-400'>Preview</p>
            <p className='mt-1 font-medium'>16:9 HTML/CSS viewport</p>
          </div>
          <div className='rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
            <p className='text-xs uppercase tracking-[0.2em] text-slate-400'>Output</p>
            <p className='mt-1 font-medium'>JSON datasource + OSC actions</p>
          </div>
        </div>
      </header>

      <section className='grid min-h-[38rem] gap-6 xl:grid-cols-[18rem,minmax(0,1fr),24rem]'>
        <Panel title='Editorial blocks' eyebrow='Left panel'>
          <div className='space-y-3'>
            {placeholderBlocks.map((blockName, index) => (
              <button
                key={blockName}
                type='button'
                className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  index === 0
                    ? 'border-accent bg-accent/10 text-ink'
                    : 'border-border bg-surface/40 text-muted hover:border-accent/40 hover:text-ink'
                }`}
              >
                <p className='font-semibold'>{blockName}</p>
                <p className='mt-1 text-xs uppercase tracking-[0.18em]'>Block placeholder</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title='Entity collections'
          eyebrow='Middle panel'
          aside={<span className='rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted'>Grouped by type</span>}
        >
          <div className='grid gap-3 md:grid-cols-2'>
            {placeholderCollections.map(({ entityType, count }) => (
              <article key={entityType} className='rounded-2xl border border-border bg-surface/50 p-4'>
                <div className='flex items-center justify-between gap-3'>
                  <h3 className='text-sm font-semibold text-ink'>{entityType}</h3>
                  <span className='rounded-full bg-white px-2.5 py-1 text-xs font-medium text-muted'>{count}</span>
                </div>
                <p className='mt-3 text-sm text-muted'>Independent ordered collection scaffold. Entity relationships are intentionally not implied.</p>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title='Selected entity' eyebrow='Right panel'>
          <div className='flex h-full flex-col gap-4'>
            <div className='rounded-3xl border border-border bg-slate-950 p-4 text-white'>
              <div className='mb-3 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-400'>
                <span>Preview16x9</span>
                <span>No playback controls</span>
              </div>
              <div className='relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.28),_transparent_38%),linear-gradient(135deg,_rgba(15,23,42,1),_rgba(30,41,59,0.92))]'>
                <div className='absolute left-[6%] top-[10%] origin-top-left text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-emerald-300'>
                  Preview Scaffold
                </div>
                <div className='absolute left-[6%] top-[22%] w-[76%] origin-top-left text-[2.1rem] font-semibold leading-tight text-white'>
                  Selected entity content will render here using profile-driven HTML and CSS graphics.
                </div>
                <div className='absolute bottom-[12%] left-[6%] w-[52%] origin-top-left text-sm text-slate-300'>
                  Transform origin defaults to top-left and remains configurable per preview element.
                </div>
              </div>
            </div>

            <div className='grid grid-cols-3 gap-3'>
              {Object.values(actionTypes).map((actionType) => (
                <button
                  key={actionType}
                  type='button'
                  className='rounded-2xl border border-border bg-panel px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent'
                >
                  {actionType}
                </button>
              ))}
            </div>

            <div className='rounded-2xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted'>
              Show profiles and per-element preview configuration files are scaffolded under the settings config storage area.
            </div>
          </div>
        </Panel>
      </section>
    </>
  )
}
