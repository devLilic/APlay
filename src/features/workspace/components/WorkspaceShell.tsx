import { useEffect, useState } from 'react'
import { actionTypes } from '@/core/actions/actionTypes'
import { PreviewCanvas } from '@/features/preview/components/PreviewCanvas'
import { Panel } from '@/shared/ui/panel'
import {
  createWorkspaceSelectionState,
  deriveSelectedEntityContext,
  resolveGroupedEntityLists,
  type EntityGroupKey,
  type WorkspaceSelection,
} from '@/features/workspace/state/workspaceSelectionState'
import {
  createEntityPreviewContent,
  loadWorkspaceShellData,
  resolveGraphicForSelection,
  runWorkspaceGraphicAction,
  type WorkspaceShellData,
} from '@/features/workspace/state/workspaceShellRuntime'
import type { SelectedEntityControlFeedback as WorkspaceActionFeedback } from '@/features/workspace/state/selectedEntityControl'

type ShellLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: WorkspaceShellData }

const entityGroupLabels: Record<EntityGroupKey, string> = {
  titles: 'Titles',
  supertitles: 'Supertitles',
  persons: 'Persons',
  locations: 'Locations',
  breakingNews: 'Breaking News',
  waitingTitles: 'Waiting Titles',
  waitingLocations: 'Waiting Locations',
  phones: 'Phones',
}

