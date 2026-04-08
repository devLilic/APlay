import { useEffect, useRef, useState } from 'react'
import { actionTypes } from '@/core/actions/actionTypes'
import { PreviewCanvas } from '@/features/preview/components/PreviewCanvas'
import { SettingsPanel, type SettingsFeedback } from '@/features/settings/components/SettingsPanel'
import { Panel } from '@/shared/ui/panel'
import {
  createWorkspaceSelectionState,
  deriveBlockList,
  deriveSelectedEntityContext,
  resolveGroupedEntityLists,
  type EntityGroupKey,
  type WorkspaceSelection,
} from '@/features/workspace/state/workspaceSelectionState'
import {
  createEntityPreviewContent,
  createDefaultWorkspaceConfigSnapshot,
  createWorkspaceSnapshotFromSettings,
  loadWorkspaceShellData,
  runWorkspaceGraphicDebugAction,
  resolveGraphicForSelection,
  runWorkspaceGraphicAction,
  type WorkspaceShellData,
} from '@/features/workspace/state/workspaceShellRuntime'
import type { SelectedEntityControlFeedback as WorkspaceActionFeedback } from '@/features/workspace/state/selectedEntityControl'
import type { GraphicInstanceConfig } from '@/settings/models/appConfig'
import {
  importGraphicConfigToLibrary,
  type GraphicConfigLibraryImportResult,
} from '@/settings/storage/graphicConfigImport'
import {
  importProfileConfigToLibrary,
  type ProfileLibraryImportResult,
} from '@/settings/storage/profileConfigImport'
import { createWorkspaceConfigRepository, type WorkspaceConfigRepository, type WorkspaceConfigSnapshot } from '@/settings/storage/workspaceConfigRepository'
import { resolveActivePreviewBackground } from '@/settings/utils/previewBackgrounds'

type ShellLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: WorkspaceConfigSnapshot; data: WorkspaceShellData }

type CollectionColumnIndex = 0 | 1
type PendingImportSummary =
  | {
    kind: 'graphic'
    filePath: string
    content: string
    preview: GraphicConfigLibraryImportResult
  }
  | {
    kind: 'profile'
    filePath: string
    content: string
    preview: ProfileLibraryImportResult
  }

