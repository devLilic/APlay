import { useEffect, useRef, useState, type ComponentProps, type DragEvent, type ReactNode } from 'react'
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
  createWorkspaceOnAirController,
  createWorkspaceOnAirState,
  type WorkspaceOnAirSnapshot,
} from '@/features/workspace/state/workspaceOnAirState'
import type { SelectedEntityControlFeedback as WorkspaceActionFeedback } from '@/features/workspace/state/selectedEntityControl'
import {
  formatEntityLabel,
  resolveGraphicCollectionItemDisplay,
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
  const [onAirState, setOnAirState] = useState(createWorkspaceOnAirState)
  const [onAirController] = useState(() => createWorkspaceOnAirController({
    now: () => Date.now(),
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  }))
  const [featuredCollectionId, setFeaturedCollectionId] = useState<string>()
  const [draggedCollectionId, setDraggedCollectionId] = useState<string | null>(null)
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
    const unsubscribe = onAirController.subscribe(setOnAirState)

    return () => {
      unsubscribe()
      onAirController.dispose()
    }
  }, [onAirController])

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

  const readyGraphicCollections = loadState.status === 'ready'
    ? resolveGraphicConfigEntityLists(
      loadState.data.document,
      createWorkspaceSelectionState(loadState.data.document, loadState.data.graphics, selection).selection,
      loadState.data.graphics,
    )
    : []

  useEffect(() => {
    if (readyGraphicCollections.length === 0) {
      if (featuredCollectionId !== undefined) {
        setFeaturedCollectionId(undefined)
      }
      return
    }

    if (!featuredCollectionId || !readyGraphicCollections.some((group) => group.graphicConfigId === featuredCollectionId)) {
      setFeaturedCollectionId(readyGraphicCollections[0]?.graphicConfigId)
    }
  }, [featuredCollectionId, readyGraphicCollections])

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
  const filteredBlockList = blockList
  const hasSourceLoaded = Boolean(workspaceData.activeSourceFilePath)
  const hasBlocks = blockList.length > 0
  const hasGraphicCollections = graphicCollections.length > 0
  const groupedSelectionLabel = multiSelectionCount === 0
    ? 'No grouped items'
    : `${multiSelectionCount} grouped item${multiSelectionCount === 1 ? '' : 's'}`
  const featuredCollection = graphicCollections.find((group) => group.graphicConfigId === featuredCollectionId)
    ?? graphicCollections[0]
  const secondaryCollections = graphicCollections.filter(
    (group) => group.graphicConfigId !== featuredCollection?.graphicConfigId,
  )

  const applyWorkspaceSnapshot = (snapshot: WorkspaceConfigSnapshot) => {
    const nextData = loadWorkspaceShellData(snapshot)
    setLoadState({
      status: 'ready',
      snapshot,
      data: nextData,
    })
    onAirController.reset()
    setFeaturedCollectionId(undefined)
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
      onAirController.playSingle({
        graphic: previewGraphic,
        content: previewContent,
        backgroundImagePath: selectedBackground.resolvedFilePath,
        entityLabel: selectedEntity ? formatEntityLabel(selectedEntity.entity) : undefined,
      })
      return
    }

    if (actionType === 'stopGraphic' && previewGraphic) {
      onAirController.stopGraphic(previewGraphic.id)
      return
    }

    if (actionType === 'resumeGraphic') {
      onAirController.resume()
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
      const groupedItems: Array<{
        graphic: GraphicInstanceConfig
        content: Record<string, string | undefined>
        entityLabel?: string
      }> = []

      for (const item of selectedMultiItems) {
        const isPrimaryItem = (
          previewBaseEntity?.graphicConfigId === item.graphicConfigId &&
          previewBaseEntity.entityIndex === item.entityIndex
        )
        if (isPrimaryItem) {
          continue
        }

        const itemGraphic = workspaceData.graphicsById[item.graphicConfigId]
        if (!itemGraphic) {
          continue
        }

        groupedItems.push({
          graphic: itemGraphic,
          content: createEntityPreviewContent(item, itemGraphic),
          entityLabel: formatEntityLabel(item.entity),
        })
      }

      onAirController.playGrouped({
        primaryGraphic: previewGraphic,
        primaryContent: previewContent,
        primaryEntityLabel: previewBaseEntity ? formatEntityLabel(previewBaseEntity.entity) : undefined,
        backgroundImagePath: selectedBackground.resolvedFilePath,
        items: groupedItems,
      })
      return
    }

    if (actionType === 'stopGraphic') {
      onAirController.stopCurrent()
      return
    }

    if (actionType === 'resumeGraphic') {
      onAirController.resume()
    }
  }

  const handleClearMultiSelection = () => {
    setSelection(workspace.clearSelectedItems().selection)
    setFeedback(null)
  }

  const handleCollectionDragStart = (event: DragEvent<HTMLElement>, graphicConfigId: string) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/aplay-graphic-collection', graphicConfigId)
    setDraggedCollectionId(graphicConfigId)
  }

  const handleCollectionDragEnd = () => {
    setDraggedCollectionId(null)
  }

  const resolveDraggedCollectionId = (event: DragEvent<HTMLElement>) => (
    event.dataTransfer.getData('text/aplay-graphic-collection') || draggedCollectionId || ''
  )

  const handleFeaturedZoneDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    const nextCollectionId = resolveDraggedCollectionId(event)
    if (!nextCollectionId) {
      return
    }

    setFeaturedCollectionId(nextCollectionId)
    setDraggedCollectionId(null)
  }

  const handleSecondaryZoneDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    const nextCollectionId = resolveDraggedCollectionId(event)
    if (!nextCollectionId || nextCollectionId !== featuredCollection?.graphicConfigId) {
      setDraggedCollectionId(null)
      return
    }

    const fallbackCollection = graphicCollections.find((group) => group.graphicConfigId !== nextCollectionId)
    if (fallbackCollection) {
      setFeaturedCollectionId(fallbackCollection.graphicConfigId)
    }
    setDraggedCollectionId(null)
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
          title=''
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

            </div>
          )}

          <div className='min-h-0 flex-1 overflow-y-auto pr-1'>
            {!hasProfiles ? (
              <EmptyState title='No navigation available' description='A profile is required before blocks and source navigation can appear here.' />
            ) : !hasSourceLoaded ? (
              <EmptyState title='No source loaded' description='Select a profile with a configured source file to populate the block list.' />
            ) : !hasBlocks ? (
              <EmptyState title='No blocks available' description='The current source loaded successfully but produced no editorial blocks.' />
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
          title=''
          eyebrow='Center panel'
          className='overflow-hidden'
          contentClassName='gap-4 overflow-hidden'
          aside={<span className={getStateBadgeClassName('multiSelected')}>{groupedSelectionLabel}</span>}
        >
          <div className='grid min-h-0 flex-1 gap-4 xl:grid-cols-2'>
            <div
              className={[
                'min-h-0 rounded-xl border border-dashed p-3',
                draggedCollectionId ? 'border-state-multi/60 bg-cyan-500/5' : 'border-border bg-surface-muted/40',
              ].join(' ')}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleFeaturedZoneDrop}
            >
              <div className='mb-3 flex items-center justify-between gap-3'>
                <p className='text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary'>Featured collection</p>
                <span className={getStateBadgeClassName(featuredCollection ? 'selected' : 'disabled')}>
                  {featuredCollection ? 'Pinned' : 'Empty'}
                </span>
              </div>

              {featuredCollection ? (
                <GraphicCollectionCard
                  group={featuredCollection}
                  isSelectedGroup={workspace.selection.selectedGraphicConfigId === featuredCollection.graphicConfigId}
                  workspace={workspace}
                  onGraphicConfigSelect={handleGraphicConfigSelect}
                  onEntitySelect={handleEntitySelect}
                  onMultiSelectionToggle={handleMultiSelectionToggle}
                  onDragStart={handleCollectionDragStart}
                  onDragEnd={handleCollectionDragEnd}
                  isDragged={draggedCollectionId === featuredCollection.graphicConfigId}
                />
              ) : (
                <EmptyState title='No featured collection' description='Drag a graphic collection into this lane to keep it isolated for faster operation.' />
              )}
            </div>

            <div className='grid min-h-0 gap-4 xl:grid-rows-[auto,minmax(0,1fr)]'>
              <div className='flex justify-end'>
                <div className={multiSelectionCount > 0 ? 'ap-state-multi w-full max-w-4xl rounded-xl border p-4' : 'ap-card w-full max-w-4xl p-4'}>
                  <p className='sr-only'>Center panel controls</p>
                  <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span
                        className={getStateBadgeClassName(
                          multiSelectionCount > 0
                            ? 'multiSelected'
                            : selectedEntity && selectedGraphic
                              ? 'selected'
                              : 'disabled',
                        )}
                      >
                        {multiSelectionCount > 0
                          ? `Group selected: ${multiSelectionCount}`
                          : selectedEntity && selectedGraphic
                            ? 'Graphic selected'
                            : 'No selection'}
                      </span>
                      {selectedGraphic ? (
                        <span className={getStateBadgeClassName(selectedGraphic.onAir?.mode === 'autoHide' ? 'warning' : 'disabled')}>
                          {formatGraphicOnAirBadge(selectedGraphic)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className='mt-4 grid gap-3 sm:grid-cols-3'>
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
                  </div>
                </div>
              </div>

              <div
                className={[
                  'min-h-0 overflow-y-auto rounded-xl border border-dashed p-3 pr-2',
                  draggedCollectionId ? 'border-state-multi/60 bg-cyan-500/5' : 'border-border bg-surface-muted/20',
                ].join(' ')}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleSecondaryZoneDrop}
              >
                {!hasProfiles ? (
                  <EmptyState title='No profile' description='Select or create a profile to reveal graphic collections.' />
                ) : !hasSourceLoaded ? (
                  <EmptyState title='No source loaded' description='Graphic collections appear here after a profile source is configured and loaded.' />
                ) : !selectedBlock ? (
                  <EmptyState title='No block selected' description='Choose a block from the left panel to inspect its graphic collections.' />
                ) : !hasGraphicCollections ? (
                  <EmptyState title='No collections for this block' description='This block does not currently expose any graphic collections for the active profile.' />
                ) : secondaryCollections.length === 0 ? (
                  <EmptyState title='No additional collections' description='Drag the featured collection back into this area or load more graphic collections for this block.' />
                ) : (
                  <div className='space-y-3 pr-1'>
                    {secondaryCollections.map((group) => (
                      <GraphicCollectionCard
                        key={group.graphicConfigId}
                        group={group}
                        isSelectedGroup={workspace.selection.selectedGraphicConfigId === group.graphicConfigId}
                        workspace={workspace}
                        onGraphicConfigSelect={handleGraphicConfigSelect}
                        onEntitySelect={handleEntitySelect}
                        onMultiSelectionToggle={handleMultiSelectionToggle}
                        onDragStart={handleCollectionDragStart}
                        onDragEnd={handleCollectionDragEnd}
                        isDragged={draggedCollectionId === group.graphicConfigId}
                      />
                    ))}
                  </div>
                )}
              </div>

          <div className='hidden min-h-0 flex-1 overflow-y-auto pr-1'>
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
                            const display = resolveGraphicCollectionItemDisplay(item, group.graphic)
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
                                        <p className={[
                                          'max-w-full text-sm leading-5 break-words',
                                          isSelectedItem ? 'font-semibold text-text-primary' : 'font-medium text-text-primary',
                                        ].join(' ')}>
                                          {display.primary}
                                        </p>
                                        {display.secondary ? (
                                          <p className='mt-1 max-w-full text-[11px] leading-4 break-words text-text-secondary'>
                                            {display.secondary}
                                          </p>
                                        ) : null}
                                        <p className={display.secondary ? 'mt-1.5 text-xs text-text-secondary' : 'mt-0.5 text-xs text-text-secondary'}>
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
            </div>
          </div>
        </Panel>
      </section>
    </>
  )
}

function GraphicCollectionCard({
  group,
  isSelectedGroup,
  workspace,
  onGraphicConfigSelect,
  onEntitySelect,
  onMultiSelectionToggle,
  onDragStart,
  onDragEnd,
  isDragged,
}: {
  group: ReturnType<typeof resolveGraphicConfigEntityLists>[number]
  isSelectedGroup: boolean
  workspace: ReturnType<typeof createWorkspaceSelectionState>
  onGraphicConfigSelect: (graphicConfigId: string) => void
  onEntitySelect: (graphicConfigId: string, entityIndex: number) => void
  onMultiSelectionToggle: (graphicConfigId: string, entityIndex: number) => void
  onDragStart: (event: DragEvent<HTMLElement>, graphicConfigId: string) => void
  onDragEnd: () => void
  isDragged: boolean
}) {
  const isEmptyGroup = group.items.length === 0

  return (
    <article
      draggable
      onDragStart={(event) => onDragStart(event, group.graphicConfigId)}
      onDragEnd={onDragEnd}
      className={[
        'cursor-grab p-4 active:cursor-grabbing',
        isDragged ? 'opacity-60' : '',
        getSelectableItemClassName({
          selected: isSelectedGroup,
          warning: isEmptyGroup,
          interactive: false,
        }),
      ].join(' ').trim()}
    >
      <button
        type='button'
        onClick={() => onGraphicConfigSelect(group.graphicConfigId)}
        className='ap-focus flex w-full items-start justify-between gap-3 rounded-lg text-left'
      >
        <div className='min-w-0'>
          <h3 className='text-sm font-semibold leading-5 text-text-primary break-words'>{group.graphic.name}</h3>
          <p className='mt-1 text-[11px] uppercase tracking-[0.18em] text-text-secondary'>
            {group.graphic.entityType} {isEmptyGroup ? '| Empty collection' : '| Graphic collection'}
          </p>
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            <span className={getStateBadgeClassName(group.graphic.onAir?.mode === 'autoHide' ? 'warning' : 'disabled')}>
              {formatGraphicOnAirBadge(group.graphic)}
            </span>
          </div>
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
            const display = resolveGraphicCollectionItemDisplay(item, group.graphic)
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
                    onClick={() => onMultiSelectionToggle(group.graphicConfigId, index)}
                    aria-pressed={isMultiSelected}
                    className={[
                      'ap-focus mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold',
                      isMultiSelected
                        ? 'border-state-multi bg-state-multi text-slate-950'
                        : 'border-border bg-surface-app text-text-disabled hover:border-state-multi hover:text-accent',
                    ].join(' ')}
                    title={isMultiSelected ? 'Remove from grouped selection' : willReplaceGroupedItem ? 'Replace grouped selection in this collection' : 'Add to grouped selection'}
                  >
                    {isMultiSelected ? 'OK' : '+'}
                  </button>
                  <button
                    type='button'
                    onClick={() => onEntitySelect(group.graphicConfigId, index)}
                    className='ap-focus min-w-0 flex-1 rounded-lg text-left'
                  >
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                      <div className='min-w-0'>
                        <p className={[
                          'max-w-full text-sm leading-5 break-words',
                          isSelectedItem ? 'font-semibold text-text-primary' : 'font-medium text-text-primary',
                        ].join(' ')}>
                          {display.primary}
                        </p>
                        {display.secondary ? (
                          <p className='mt-1 max-w-full text-[11px] leading-4 break-words text-text-secondary'>
                            {display.secondary}
                          </p>
                        ) : null}
                        <p className={display.secondary ? 'mt-1.5 text-xs text-text-secondary' : 'mt-0.5 text-xs text-text-secondary'}>
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
                      onClick={() => onMultiSelectionToggle(group.graphicConfigId, index)}
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
        badge={previewGraphic ? formatGraphicOnAirBadge(previewGraphic) : undefined}
        detail={previewGraphic ? formatGraphicOnAirDetail(previewGraphic) : undefined}
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
        badge={onAirSnapshot?.statusBadge}
        detail={onAirSnapshot?.statusDetail}
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
  badge,
  detail,
  children,
}: {
  label: string
  badge?: string
  detail?: string
  children: ReactNode
}) {
  return (
    <article className='ap-panel overflow-hidden p-3'>
      <div className='relative'>
        <div className='pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-3'>
          <p className='text-sm font-semibold tracking-[0.18em] text-text-primary/80'>
            {label}
          </p>
          {badge ? (
            <div className='flex max-w-[16rem] flex-col items-end gap-1 text-right'>
              <span className='rounded-full border border-border bg-surface-app/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-primary/85'>
                {badge}
              </span>
              {detail ? (
                <span className='text-[10px] font-medium text-text-secondary/80'>
                  {detail}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
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

function formatGraphicOnAirBadge(graphic: GraphicInstanceConfig): string {
  return graphic.onAir?.mode === 'autoHide'
    ? 'Timed on-air'
    : 'Manual on-air'
}

function formatGraphicOnAirDetail(graphic: GraphicInstanceConfig): string | undefined {
  if (graphic.onAir?.mode !== 'autoHide' || graphic.onAir.durationSeconds === undefined) {
    return 'Stays on-air until Stop.'
  }

  return `Auto-hide after ${graphic.onAir.durationSeconds}s.`
}