export function WorkspaceShell() {
  const [loadState, setLoadState] = useState<ShellLoadState>({ status: 'loading' })
  const [selection, setSelection] = useState<WorkspaceSelection>({})
  const [feedback, setFeedback] = useState<WorkspaceActionFeedback | null>(null)

  useEffect(() => {
    try {
      const data = loadWorkspaceShellData()
      const initialState = createWorkspaceSelectionState(data.document)
      setLoadState({ status: 'ready', data })
      setSelection(initialState.selection)
    } catch (error) {
      setLoadState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown workspace error',
      })
    }
  }, [])

  if (loadState.status === 'loading') {
    return (
      <div className='rounded-[2rem] border border-border/80 bg-panel p-10 shadow-panel'>
        <p className='text-sm font-medium text-muted'>Loading APlay workspace...</p>
      </div>
    )
  }

  if (loadState.status === 'error') {
    return (
      <div className='rounded-[2rem] border border-rose-200 bg-rose-50 p-10 shadow-panel'>
        <p className='text-sm font-semibold text-rose-700'>Workspace failed to load</p>
        <p className='mt-2 text-sm text-rose-600'>{loadState.message}</p>
      </div>
    )
  }

  const workspace = createWorkspaceSelectionState(loadState.data.document, selection)
  const selectedBlock = workspace.getSelectedBlock()
  const groupedLists = resolveGroupedEntityLists(workspace.document, workspace.selection)
  const selectedEntity = deriveSelectedEntityContext(workspace.document, workspace.selection)
  const selectedGraphic = resolveGraphicForSelection(loadState.data.graphicsByEntityType, selectedEntity)
  const previewContent = createEntityPreviewContent(selectedEntity)

  const handleBlockSelect = (blockIndex: number) => {
    setSelection(workspace.selectBlock(blockIndex).selection)
    setFeedback(null)
  }

  const handleGroupSelect = (entityGroup: EntityGroupKey) => {
    setSelection(workspace.selectEntityGroup(entityGroup).selection)
    setFeedback(null)
  }

  const handleEntitySelect = (entityGroup: EntityGroupKey, entityIndex: number) => {
    const nextState = workspace.selectEntityGroup(entityGroup).selectEntity(entityIndex)
    setSelection(nextState.selection)
    setFeedback(null)
  }

  const handleAction = (actionType: (typeof actionTypes)[keyof typeof actionTypes]) => {
    setFeedback(runWorkspaceGraphicAction(actionType, selectedEntity))
  }

  return (
    <>
      <header className='flex flex-col gap-4 rounded-[2rem] border border-border/80 bg-slate-950 px-6 py-6 text-slate-50 shadow-panel lg:flex-row lg:items-end lg:justify-between'>
        <div className='space-y-3'>
          <p className='text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300'>APlay V1</p>
          <div className='space-y-2'>
            <h1 className='text-3xl font-semibold tracking-tight'>Editorial graphics control shell</h1>
            <p className='max-w-3xl text-sm text-slate-300'>
              Blocks drive the left panel, grouped entity collections fill the middle panel, and the right panel previews and triggers the selected graphic.
            </p>
          </div>
        </div>
        <div className='grid gap-2 text-sm text-slate-200 sm:grid-cols-3'>
          <StatCard label='Profile' value={loadState.data.activeProfileLabel} />
          <StatCard label='Blocks' value={String(workspace.document.blocks.length)} />
          <StatCard label='Diagnostics' value={String(loadState.data.diagnostics.length)} />
        </div>
      </header>

      {loadState.data.diagnostics.length > 0 ? (
        <div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700'>
          {loadState.data.diagnostics.join(' | ')}
        </div>
      ) : null}

      <section className='grid min-h-[40rem] gap-6 xl:grid-cols-[18rem,minmax(0,1fr),25rem]'>
        <Panel title='Editorial blocks' eyebrow='Left panel'>
          {workspace.document.blocks.length === 0 ? (
            <EmptyState title='No source data' description='Load a CSV source to populate editorial blocks.' />
          ) : (
            <div className='space-y-3'>
              {workspace.document.blocks.map((block, index) => {
                const isSelected = workspace.selection.selectedBlockIndex === index

                return (
                  <button
                    key={block.name}
                    type='button'
                    onClick={() => handleBlockSelect(index)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      isSelected
                        ? 'border-accent bg-accent/10 text-ink'
                        : 'border-border bg-surface/40 text-muted hover:border-accent/40 hover:text-ink'
                    }`}
                  >
                    <div className='flex items-center justify-between gap-3'>
                      <p className='font-semibold'>{block.name}</p>
                      <span className='rounded-full bg-white px-2.5 py-1 text-xs font-medium text-muted'>
                        {countBlockEntities(block)}
                      </span>
                    </div>
                    <p className='mt-1 text-xs uppercase tracking-[0.18em]'>Editorial block</p>
                  </button>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel
          title='Entity collections'
          eyebrow='Middle panel'
          aside={<span className='rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted'>Grouped by type</span>}
        >
          {!selectedBlock ? (
            <EmptyState title='No selected block' description='Choose a block from the left panel to inspect its entity collections.' />
          ) : (
            <div className='grid gap-3 md:grid-cols-2'>
              {groupedLists.map((group) => {
                const isSelectedGroup = workspace.selection.selectedEntityGroup === group.entityType

                return (
                  <article key={group.entityType} className={`rounded-2xl border p-4 ${isSelectedGroup ? 'border-accent bg-accent/5' : 'border-border bg-surface/40'}`}>
                    <button type='button' onClick={() => handleGroupSelect(group.entityType)} className='flex w-full items-center justify-between gap-3 text-left'>
                      <h3 className='text-sm font-semibold text-ink'>{entityGroupLabels[group.entityType]}</h3>
                      <span className='rounded-full bg-white px-2.5 py-1 text-xs font-medium text-muted'>{group.items.length}</span>
                    </button>

                    {group.items.length === 0 ? (
                      <p className='mt-3 text-sm text-muted'>No entries in this collection.</p>
                    ) : (
                      <div className='mt-3 space-y-2'>
                        {group.items.map((item, index) => {
                          const isSelectedItem = isSelectedGroup && workspace.selection.selectedEntityIndex === index

                          return (
                            <button
                              key={`${group.entityType}-${index}`}
                              type='button'
                              onClick={() => handleEntitySelect(group.entityType, index)}
                              className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                                isSelectedItem
                                  ? 'border-accent bg-white text-ink'
                                  : 'border-border/80 bg-white/70 text-muted hover:border-accent/40 hover:text-ink'
                              }`}
                            >
                              {formatEntityLabel(item)}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel title='Selected entity' eyebrow='Right panel'>
          {!selectedEntity || !selectedGraphic ? (
            <div className='flex h-full flex-col gap-4'>
              <div className='rounded-3xl border border-border bg-slate-950 p-4 text-white'>
                <div className='mb-3 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-400'>
                  <span>Preview16x9</span>
                  <span>No playback controls</span>
                </div>
                <div className='aspect-video rounded-2xl border border-white/10 bg-white/5' />
              </div>
              <EmptyState title='No selected entity' description='Choose an item from the middle panel to preview and trigger its graphic.' />
            </div>
          ) : (
            <div className='flex h-full flex-col gap-4'>
              <div className='rounded-3xl border border-border bg-slate-950 p-4 text-white'>
                <div className='mb-3 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-400'>
                  <span>Preview16x9</span>
                  <span>{selectedGraphic.id}</span>
                </div>
                <PreviewCanvas template={selectedGraphic.preview} content={previewContent} />
              </div>

              <div className='rounded-2xl border border-border bg-surface/30 p-4'>
                <p className='text-xs font-semibold uppercase tracking-[0.22em] text-muted'>Selected content</p>
                <p className='mt-2 text-sm font-semibold text-ink'>{formatEntityLabel(selectedEntity.entity)}</p>
                <p className='mt-1 text-sm text-muted'>
                  Block: {selectedEntity.blockName} | Collection: {entityGroupLabels[selectedEntity.entityGroup]}
                </p>
              </div>

              <div className='grid grid-cols-3 gap-3'>
                {Object.values(actionTypes).map((actionType) => (
                  <button
                    key={actionType}
                    type='button'
                    onClick={() => handleAction(actionType)}
                    className='rounded-2xl border border-border bg-panel px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent'
                  >
                    {actionType === 'playGraphic' ? 'Play' : actionType === 'stopGraphic' ? 'Stop' : 'Resume'}
                  </button>
                ))}
              </div>

              {feedback ? (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                  <p className='font-semibold'>{feedback.title}</p>
                  <div className='mt-1 space-y-1'>
                    {feedback.details.map((detail) => <p key={detail}>{detail}</p>)}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Panel>
      </section>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-2xl border border-white/10 bg-white/5 px-4 py-3'>
      <p className='text-xs uppercase tracking-[0.2em] text-slate-400'>{label}</p>
      <p className='mt-1 font-medium'>{value}</p>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className='rounded-2xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted'>
      <p className='font-semibold text-ink'>{title}</p>
      <p className='mt-1'>{description}</p>
    </div>
  )
}

function formatEntityLabel(entity: unknown): string {
  if (!entity || typeof entity !== 'object') {
    return ''
  }

  if ('text' in entity && typeof entity.text === 'string') {
    return entity.text
  }

  if ('name' in entity && typeof entity.name === 'string') {
    const role = 'role' in entity && typeof entity.role === 'string' ? ` | ${entity.role}` : ''
    return `${entity.name}${role}`
  }

  if ('value' in entity && typeof entity.value === 'string') {
    return entity.value
  }

  if ('label' in entity && typeof entity.label === 'string' && 'number' in entity && typeof entity.number === 'string') {
    return `${entity.label} | ${entity.number}`
  }

  return ''
}

function countBlockEntities(block: WorkspaceShellData['document']['blocks'][number]): number {
  return [block.titles.length, block.supertitles.length, block.persons.length, block.locations.length, block.breakingNews.length, block.waitingTitles.length, block.waitingLocations.length, block.phones.length].reduce((total, count) => total + count, 0)
}