interface EntityCollectionLayout {
  order: EntityGroupKey[]
  columns: Record<EntityGroupKey, CollectionColumnIndex>
}

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
  const [settingsFeedback, setSettingsFeedback] = useState<SettingsFeedback | null>(null)
  const [sourceRefreshFeedback, setSourceRefreshFeedback] = useState<SettingsFeedback | null>(null)
  const [isImportingGraphicConfig, setIsImportingGraphicConfig] = useState(false)
  const [isImportingProfile, setIsImportingProfile] = useState(false)
  const [pendingImportSummary, setPendingImportSummary] = useState<PendingImportSummary | null>(null)
  const [collectionLayout, setCollectionLayout] = useState<EntityCollectionLayout>(() => createInitialCollectionLayout())
  const [draggedGroup, setDraggedGroup] = useState<EntityGroupKey | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const repositoryRef = useRef<WorkspaceConfigRepository | null>(null)

  useEffect(() => {
    try {
      const repository = createWorkspaceConfigRepository(
        window.localStorage,
        createDefaultWorkspaceConfigSnapshot(),
      )
      repositoryRef.current = repository
      const snapshot = repository.load()
      const data = loadWorkspaceShellData(snapshot)
      const initialState = createWorkspaceSelectionState(data.document)
      setLoadState({ status: 'ready', snapshot, data })
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

  const workspaceData = loadState.data
  const workspace = createWorkspaceSelectionState(workspaceData.document, selection)
  const blockList = deriveBlockList(workspaceData.document)
  const selectedBlock = workspace.getSelectedBlock()
  const groupedLists = resolveGroupedEntityLists(workspace.document, workspace.selection)
  const orderedGroupedLists = orderGroupedLists(groupedLists, collectionLayout)
  const groupedListColumns = splitGroupedListsIntoColumns(orderedGroupedLists, collectionLayout)
  const selectedEntity = deriveSelectedEntityContext(workspace.document, workspace.selection)
  const selectedGraphic = resolveGraphicForSelection(workspaceData.graphicsByEntityType, selectedEntity)
  const previewContent = createEntityPreviewContent(selectedEntity)
  const selectedBackground = resolveActivePreviewBackground(loadState.snapshot.settings, selectedGraphic)
  const applyWorkspaceSnapshot = (snapshot: WorkspaceConfigSnapshot) => {
    const nextData = loadWorkspaceShellData(snapshot)
    setLoadState({
      status: 'ready',
      snapshot,
      data: nextData,
    })
    setSelection((currentSelection) =>
      createWorkspaceSelectionState(nextData.document, currentSelection).selection)
  }

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

  const handleAction = async (actionType: (typeof actionTypes)[keyof typeof actionTypes]) => {
    setFeedback(await runWorkspaceGraphicAction(
      actionType,
      selectedEntity,
      workspaceData.graphicsByEntityType,
      loadState.snapshot.settings.osc,
    ))
  }

  const handleCollectionColumnDrop = (column: CollectionColumnIndex) => {
    if (!draggedGroup) {
      return
    }

    setCollectionLayout((currentLayout) => moveCollectionGroup(currentLayout, draggedGroup, column))
    setDraggedGroup(null)
  }

  const handleCollectionGroupDrop = (
    targetGroup: EntityGroupKey,
    targetColumn: CollectionColumnIndex,
  ) => {
    if (!draggedGroup || draggedGroup === targetGroup) {
      return
    }

    setCollectionLayout((currentLayout) =>
      moveCollectionGroup(currentLayout, draggedGroup, targetColumn, targetGroup))
    setDraggedGroup(null)
  }

  const handleSettingsChange = (settings: WorkspaceConfigSnapshot['settings']) => {
    const nextSnapshot = createWorkspaceSnapshotFromSettings(settings)
    applyWorkspaceSnapshot(nextSnapshot)
    setSettingsFeedback(null)
    setSourceRefreshFeedback(null)
    setFeedback(null)
    setPendingImportSummary(null)
  }

  const handleSettingsSave = () => {
    try {
      const repository = repositoryRef.current
      if (!repository) {
        throw new Error('Settings repository is unavailable.')
      }

      const savedSnapshot = repository.save(loadState.snapshot.settings)
      applyWorkspaceSnapshot(savedSnapshot)
      setSettingsFeedback({
        kind: 'success',
        message: 'Settings saved. Updated profile and graphic config files were persisted for the current workstation.',
      })
      setSourceRefreshFeedback(null)
      setPendingImportSummary(null)
    } catch (error) {
      setSettingsFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Settings save failed.',
      })
    }
  }

  const handleSettingsReload = () => {
    try {
      const repository = repositoryRef.current
      if (!repository) {
        throw new Error('Settings repository is unavailable.')
      }

      const snapshot = repository.load()
      applyWorkspaceSnapshot(snapshot)
      setSettingsFeedback({
        kind: 'success',
        message: 'Persisted settings reloaded.',
      })
      setSourceRefreshFeedback(null)
      setFeedback(null)
      setPendingImportSummary(null)
    } catch (error) {
      setSettingsFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Settings reload failed.',
      })
    }
  }

  const handleExportGraphicConfig = async (graphic: GraphicInstanceConfig) => {
    try {
      if (!window.settingsApi?.exportGraphicConfig) {
        throw new Error('Graphic config export is unavailable in this environment.')
      }

      const filePath = await window.settingsApi.exportGraphicConfig(graphic, graphic.dataFileName)

      if (!filePath) {
        setSettingsFeedback(null)
        return
      }

      setSettingsFeedback({
        kind: 'success',
        message: `Graphic config exported to ${filePath}.`,
      })
    } catch (error) {
      setSettingsFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Graphic config export failed.',
      })
    }
  }

  const handleExportProfile = async (profileId: string) => {
    try {
      if (!window.settingsApi?.exportProfileConfig) {
        throw new Error('Profile export is unavailable in this environment.')
      }

      const profile = loadState.snapshot.settings.profiles.find((candidate) => candidate.id === profileId)
      if (!profile) {
        throw new Error(`Selected profile is unavailable: ${profileId}`)
      }

      const filePath = await window.settingsApi.exportProfileConfig(
        loadState.snapshot.settings,
        profileId,
        `${profile.id}.profile.json`,
      )

      if (!filePath) {
        setSettingsFeedback(null)
        return
      }

      setSettingsFeedback({
        kind: 'success',
        message: `Profile export saved to ${filePath}.`,
      })
    } catch (error) {
      setSettingsFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Profile export failed.',
      })
    }
  }

  const handleImportGraphicConfig = async () => {
    const repository = repositoryRef.current
    if (!repository) {
      setSettingsFeedback({
        kind: 'error',
        message: 'Settings repository is unavailable.',
      })
      return
    }

    try {
      if (!window.settingsApi?.pickGraphicConfigImportFile || !window.settingsApi?.readTextFile) {
        throw new Error('Graphic config import is unavailable in this environment.')
      }

      setIsImportingGraphicConfig(true)
      const filePath = await window.settingsApi.pickGraphicConfigImportFile()
      if (!filePath) {
        return
      }

      const fileContent = await window.settingsApi.readTextFile(filePath)
      if (!fileContent) {
        throw new Error(`Unable to read graphic config import file: ${filePath}`)
      }

      const preview = importGraphicConfigToLibrary({
        content: fileContent,
        settings: loadState.snapshot.settings,
        graphicFiles: loadState.snapshot.graphicFiles,
      })
      setPendingImportSummary({
        kind: 'graphic',
        filePath,
        content: fileContent,
        preview,
      })
      setSettingsFeedback(null)
    } catch (error) {
      setSettingsFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Graphic config import failed.',
      })
    } finally {
      setIsImportingGraphicConfig(false)
    }
  }

  const handleImportProfile = async () => {
    const repository = repositoryRef.current
    if (!repository) {
      setSettingsFeedback({
        kind: 'error',
        message: 'Settings repository is unavailable.',
      })
      return
    }

    try {
      if (!window.settingsApi?.pickProfileConfigImportFile || !window.settingsApi?.readTextFile) {
        throw new Error('Profile import is unavailable in this environment.')
      }

      setIsImportingProfile(true)
      const filePath = await window.settingsApi.pickProfileConfigImportFile()
      if (!filePath) {
        return
      }

      const fileContent = await window.settingsApi.readTextFile(filePath)
      if (!fileContent) {
        throw new Error(`Unable to read profile import file: ${filePath}`)
      }

      const preview = importProfileConfigToLibrary({
        content: fileContent,
        settings: loadState.snapshot.settings,
        graphicFiles: loadState.snapshot.graphicFiles,
      })
      setPendingImportSummary({
        kind: 'profile',
        filePath,
        content: fileContent,
        preview,
      })
      setSettingsFeedback(null)
    } catch (error) {
      setSettingsFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Profile import failed.',
      })
    } finally {
      setIsImportingProfile(false)
    }
  }

  const handleConfirmImport = () => {
    const repository = repositoryRef.current
    if (!repository || !pendingImportSummary) {
      return
    }

    try {
      if (pendingImportSummary.kind === 'graphic') {
        const result = repository.importGraphicConfig(pendingImportSummary.content)
        applyWorkspaceSnapshot({
          settings: result.settings,
          graphicFiles: result.graphicFiles,
        })
        setSettingsFeedback({
          kind: 'success',
          message: createGraphicImportFeedbackMessage(result, pendingImportSummary.filePath),
        })
      } else {
        const result = repository.importProfileConfig(pendingImportSummary.content)
        applyWorkspaceSnapshot({
          settings: result.settings,
          graphicFiles: result.graphicFiles,
        })
        setSettingsFeedback({
          kind: 'success',
          message: createProfileImportFeedbackMessage(result, pendingImportSummary.filePath),
        })
      }

      setSourceRefreshFeedback(null)
      setFeedback(null)
      setPendingImportSummary(null)
    } catch (error) {
      setSettingsFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Import failed.',
      })
    }
  }

  const handleTestOscCommand = async (
    graphic: GraphicInstanceConfig,
    actionType: (typeof actionTypes)[keyof typeof actionTypes],
  ) => {
    const result = await runWorkspaceGraphicDebugAction(
      actionType,
      graphic,
      loadState.snapshot.settings.osc,
      previewContent,
    )

    setSettingsFeedback({
      kind: result.kind,
      message: result.kind === 'success'
        ? `${graphic.id}: ${result.details.join(' | ')}`
        : `${graphic.id}: ${result.details.join(' | ')}`,
    })
  }

  const handleSourceRefresh = () => {
    try {
      const nextData = loadWorkspaceShellData(loadState.snapshot)
      setLoadState({
        status: 'ready',
        snapshot: loadState.snapshot,
        data: nextData,
      })
      setSelection((currentSelection) =>
        createWorkspaceSelectionState(nextData.document, currentSelection).selection)
      setSourceRefreshFeedback({
        kind: 'success',
        message: nextData.activeSourceFilePath
          ? `Source refreshed from ${nextData.activeSourceFilePath}.`
          : 'Source refreshed.',
      })
      setFeedback(null)
    } catch (error) {
      setSourceRefreshFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Source refresh failed.',
      })
    }
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
          <StatCard label='Profile' value={workspaceData.activeProfileLabel} />
          <StatCard label='Blocks' value={String(blockList.length)} />
          <StatCard label='Diagnostics' value={String(workspaceData.diagnostics.length)} />
        </div>
      </header>

      <div className='flex flex-wrap justify-end gap-3'>
        <button
          type='button'
          onClick={handleSourceRefresh}
          className='rounded-2xl border border-border bg-panel px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent'
        >
          Refresh source
        </button>
        <button
          type='button'
          onClick={() => setShowSettings((current) => !current)}
          className='rounded-2xl border border-border bg-panel px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent'
        >
          {showSettings ? 'Hide settings' : 'Open settings'}
        </button>
      </div>

      {sourceRefreshFeedback ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${sourceRefreshFeedback.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {sourceRefreshFeedback.message}
        </div>
      ) : null}

      {showSettings ? (
        <SettingsPanel
          settings={loadState.snapshot.settings}
          diagnostics={workspaceData.diagnostics}
          feedback={settingsFeedback}
          selectedGraphic={selectedGraphic}
          previewContent={previewContent}
          isImportingGraphicConfig={isImportingGraphicConfig}
          isImportingProfile={isImportingProfile}
          pendingImportSummary={pendingImportSummary}
          onSettingsChange={handleSettingsChange}
          onSave={handleSettingsSave}
          onReload={handleSettingsReload}
          onImportGraphicConfig={handleImportGraphicConfig}
          onImportProfile={handleImportProfile}
          onConfirmImport={handleConfirmImport}
          onCancelImport={() => setPendingImportSummary(null)}
          onExportGraphicConfig={handleExportGraphicConfig}
          onExportProfile={handleExportProfile}
          onTestOscCommand={handleTestOscCommand}
        />
      ) : null}

      {workspaceData.diagnostics.length > 0 ? (
        <div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700'>
          {workspaceData.diagnostics.join(' | ')}
        </div>
      ) : null}

      <section className='grid min-h-[40rem] gap-6 xl:grid-cols-[16rem,minmax(0,0.7fr),minmax(28rem,1.3fr)]'>
        <Panel title='Editorial blocks' eyebrow='Left panel'>
          {blockList.length === 0 ? (
            <EmptyState title='No source data' description='Load a CSV source to populate editorial blocks.' />
          ) : (
            <div className='space-y-3'>
              {blockList.map((block, index) => {
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
              {groupedListColumns.map((columnGroups, columnIndex) => (
                <div
                  key={columnIndex}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleCollectionColumnDrop(columnIndex as CollectionColumnIndex)}
                  className='flex min-h-[12rem] flex-col gap-3 rounded-2xl border border-dashed border-border/80 bg-surface/20 p-2'
                >
                  {columnGroups.map((group) => {
                    const isSelectedGroup = workspace.selection.selectedEntityGroup === group.entityType
                    const isEmptyGroup = group.items.length === 0
                    const isDragging = draggedGroup === group.entityType

                    return (
                      <article
                        key={group.entityType}
                        draggable
                        onDragStart={() => setDraggedGroup(group.entityType)}
                        onDragEnd={() => setDraggedGroup(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault()
                          handleCollectionGroupDrop(group.entityType, columnIndex as CollectionColumnIndex)
                        }}
                        className={`rounded-2xl border p-4 transition ${
                          isSelectedGroup ? 'border-accent bg-accent/5' : 'border-border bg-surface/40'
                        } ${
                          isDragging ? 'opacity-60' : ''
                        }`}
                      >
                        <button
                          type='button'
                          onClick={() => handleGroupSelect(group.entityType)}
                          className='flex w-full items-center justify-between gap-3 text-left'
                        >
                          <div className='min-w-0'>
                            <h3 className='text-sm font-semibold text-ink'>{entityGroupLabels[group.entityType]}</h3>
                            <p className='mt-1 text-[11px] uppercase tracking-[0.18em] text-muted'>
                              {isEmptyGroup ? 'Collapsed empty collection' : 'Drag to reorder'}
                            </p>
                          </div>
                          <div className='flex items-center gap-2'>
                            <span className='rounded-full bg-white px-2.5 py-1 text-xs font-medium text-muted'>{group.items.length}</span>
                            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Drag</span>
                          </div>
                        </button>

                        {!isEmptyGroup ? (
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
                                  {formatEntityCollectionLabel(item)}
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              ))}
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
                <PreviewCanvas
                  template={selectedGraphic.preview}
                  content={previewContent}
                  backgroundImagePath={selectedBackground.resolvedFilePath}
                />
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

function createGraphicImportFeedbackMessage(
  result: ReturnType<WorkspaceConfigRepository['importGraphicConfig']>,
  filePath: string,
): string {
  const outcome = result.status === 'added'
    ? 'added to the local library'
    : result.status === 'replaced'
      ? 'replaced the existing local config'
      : result.status === 'duplicated'
        ? `was duplicated as "${result.importedGraphic.id}"`
        : 'matched an existing local config and was preserved'

  return `Graphic config import completed. "${result.importedGraphic.id}" ${outcome}. Source file: ${filePath}.`
}

function createProfileImportFeedbackMessage(
  result: ReturnType<WorkspaceConfigRepository['importProfileConfig']>,
  filePath: string,
): string {
  const details: string[] = [`Profile "${result.importedProfile.label}" imported from ${filePath}.`]

  if (result.conflicts.profile) {
    details.push(`Profile conflict policy: ${result.conflicts.profile}.`)
  }
  if (result.conflicts.graphics.length > 0) {
    details.push(`Graphic conflicts handled: ${result.conflicts.graphics.length}.`)
  }
  if (result.conflicts.schemas.length > 0) {
    details.push(`Schema conflicts handled: ${result.conflicts.schemas.length}.`)
  }
  if (result.conflicts.referenceImages.length > 0) {
    details.push(`Reference image conflicts handled: ${result.conflicts.referenceImages.length}.`)
  }

  return details.join(' ')
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

function formatEntityCollectionLabel(entity: unknown): string {
  if (!entity || typeof entity !== 'object') {
    return ''
  }

  if (
    'text' in entity &&
    typeof entity.text === 'string' &&
    'number' in entity &&
    typeof entity.number === 'string'
  ) {
    return `${entity.number} ${entity.text}`.trim()
  }

  return formatEntityLabel(entity)
}

function countBlockEntities(block: WorkspaceShellData['document']['blocks'][number]): number {
  return [block.titles.length, block.supertitles.length, block.persons.length, block.locations.length, block.breakingNews.length, block.waitingTitles.length, block.waitingLocations.length, block.phones.length].reduce((total, count) => total + count, 0)
}

function createInitialCollectionLayout(): EntityCollectionLayout {
  const order = Object.keys(entityGroupLabels) as EntityGroupKey[]

  return {
    order,
    columns: Object.fromEntries(
      order.map((group, index) => [group, (index % 2) as CollectionColumnIndex]),
    ) as Record<EntityGroupKey, CollectionColumnIndex>,
  }
}

function orderGroupedLists(
  groupedLists: ReturnType<typeof resolveGroupedEntityLists>,
  layout: EntityCollectionLayout,
) {
  const groupedListMap = new Map(groupedLists.map((group) => [group.entityType, group]))

  return layout.order
    .map((entityGroup) => groupedListMap.get(entityGroup))
    .filter((group): group is (typeof groupedLists)[number] => group !== undefined)
}

function splitGroupedListsIntoColumns(
  groupedLists: ReturnType<typeof resolveGroupedEntityLists>,
  layout: EntityCollectionLayout,
) {
  return [
    groupedLists.filter((group) => layout.columns[group.entityType] === 0),
    groupedLists.filter((group) => layout.columns[group.entityType] === 1),
  ] as const
}

function moveCollectionGroup(
  layout: EntityCollectionLayout,
  draggedGroup: EntityGroupKey,
  targetColumn: CollectionColumnIndex,
  targetBeforeGroup?: EntityGroupKey,
): EntityCollectionLayout {
  const orderWithoutDragged = layout.order.filter((group) => group !== draggedGroup)
  const nextColumns = {
    ...layout.columns,
    [draggedGroup]: targetColumn,
  }

  const targetIndex = targetBeforeGroup
    ? orderWithoutDragged.findIndex((group) => group === targetBeforeGroup)
    : -1

  const nextOrder = [...orderWithoutDragged]
  if (targetIndex >= 0) {
    nextOrder.splice(targetIndex, 0, draggedGroup)
  } else {
    const lastIndexInTargetColumn = nextOrder.reduce((result, group, index) => (
      nextColumns[group] === targetColumn ? index : result
    ), -1)
    nextOrder.splice(lastIndexInTargetColumn + 1, 0, draggedGroup)
  }

  return {
    order: nextOrder,
    columns: nextColumns,
  }
}
