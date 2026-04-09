import { useEffect, useRef, useState } from 'react'
import { actionTypes } from '@/core/actions/actionTypes'
import { PreviewCanvas } from '@/features/preview/components/PreviewCanvas'
import { useNotificationStore } from '@/features/notifications/notificationsContext'
import { SettingsPanel, type SettingsFeedback } from '@/features/settings/components/SettingsPanel'
import { Panel } from '@/shared/ui/panel'
import {
  createWorkspaceSelectionState,
  deriveBlockList,
  deriveSelectedEntityContext,
  resolveGraphicConfigEntityLists,
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
  runWorkspaceMultiGraphicAction,
  type WorkspaceShellData,
} from '@/features/workspace/state/workspaceShellRuntime'
import type { SelectedEntityControlFeedback as WorkspaceActionFeedback } from '@/features/workspace/state/selectedEntityControl'
import {
  formatEntityCollectionLabel,
  formatEntityLabel,
} from '@/features/workspace/state/entityCollectionLabels'
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
import { getControlButtonClassName, getSelectableItemClassName, getStateBadgeClassName } from '@/shared/ui/theme'
import { publishWorkspaceShellNotifications } from '@/features/workspace/components/workspaceShellNotifications'

type ShellLoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; snapshot: WorkspaceConfigSnapshot; data: WorkspaceShellData }

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

