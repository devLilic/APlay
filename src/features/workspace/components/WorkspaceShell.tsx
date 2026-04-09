import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
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
import {
  applyWorkspaceOnAirEvent,
  createGroupedOnAirSnapshot,
  createSingleOnAirSnapshot,
  createWorkspaceOnAirState,
  type WorkspaceOnAirSnapshot,
} from '@/features/workspace/state/workspaceOnAirState'
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
  const [onAirState, setOnAirState] = useState(createWorkspaceOnAirState)
  const repositoryRef = useRef<WorkspaceConfigRepository | null>(null)
  const lastSourceRefreshFeedbackRef = useRef<SettingsFeedback | null>(null)
  const lastSettingsFeedbackRef = useRef<SettingsFeedback | null>(null)
  const lastExecutionFeedbackRef = useRef<WorkspaceActionFeedback | null>(null)
  const lastDiagnosticsSignatureRef = useRef<string | null>(null)

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
    if (loadState.status !== 'ready' || loadState.data.diagnostics.length === 0) {
      lastDiagnosticsSignatureRef.current = null
      return
    }

    const diagnosticsSignature = loadState.data.diagnostics.join(' | ')
    if (lastDiagnosticsSignatureRef.current === diagnosticsSignature) {
      return
    }

    notificationStore.publish({
      variant: 'warning',
      title: 'Workspace diagnostics',
      message: diagnosticsSignature,
      timeoutMs: 10000,
    })
    lastDiagnosticsSignatureRef.current = diagnosticsSignature
  }, [loadState, notificationStore])

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
    setOnAirState(createWorkspaceOnAirState())
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
    const result = await runWorkspaceGraphicAction(
      actionType,
      selectedEntity,
      workspaceData.graphicsById,
      loadState.snapshot.settings.osc,
    )
    setFeedback(result)

    if (result.kind !== 'success') {
      return
    }

    if (actionType === 'playGraphic' && previewGraphic) {
      setOnAirState((currentState) => applyWorkspaceOnAirEvent(currentState, {
        type: 'play',
        snapshot: createSingleOnAirSnapshot({
          graphic: previewGraphic,
          content: previewContent,
          backgroundImagePath: selectedBackground.resolvedFilePath,
          entityLabel: selectedEntity ? formatEntityLabel(selectedEntity.entity) : undefined,
        }),
      }))
      return
    }

    if (actionType === 'stopGraphic') {
      setOnAirState((currentState) => applyWorkspaceOnAirEvent(currentState, { type: 'stop' }))
      return
    }

    if (actionType === 'resumeGraphic') {
      setOnAirState((currentState) => applyWorkspaceOnAirEvent(currentState, { type: 'resume' }))
    }
  }

  const handleGroupedAction = async (actionType: (typeof actionTypes)[keyof typeof actionTypes]) => {
    const result = await runWorkspaceMultiGraphicAction(
      actionType,
      workspace.getSelectedItems(),
      workspaceData.graphicsById,
      loadState.snapshot.settings.osc,
    )
    setFeedback(result)

    if (result.kind !== 'success') {
      return
    }

    if (actionType === 'playGraphic' && previewGraphic) {
      setOnAirState((currentState) => applyWorkspaceOnAirEvent(currentState, {
        type: 'play',
        snapshot: createGroupedOnAirSnapshot({
          primaryGraphic: previewGraphic,
          primaryContent: previewContent,
          primaryEntityLabel: previewBaseEntity ? formatEntityLabel(previewBaseEntity.entity) : undefined,
          backgroundImagePath: selectedBackground.resolvedFilePath,
          itemCount: multiSelectionCount,
          compositeItems: compositePreviewItems,
        }),
      }))
      return
    }

    if (actionType === 'stopGraphic') {
      setOnAirState((currentState) => applyWorkspaceOnAirEvent(currentState, { type: 'stop' }))
      return
    }

    if (actionType === 'resumeGraphic') {
      setOnAirState((currentState) => applyWorkspaceOnAirEvent(currentState, { type: 'resume' }))
    }
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

      <DualDisplayArea
        previewGraphic={previewGraphic}
        selectedGraphic={selectedGraphic}
        previewContent={previewContent}
        selectedBackgroundPath={selectedBackground.resolvedFilePath}
        compositePreviewItems={compositePreviewItems}
        selectedEntityLabel={selectedEntity ? formatEntityLabel(selectedEntity.entity) : null}
        multiSelectionCount={multiSelectionCount}
        isCompositePreviewActive={isCompositePreviewActive}
        hasProfiles={hasProfiles}
        hasSourceLoaded={hasSourceLoaded}
        hasSelectedBlock={Boolean(selectedBlock)}
        onAirSnapshot={onAirState.current}
      />

      <section className='grid min-h-0 gap-4 xl:h-[calc(100vh-13.5rem)] xl:grid-cols-[minmax(18rem,22rem),minmax(26rem,1fr)]'>
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
          <div className={multiSelectionCount > 0 ? 'ap-state-multi rounded-xl border p-4' : 'ap-card p-4'}>
            <div className='flex flex-wrap items-start justify-between gap-4'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary'>Center panel controls</p>
                <div className='mt-2 flex flex-wrap items-center gap-2'>
                  <span className={getStateBadgeClassName(multiSelectionCount > 0 ? 'multiSelected' : selectedEntity && selectedGraphic ? 'selected' : 'disabled')}>
                    {multiSelectionCount > 0 ? 'Grouped actions' : selectedEntity && selectedGraphic ? 'Single-item actions' : 'No target armed'}
                  </span>
                  {selectedEntity && selectedGraphic && multiSelectionCount === 0 ? (
                    <span className={getStateBadgeClassName('selected')}>
                      {formatEntityLabel(selectedEntity.entity)}
                    </span>
                  ) : null}
                </div>
                <p className='mt-2 text-sm text-text-secondary'>
                  {multiSelectionCount > 0
                    ? `Grouped execution is armed for ${multiSelectionCount} item${multiSelectionCount === 1 ? '' : 's'}.`
                    : selectedEntity && selectedGraphic
                      ? 'Single selected item is armed for the current preview and live actions.'
                      : 'Select one item for preview or build a grouped set before running output actions.'}
                </p>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <span className={getStateBadgeClassName(selectedBlock ? 'selected' : 'disabled')}>
                  {selectedBlock ? `Active block: ${selectedBlock.name}` : 'No active block'}
                </span>
                <span className={getStateBadgeClassName(previewGraphic ? (isCompositePreviewActive ? 'multiSelected' : 'selected') : 'disabled')}>
                  {previewGraphic ? `Preview target: ${selectedGraphic?.name ?? previewGraphic.name}` : 'No preview target'}
                </span>
                <span className={getStateBadgeClassName(multiSelectionCount > 0 ? 'multiSelected' : 'disabled')}>
                  {groupedSelectionLabel}
                </span>
              </div>
            </div>

            <div className='mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr),auto] md:items-start'>
              <div className='grid gap-3 sm:grid-cols-3'>
                <button
                  type='button'
                  onClick={() => (multiSelectionCount > 0 ? handleGroupedAction('playGraphic') : handleAction('playGraphic'))}
                  disabled={multiSelectionCount === 0 && (!selectedEntity || !selectedGraphic)}
                  className={getControlButtonClassName({ tone: 'success', variant: 'solid', fullWidth: true })}
                >Play</button>
                <button
                  type='button'
                  onClick={() => (multiSelectionCount > 0 ? handleGroupedAction('stopGraphic') : handleAction('stopGraphic'))}
                  disabled={multiSelectionCount === 0 && (!selectedEntity || !selectedGraphic)}
                  className={getControlButtonClassName({ tone: 'danger', variant: 'solid', fullWidth: true })}
                >Stop</button>
                <button
                  type='button'
                  onClick={() => (multiSelectionCount > 0 ? handleGroupedAction('resumeGraphic') : handleAction('resumeGraphic'))}
                  disabled={multiSelectionCount === 0 && (!selectedEntity || !selectedGraphic)}
                  className={getControlButtonClassName({ tone: 'warning', variant: 'solid', fullWidth: true })}
                >Resume</button>
              </div>
              <div className='flex flex-wrap items-center justify-start gap-2 md:justify-end'>
                {multiSelectionCount > 0 ? (
                  <button
                    type='button'
                    onClick={handleClearMultiSelection}
                    className={getControlButtonClassName({ tone: 'danger', variant: 'outline' })}
                  >
                    Clear grouped set
                  </button>
                ) : null}
                <span className={getStateBadgeClassName(
                  multiSelectionCount > 0
                    ? 'multiSelected'
                    : selectedEntity && selectedGraphic
                      ? 'selected'
                      : 'disabled',
                )}
                >
                  {multiSelectionCount > 0
                    ? `${multiSelectionCount} grouped ready`
                    : selectedEntity && selectedGraphic
                      ? 'Single target ready'
                      : 'Waiting for target'}
                </span>
              </div>
            </div>
          </div>

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

interface DualDisplayAreaProps {
  previewGraphic: WorkspaceShellData['graphics'][number] | undefined
  selectedGraphic: WorkspaceShellData['graphics'][number] | undefined
  previewContent: Record<string, string | undefined>
  selectedBackgroundPath?: string
  compositePreviewItems: NonNullable<ComponentProps<typeof PreviewCanvas>['compositeItems']>
  selectedEntityLabel: string | null
  multiSelectionCount: number
  isCompositePreviewActive: boolean
  hasProfiles: boolean
  hasSourceLoaded: boolean
  hasSelectedBlock: boolean
  onAirSnapshot: WorkspaceOnAirSnapshot | null
}

function DualDisplayArea({
  previewGraphic,
  selectedGraphic,
  previewContent,
  selectedBackgroundPath,
  compositePreviewItems,
  selectedEntityLabel,
  multiSelectionCount,
  isCompositePreviewActive,
  hasProfiles,
  hasSourceLoaded,
  hasSelectedBlock,
  onAirSnapshot,
}: DualDisplayAreaProps) {
  return (
    <section className='grid gap-4 xl:grid-cols-2'>
      <DisplayScreen
        label='Preview'
        eyebrow='Selected preview'
        title={selectedGraphic?.name ?? previewGraphic?.name ?? 'No preview target'}
        description={multiSelectionCount > 1
          ? `Preview target shows ${multiSelectionCount} grouped items together.`
          : selectedEntityLabel && selectedGraphic
            ? `Preview target: ${selectedEntityLabel} in ${selectedGraphic.name}.`
            : 'Preview target is visual-only. Choose an item below to arm it for output.'}
        status={previewGraphic ? (isCompositePreviewActive ? `${multiSelectionCount} grouped` : 'Preview target') : 'Idle'}
        state={previewGraphic ? (isCompositePreviewActive ? 'multiSelected' : 'selected') : 'disabled'}
      >
        {!previewGraphic ? (
          <DisplayEmptyState
            title={!hasProfiles
              ? 'No profile'
              : !hasSourceLoaded
                ? 'No source loaded'
                : !hasSelectedBlock
                  ? 'No block selected'
                  : 'No entity selected'}
            description={!hasProfiles
              ? 'Select or create a profile before preview content can appear.'
              : !hasSourceLoaded
                ? 'Load a source file for the active profile to enable preview output.'
                : !hasSelectedBlock
                  ? 'Pick a block from the left panel before choosing an item to preview.'
                  : 'Choose an item from the center panel to preview and prepare for output.'}
          />
        ) : (
          <PreviewCanvas
            template={previewGraphic.preview}
            content={previewContent}
            backgroundImagePath={selectedBackgroundPath}
            compositeItems={compositePreviewItems}
          />
        )}
      </DisplayScreen>

      <DisplayScreen
        label='ONAIR'
        eyebrow='On-air output'
        title={onAirSnapshot?.title ?? 'No on-air graphic'}
        description={onAirSnapshot?.description ?? 'Waiting for live output.'}
        status={onAirSnapshot ? (onAirSnapshot.mode === 'grouped' ? `${onAirSnapshot.itemCount} live` : 'Live') : 'Idle'}
        state={onAirSnapshot ? 'active' : 'disabled'}
      >
        {!onAirSnapshot ? (
          <DisplayEmptyState
            title='No on-air graphic'
            description='Waiting for live output.'
          />
        ) : (
          <PreviewCanvas
            template={onAirSnapshot.template}
            content={onAirSnapshot.content}
            backgroundImagePath={onAirSnapshot.backgroundImagePath}
            compositeItems={onAirSnapshot.compositeItems}
          />
        )}
      </DisplayScreen>
    </section>
  )
}

function DisplayScreen({
  label,
  eyebrow,
  title,
  description,
  status,
  state,
  children,
}: {
  label: string
  eyebrow: string
  title: string
  description: string
  status: string
  state: Parameters<typeof getStateBadgeClassName>[0]
  children: ReactNode
}) {
  return (
    <article className='ap-panel overflow-hidden p-0'>
      <div className='flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary'>{eyebrow}</p>
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            <p className='text-base font-semibold text-text-primary'>{label}</p>
            <span className={getStateBadgeClassName(state)}>{status}</span>
          </div>
          <p className='mt-2 text-sm font-medium text-text-primary'>{title}</p>
          <p className='mt-1 text-sm text-text-secondary'>{description}</p>
        </div>
      </div>
      <div className='p-5'>
        {children}
      </div>
    </article>
  )
}

function DisplayEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className='flex aspect-video items-center justify-center rounded-2xl border border-border-strong bg-surface-app p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]'>
      <EmptyState title={title} description={description} />
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