export function WorkspaceShell() {
  const notificationStore = useNotificationStore()
  const [loadState, setLoadState] = useState<ShellLoadState>({ status: 'loading' })
  const [selection, setSelection] = useState<WorkspaceSelection>({})
  const [feedback, setFeedback] = useState<WorkspaceActionFeedback | null>(null)
  const [settingsFeedback, setSettingsFeedback] = useState<SettingsFeedback | null>(null)
  const [sourceRefreshFeedback, setSourceRefreshFeedback] = useState<SettingsFeedback | null>(null)
  const [isImportingGraphicConfig, setIsImportingGraphicConfig] = useState(false)
  const [isImportingProfile, setIsImportingProfile] = useState(false)
  const [pendingImportSummary, setPendingImportSummary] = useState<PendingImportSummary | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [blockFilter, setBlockFilter] = useState('')
  const repositoryRef = useRef<WorkspaceConfigRepository | null>(null)
  const lastSourceRefreshFeedbackRef = useRef<SettingsFeedback | null>(null)
  const lastSettingsFeedbackRef = useRef<SettingsFeedback | null>(null)
  const lastExecutionFeedbackRef = useRef<WorkspaceActionFeedback | null>(null)

  useEffect(() => {
    if (!sourceRefreshFeedback || lastSourceRefreshFeedbackRef.current === sourceRefreshFeedback) {
      return
    }

    publishWorkspaceShellNotifications({
      store: notificationStore,
      sourceRefreshFeedback,
      settingsFeedback: null,
      executionFeedback: null,
    })
    lastSourceRefreshFeedbackRef.current = sourceRefreshFeedback
  }, [notificationStore, sourceRefreshFeedback])

  useEffect(() => {
    if (!settingsFeedback || lastSettingsFeedbackRef.current === settingsFeedback) {
      return
    }

    publishWorkspaceShellNotifications({
      store: notificationStore,
      sourceRefreshFeedback: null,
      settingsFeedback,
      executionFeedback: null,
    })
    lastSettingsFeedbackRef.current = settingsFeedback
  }, [notificationStore, settingsFeedback])

  useEffect(() => {
    if (!feedback || lastExecutionFeedbackRef.current === feedback) {
      return
    }

    publishWorkspaceShellNotifications({
      store: notificationStore,
      sourceRefreshFeedback: null,
      settingsFeedback: null,
      executionFeedback: feedback,
    })
    lastExecutionFeedbackRef.current = feedback
  }, [feedback, notificationStore])

  useEffect(() => {
    try {
      const repository = createWorkspaceConfigRepository(
        window.localStorage,
        createDefaultWorkspaceConfigSnapshot(),
      )
      repositoryRef.current = repository
      const snapshot = repository.load()
      const data = loadWorkspaceShellData(snapshot)
      const initialState = createWorkspaceSelectionState(data.document, data.graphics)
      setLoadState({ status: 'ready', snapshot, data })
      setSelection(initialState.selection)
    } catch (error) {
      try {
        const repository = repositoryRef.current ?? createWorkspaceConfigRepository(
          window.localStorage,
          createDefaultWorkspaceConfigSnapshot(),
        )
        repositoryRef.current = repository
        const snapshot = repository.load()

        if (snapshot.settings.profiles.length === 0) {
          setLoadState({
            status: 'ready',
            snapshot,
            data: {
              document: { blocks: [] },
              activeProfileLabel: 'No profile selected',
              activeSourceFilePath: undefined,
              graphics: [],
              graphicsById: {},
              diagnostics: ['Create or import a show profile to begin operating APlay.'],
            },
          })
          setSelection({})
          return
        }
      } catch {
        // Fall through to the error state below when the repository cannot be recovered.
      }

      setLoadState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown workspace error',
      })
    }
  }, [])

  if (loadState.status === 'loading') {
    return (
      <div className='ap-panel p-10'>
        <p className='text-sm font-medium text-text-secondary'>Loading APlay workspace...</p>
      </div>
    )
  }

  if (loadState.status === 'error') {
    return (
      <div className='ap-banner ap-banner-danger p-10'>
        <p className='text-sm font-semibold text-red-200'>Workspace failed to load</p>
        <p className='mt-2 text-sm text-red-300'>{loadState.message}</p>
      </div>
    )
  }

  const workspaceData = loadState.data
  const workspace = createWorkspaceSelectionState(workspaceData.document, workspaceData.graphics, selection)
  const blockList = deriveBlockList(workspaceData.document)
  const selectedBlock = workspace.getSelectedBlock()
  const graphicCollections = resolveGraphicConfigEntityLists(workspace.document, workspace.selection, workspaceData.graphics)
  const selectedEntity = deriveSelectedEntityContext(workspace.document, workspace.selection)
  const selectedGraphic = resolveGraphicForSelection(workspaceData.graphicsById, selectedEntity)
  const selectedMultiItems = workspace.getSelectedItems()
  const multiSelectionCount = workspace.selectedCount()
  const isCompositePreviewActive = multiSelectionCount > 1
  const previewBaseEntity = selectedEntity ?? selectedMultiItems[0]
  const previewGraphic = resolveGraphicForSelection(workspaceData.graphicsById, previewBaseEntity)
  const previewContent = createEntityPreviewContent(previewBaseEntity, previewGraphic)
  const compositePreviewItems = selectedMultiItems.flatMap((item) => {
    const isPreviewBaseItem = (
      previewBaseEntity?.graphicConfigId === item.graphicConfigId &&
      previewBaseEntity.entityIndex === item.entityIndex
    )
    if (isPreviewBaseItem) {
      return []
    }

    const graphic = workspaceData.graphicsById[item.graphicConfigId]
    if (!graphic) {
      return []
    }

    return [{
      graphicConfigId: item.graphicConfigId,
      zIndex: graphic.zIndex,
      template: graphic.preview,
      content: createEntityPreviewContent(item, graphic),
    }]
  })
  const selectedBackground = resolveActivePreviewBackground(loadState.snapshot.settings, previewGraphic)
  const availableProfiles = loadState.snapshot.settings.profiles
  const hasProfiles = availableProfiles.length > 0
  const trimmedBlockFilter = blockFilter.trim().toLowerCase()
  const filteredBlockList = trimmedBlockFilter.length === 0
    ? blockList
    : blockList.filter((block) => block.name.toLowerCase().includes(trimmedBlockFilter))
  const hasSourceLoaded = Boolean(workspaceData.activeSourceFilePath)
  const hasBlocks = blockList.length > 0
  const hasFilteredBlocks = filteredBlockList.length > 0
  const hasGraphicCollections = graphicCollections.length > 0
  const groupedSelectionLabel = multiSelectionCount === 0
    ? 'No grouped items'
    : `${multiSelectionCount} grouped item${multiSelectionCount === 1 ? '' : 's'}`
  const applyWorkspaceSnapshot = (snapshot: WorkspaceConfigSnapshot) => {
    const nextData = loadWorkspaceShellData(snapshot)
    setLoadState({
      status: 'ready',
      snapshot,
      data: nextData,
    })
    setSelection((currentSelection) =>
      createWorkspaceSelectionState(nextData.document, nextData.graphics, currentSelection).selection)
  }

  const handleBlockSelect = (blockIndex: number) => {
    setSelection(workspace.selectBlock(blockIndex).selection)
    setFeedback(null)
  }

  const handleGraphicConfigSelect = (graphicConfigId: string) => {
    setSelection(workspace.selectGraphicConfig(graphicConfigId).selection)
    setFeedback(null)
  }

  const handleProfileSelect = (profileId: string) => {
    if (profileId === loadState.snapshot.settings.selectedProfileId) {
      return
    }

    handleSettingsChange({
      ...loadState.snapshot.settings,
      selectedProfileId: profileId,
    })
  }

  const handleEntitySelect = (graphicConfigId: string, entityIndex: number) => {
    const nextState = workspace.selectGraphicConfig(graphicConfigId).selectEntity(entityIndex)
    setSelection(nextState.selection)
    setFeedback(null)
  }

  const handleMultiSelectionToggle = (graphicConfigId: string, entityIndex: number) => {
    const nextState = workspace.isSelected(graphicConfigId, entityIndex)
      ? workspace.removeSelectedItem(graphicConfigId, entityIndex)
      : workspace.addSelectedItem(graphicConfigId, entityIndex)

    setSelection(nextState.selection)
    setFeedback(null)
  }

  const handleAction = async (actionType: (typeof actionTypes)[keyof typeof actionTypes]) => {
    setFeedback(await runWorkspaceGraphicAction(
      actionType,
      selectedEntity,
      workspaceData.graphicsById,
      loadState.snapshot.settings.osc,
    ))
  }

  const handleGroupedAction = async (actionType: (typeof actionTypes)[keyof typeof actionTypes]) => {
    setFeedback(await runWorkspaceMultiGraphicAction(
      actionType,
      workspace.getSelectedItems(),
      workspaceData.graphicsById,
      loadState.snapshot.settings.osc,
    ))
  }

  const handleClearMultiSelection = () => {
    setSelection(workspace.clearSelectedItems().selection)
    setFeedback(null)
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
        ? `${graphic.name}: ${result.details.join(' | ')}`
        : `${graphic.name}: ${result.details.join(' | ')}`,
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
        createWorkspaceSelectionState(nextData.document, nextData.graphics, currentSelection).selection)
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
      <header className='ap-panel flex flex-col gap-4 bg-surface-panel px-6 py-6 lg:flex-row lg:items-end lg:justify-between'>
        <div className='grid gap-2 text-sm text-text-secondary sm:grid-cols-3'>
          <StatCard label='Profile' value={workspaceData.activeProfileLabel} />
          <StatCard label='Blocks' value={String(blockList.length)} />
          <StatCard label='Diagnostics' value={String(workspaceData.diagnostics.length)} />
        </div>
      </header>

      <div className='flex flex-wrap justify-end gap-3'>
        <button
          type='button'
          onClick={handleSourceRefresh}
          className={getControlButtonClassName()}
        >
          Refresh source
        </button>
        <button
          type='button'
          onClick={() => setShowSettings((current) => !current)}
          className={getControlButtonClassName({
            tone: showSettings ? 'selected' : 'neutral',
            variant: showSettings ? 'solid' : 'outline',
          })}
        >
          {showSettings ? 'Hide settings' : 'Open settings'}
        </button>
      </div>

      {showSettings ? (
        <SettingsPanel
          settings={loadState.snapshot.settings}
          diagnostics={workspaceData.diagnostics}
          feedback={null}
          selectedGraphic={selectedGraphic ?? previewGraphic}
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
        <div className='ap-banner ap-banner-warning'>
          {workspaceData.diagnostics.join(' | ')}
        </div>
      ) : null}

      <section className='grid min-h-0 gap-4 xl:h-[calc(100vh-13.5rem)] xl:grid-cols-[minmax(18rem,22rem),minmax(26rem,1fr),minmax(30rem,42rem)]'>
        <Panel
          title='Navigation'
          eyebrow='Left panel'
          className='overflow-hidden'
          contentClassName='gap-4 overflow-hidden'
          aside={selectedBlock ? <span className={getStateBadgeClassName('selected')}>Block active</span> : null}
        >
          {!hasProfiles ? (
            <EmptyState title='No profile' description='Create or import a show profile before loading source content and graphics.' />
          ) : (
            <div className='space-y-3'>
              <div className='ap-card p-4'>
                <label className='block text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary' htmlFor='workspace-profile-select'>
                  Show profile
                </label>
                <select
                  id='workspace-profile-select'
                  value={loadState.snapshot.settings.selectedProfileId}
                  onChange={(event) => handleProfileSelect(event.target.value)}
                  className='ap-focus mt-3 min-h-11 w-full rounded-lg border border-border bg-surface-app px-3 py-2.5 text-sm text-text-primary'
                >
                  {availableProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.label}
                    </option>
                  ))}
                </select>
                <div className='mt-3 flex flex-wrap items-center gap-2'>
                  <span className={getStateBadgeClassName(hasSourceLoaded ? 'active' : 'warning')}>
                    {hasSourceLoaded ? 'Source loaded' : 'No source loaded'}
                  </span>
                  <span className={getStateBadgeClassName(selectedBlock ? 'selected' : 'disabled')}>
                    {selectedBlock ? selectedBlock.name : 'No block selected'}
                  </span>
                </div>
              </div>

              <div className='ap-card p-4'>
                <label className='block text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary' htmlFor='workspace-block-filter'>
                  Block filter
                </label>
                <input
                  id='workspace-block-filter'
                  type='text'
                  value={blockFilter}
                  onChange={(event) => setBlockFilter(event.target.value)}
                  placeholder='Filter blocks'
                  className='ap-focus mt-3 min-h-11 w-full rounded-lg border border-border bg-surface-app px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled'
                />
              </div>
            </div>
          )}

          <div className='min-h-0 flex-1 overflow-y-auto pr-1'>
            {!hasProfiles ? (
              <EmptyState title='No navigation available' description='A profile is required before blocks and source navigation can appear here.' />
            ) : !hasSourceLoaded ? (
              <EmptyState title='No source loaded' description='Select a profile with a configured source file to populate the block list.' />
            ) : !hasBlocks ? (
              <EmptyState title='No blocks available' description='The current source loaded successfully but produced no editorial blocks.' />
            ) : !hasFilteredBlocks ? (
              <EmptyState title='No matching blocks' description='Adjust the block filter to see the available editorial blocks again.' />
            ) : (
              <div className='space-y-3'>
                {filteredBlockList.map((block) => {
                  const blockIndex = blockList.indexOf(block)
                  const isSelected = workspace.selection.selectedBlockIndex === blockIndex

                  return (
                    <button
                      key={`${block.name}-${blockIndex}`}
                      type='button'
                      onClick={() => handleBlockSelect(blockIndex)}
                      className={[
                        'w-full px-4 py-3 text-left',
                        getSelectableItemClassName({
                          selected: isSelected,
                          interactive: true,
                        }),
                      ].join(' ')}
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0'>
                          <p className='text-sm font-semibold leading-5 text-text-primary break-words'>{block.name}</p>
                          <p className='mt-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary'>Editorial block</p>
                        </div>
                        <span className={getStateBadgeClassName(isSelected ? 'selected' : 'disabled')}>
                          {countBlockEntities(block)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Panel>

        <Panel
          title='Entity collections'
          eyebrow='Center panel'
          className='overflow-hidden'
          contentClassName='gap-4 overflow-hidden'
          aside={<span className={getStateBadgeClassName('multiSelected')}>{groupedSelectionLabel}</span>}
        >
          <div className={multiSelectionCount > 0 ? 'ap-state-multi rounded-xl border p-4' : 'ap-card-muted p-4'}>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary'>Selection status</p>
            <div className='mt-3 flex flex-wrap items-center gap-2'>
              <span className={getStateBadgeClassName(selectedBlock ? 'selected' : 'disabled')}>
                {selectedBlock ? `Active block: ${selectedBlock.name}` : 'No active block'}
              </span>
              <span className={getStateBadgeClassName(multiSelectionCount > 0 ? 'multiSelected' : 'disabled')}>
                {groupedSelectionLabel}
              </span>
              <span className={getStateBadgeClassName(previewGraphic ? (isCompositePreviewActive ? 'active' : 'selected') : 'disabled')}>
                {previewGraphic ? (isCompositePreviewActive ? 'Composite preview' : 'Single preview') : 'No preview target'}
              </span>
            </div>
            <p className='mt-3 text-sm text-text-secondary'>
              Single click sets the preview target. The toggle button adds or removes items from grouped play.
            </p>
          </div>

          <div className='min-h-0 flex-1 overflow-y-auto pr-1'>
            {!hasProfiles ? (
              <EmptyState title='No profile' description='Select or create a profile to reveal grouped entity collections.' />
            ) : !hasSourceLoaded ? (
              <EmptyState title='No source loaded' description='Entity collections appear here after a profile source is configured and loaded.' />
            ) : !selectedBlock ? (
              <EmptyState title='No block selected' description='Choose a block from the left panel to inspect its grouped entity collections.' />
            ) : !hasGraphicCollections ? (
              <EmptyState title='No collections for this block' description='This block does not currently expose any graphic collections for the active profile.' />
            ) : (
              <div className='space-y-3'>
                {graphicCollections.map((group) => {
                  const isSelectedGroup = workspace.selection.selectedGraphicConfigId === group.graphicConfigId
                  const isEmptyGroup = group.items.length === 0

                  return (
                    <article
                      key={group.graphicConfigId}
                      className={[
                        'p-4',
                        getSelectableItemClassName({
                          selected: isSelectedGroup,
                          warning: isEmptyGroup,
                          interactive: false,
                        }),
                      ].join(' ')}
                    >
                      <button
                        type='button'
                        onClick={() => handleGraphicConfigSelect(group.graphicConfigId)}
                        className='ap-focus flex w-full items-start justify-between gap-3 rounded-lg text-left'
                      >
                        <div className='min-w-0'>
                          <h3 className='text-sm font-semibold leading-5 text-text-primary break-words'>{group.graphic.name}</h3>
                          <p className='mt-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary'>
                            {group.graphic.entityType} {isEmptyGroup ? '| Empty collection' : '| Graphic collection'}
                          </p>
                        </div>
                        <div className='flex flex-wrap items-center gap-2'>
                          {isEmptyGroup ? <span className={getStateBadgeClassName('warning')}>Empty</span> : null}
                          <span className={getStateBadgeClassName(isSelectedGroup ? 'selected' : 'disabled')}>
                            {group.items.length}
                          </span>
                        </div>
                      </button>

                      {isEmptyGroup ? (
                        <div className='mt-3'>
                          <EmptyState title='Empty collection' description='This graphic group is available, but the active block has no matching items in it yet.' />
                        </div>
                      ) : (
                        <div className='mt-3 space-y-2'>
                          {group.items.map((item, index) => {
                            const isSelectedItem = isSelectedGroup && workspace.selection.selectedEntityIndex === index
                            const isMultiSelected = workspace.isSelected(group.graphicConfigId, index)
                            const groupedSelectionForGroup = workspace.selection.selectedItems?.find(
                              (selectedItem) => selectedItem.graphicConfigId === group.graphicConfigId,
                            )
                            const willReplaceGroupedItem = Boolean(
                              groupedSelectionForGroup &&
                              groupedSelectionForGroup.entityIndex !== index &&
                              !isMultiSelected,
                            )

                            return (
                              <div
                                key={`${group.graphicConfigId}-${index}`}
                                className={[
                                  'rounded-lg p-3',
                                  getSelectableItemClassName({
                                    selected: isSelectedItem,
                                    multiSelected: isMultiSelected,
                                    interactive: false,
                                  }),
                                ].join(' ')}
                              >
                                <div className='flex items-start gap-3'>
                                  <button
                                    type='button'
                                    onClick={() => handleMultiSelectionToggle(group.graphicConfigId, index)}
                                    aria-pressed={isMultiSelected}
                                    className={[
                                      'ap-focus mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold',
                                      isMultiSelected
                                        ? 'border-state-multi bg-state-multi text-slate-950'
                                        : 'border-border bg-surface-app text-text-disabled hover:border-state-multi hover:text-accent',
                                    ].join(' ')}
                                    title={isMultiSelected ? 'Remove from grouped selection' : willReplaceGroupedItem ? 'Replace grouped selection in this collection' : 'Add to grouped selection'}
                                  >
                                    {isMultiSelected ? '✓' : '+'}
                                  </button>
                                  <button
                                    type='button'
                                    onClick={() => handleEntitySelect(group.graphicConfigId, index)}
                                    className='ap-focus min-w-0 flex-1 rounded-lg text-left'
                                  >
                                    <div className='flex flex-wrap items-center justify-between gap-3'>
                                      <div className='min-w-0'>
                                        <p className={`text-sm leading-5 break-words ${isSelectedItem ? 'font-semibold text-text-primary' : 'text-text-primary'}`}>
                                          {formatEntityCollectionLabel(item)}
                                        </p>
                                        <p className='mt-1 text-xs text-text-secondary'>
                                          Item {index + 1} in this collection
                                        </p>
                                      </div>
                                      <div className='flex flex-wrap gap-2'>
                                        {isSelectedItem ? <span className={getStateBadgeClassName('selected')}>Preview</span> : null}
                                        {isMultiSelected ? <span className={getStateBadgeClassName('multiSelected')}>Grouped</span> : null}
                                        {willReplaceGroupedItem ? <span className={getStateBadgeClassName('warning')}>Replaces grouped</span> : null}
                                      </div>
                                    </div>
                                    <div className='mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary'>
                                      <span>{isSelectedItem ? 'Selected for preview' : 'Click to preview'}</span>
                                      <span>{isMultiSelected ? 'Included in grouped play' : willReplaceGroupedItem ? 'Selecting group toggle replaces the current grouped item in this collection' : 'Available for grouped play'}</span>
                                    </div>
                                  </button>
                                  <div className='hidden shrink-0 self-center md:flex'>
                                    <button
                                      type='button'
                                      onClick={() => handleMultiSelectionToggle(group.graphicConfigId, index)}
                                      aria-pressed={isMultiSelected}
                                      className={getControlButtonClassName({
                                        tone: isMultiSelected ? 'accent' : 'neutral',
                                        variant: isMultiSelected ? 'outline' : 'ghost',
                                      })}
                                    >
                                      {isMultiSelected ? 'Grouped' : willReplaceGroupedItem ? 'Replace group' : 'Group'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </Panel>

        <Panel
          title='Preview and execution'
          eyebrow='Right panel'
          className='overflow-hidden'
          contentClassName='gap-4 overflow-y-auto'
          aside={<span className={getStateBadgeClassName(previewGraphic ? (isCompositePreviewActive ? 'active' : 'selected') : 'disabled')}>{previewGraphic ? (isCompositePreviewActive ? 'Composite' : 'Selected') : 'Idle'}</span>}
        >
          <div className='rounded-2xl border border-border-strong bg-surface-app p-4'>
            <div className='mb-4 flex flex-wrap items-start justify-between gap-3'>
              <div>
                <div className='flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em] text-text-secondary'>
                  <span>Preview16x9</span>
                  {multiSelectionCount > 0 ? (
                    <span className={getStateBadgeClassName(isCompositePreviewActive ? 'active' : 'multiSelected')}>
                      {isCompositePreviewActive ? 'Composite preview' : 'Grouped preview'}
                    </span>
                  ) : previewGraphic ? (
                    <span className={getStateBadgeClassName('selected')}>
                      Single-item preview
                    </span>
                  ) : null}
                </div>
                <p className='mt-2 text-base font-semibold text-text-primary'>
                  {selectedGraphic?.name ?? previewGraphic?.name ?? 'No preview target'}
                </p>
                <p className='mt-1 text-sm text-text-secondary'>
                  {multiSelectionCount > 0
                    ? `Preview is showing ${multiSelectionCount} selected item${multiSelectionCount === 1 ? '' : 's'} together.`
                    : selectedEntity && selectedGraphic
                      ? `Previewing ${formatEntityLabel(selectedEntity.entity)} in ${selectedGraphic.name}.`
                      : 'Preview is visual-only. Playback controls are in the dedicated control area below.'}
                </p>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <span className={getStateBadgeClassName(previewGraphic ? (isCompositePreviewActive ? 'active' : 'selected') : 'disabled')}>
                  {previewGraphic ? 'Preview ready' : 'Preview idle'}
                </span>
                <span className={getStateBadgeClassName(multiSelectionCount > 0 ? 'multiSelected' : 'disabled')}>
                  {multiSelectionCount > 0 ? `${multiSelectionCount} grouped` : 'No grouped set'}
                </span>
              </div>
            </div>

            {!previewGraphic ? (
              <div className='space-y-4'>
                <div className='aspect-video rounded-2xl border border-border-strong bg-panel shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]' />
                {!hasProfiles ? (
                  <EmptyState title='No profile' description='Select or create a profile before preview content can appear.' />
                ) : !hasSourceLoaded ? (
                  <EmptyState title='No source loaded' description='Load a source file for the active profile to enable preview and output control.' />
                ) : !selectedBlock ? (
                  <EmptyState title='No block selected' description='Pick a block from the left panel before choosing an item to preview.' />
                ) : (
                  <EmptyState title='No entity selected' description='Choose an item from the center panel to preview and trigger its graphic.' />
                )}
              </div>
            ) : (
              <>
                {multiSelectionCount > 0 ? (
                  <div className='ap-banner ap-banner-success mb-4'>
                    Composite mode is active. The preview frame shows the full grouped selection, while execution controls stay separate below.
                  </div>
                ) : (
                  <div className='ap-card mb-4 px-4 py-3'>
                    <p className='text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary'>Preview context</p>
                    <p className='mt-1 text-sm text-text-primary'>
                      {selectedEntity && selectedGraphic
                        ? `${formatEntityLabel(selectedEntity.entity)} in ${selectedGraphic.name}`
                        : 'Single selected item'}
                    </p>
                  </div>
                )}
                <PreviewCanvas
                  template={previewGraphic.preview}
                  content={previewContent}
                  backgroundImagePath={selectedBackground.resolvedFilePath}
                  compositeItems={compositePreviewItems}
                />
              </>
            )}
          </div>

          <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr),minmax(17rem,20rem)]'>
            <div className='ap-card p-4'>
              <p className='text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary'>
                {selectedEntity ? 'Selected item context' : multiSelectionCount > 0 ? 'Grouped context' : 'Execution context'}
              </p>
              {selectedEntity && selectedGraphic ? (
                <>
                  <p className='mt-2 text-sm font-semibold text-text-primary'>{formatEntityLabel(selectedEntity.entity)}</p>
                  <p className='mt-1 text-sm text-text-secondary'>
                    Block: {selectedEntity.blockName} | Graphic: {selectedGraphic.name}
                  </p>
                </>
              ) : multiSelectionCount > 0 ? (
                <>
                  <p className='mt-2 text-sm font-semibold text-text-primary'>
                    {multiSelectionCount} item{multiSelectionCount === 1 ? '' : 's'} prepared for grouped output
                  </p>
                  <p className='mt-1 text-sm text-text-secondary'>
                    Grouped play uses the toggled items from the center panel and can drive composite preview, datasource publish, and OSC output.
                  </p>
                </>
              ) : (
                <>
                  <p className='mt-2 text-sm font-semibold text-text-primary'>No execution target selected</p>
                  <p className='mt-1 text-sm text-text-secondary'>
                    Select a center-panel item for single preview and output, or toggle multiple items for grouped play.
                  </p>
                </>
              )}
            </div>

            <div className='ap-card p-4'>
              <p className='text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary'>Status readout</p>
              <div className='mt-3 space-y-3'>
                <StatusRow label='Profile' value={workspaceData.activeProfileLabel} />
                <StatusRow label='Block' value={selectedBlock?.name ?? 'None selected'} />
                <StatusRow label='Preview target' value={selectedGraphic?.name ?? previewGraphic?.name ?? 'None'} />
                <StatusRow label='Selected count' value={String(multiSelectionCount)} />
              </div>
            </div>
          </div>

          {multiSelectionCount > 0 ? (
            <div className='ap-state-multi rounded-xl border p-4'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <p className='text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300'>Grouped action bar</p>
                  <p className='mt-1 text-sm text-text-primary'>
                    {multiSelectionCount} selected for grouped play, stop, or resume.
                  </p>
                </div>
                <button
                  type='button'
                  onClick={handleClearMultiSelection}
                  disabled={multiSelectionCount === 0}
                  className={getControlButtonClassName({ tone: 'danger', variant: 'outline' })}
                >
                  Clear grouped set
                </button>
              </div>
              <div className='mt-4 grid gap-3 sm:grid-cols-3'>
                <button
                  type='button'
                  onClick={() => handleGroupedAction('playGraphic')}
                  disabled={multiSelectionCount === 0}
                  className={getControlButtonClassName({ tone: 'success', variant: 'solid', fullWidth: true })}
                >
                  Play grouped
                </button>
                <button
                  type='button'
                  onClick={() => handleGroupedAction('stopGraphic')}
                  disabled={multiSelectionCount === 0}
                  className={getControlButtonClassName({ tone: 'danger', variant: 'solid', fullWidth: true })}
                >
                  Stop grouped
                </button>
                <button
                  type='button'
                  onClick={() => handleGroupedAction('resumeGraphic')}
                  disabled={multiSelectionCount === 0}
                  className={getControlButtonClassName({ tone: 'warning', variant: 'solid', fullWidth: true })}
                >
                  Resume grouped
                </button>
              </div>
            </div>
          ) : null}

          <div className={selectedEntity && selectedGraphic ? 'ap-card p-4' : 'ap-card-muted p-4'}>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <p className='text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary'>Single-item controls</p>
              <span className={getStateBadgeClassName(selectedEntity && selectedGraphic ? 'selected' : 'disabled')}>
                {selectedEntity && selectedGraphic ? 'Single item armed' : 'No single item'}
              </span>
            </div>
            {!selectedEntity || !selectedGraphic ? (
              <div className='mt-3'>
                <EmptyState title='No entity selected' description='Choose one item in the center panel to enable single-item play, stop, and resume controls.' />
              </div>
            ) : (
              <div className='mt-4 grid gap-3 sm:grid-cols-3'>
                {Object.values(actionTypes).map((actionType) => (
                  <button
                    key={actionType}
                    type='button'
                    onClick={() => handleAction(actionType)}
                    className={getControlButtonClassName({
                      tone: actionType === 'playGraphic' ? 'success' : actionType === 'stopGraphic' ? 'danger' : 'warning',
                      variant: 'solid',
                      fullWidth: true,
                    })}
                  >
                    {actionType === 'playGraphic' ? 'Play' : actionType === 'stopGraphic' ? 'Stop' : 'Resume'}
                  </button>
                ))}
              </div>
            )}
          </div>

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
        ? `was duplicated as "${result.importedGraphic.name}"`
        : 'matched an existing local config and was preserved'

  return `Graphic config import completed. "${result.importedGraphic.name}" ${outcome}. Source file: ${filePath}.`
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
    <div className='ap-card-muted px-4 py-3'>
      <p className='text-xs uppercase tracking-[0.2em] text-text-secondary'>{label}</p>
      <p className='mt-1 text-sm font-semibold text-text-primary'>{value}</p>
    </div>
  )
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-start justify-between gap-3 border-b border-border-muted pb-3 last:border-b-0 last:pb-0'>
      <p className='text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary'>{label}</p>
      <p className='max-w-[14rem] text-right text-sm text-text-primary'>{value}</p>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className='ap-empty-state'>
      <p className='ap-section-title'>{title}</p>
      <p className='mt-1 ap-help'>{description}</p>
    </div>
  )
}

function countBlockEntities(block: WorkspaceShellData['document']['blocks'][number]): number {
  const collections = block.entityCollections ?? {}
  return Object.values(collections).reduce((total, items) => total + items.length, 0)
}
