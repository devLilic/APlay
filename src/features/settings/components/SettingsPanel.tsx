import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from 'react'
import { supportedEntityTypes, type SupportedEntityType } from '@/core/entities/entityTypes'
import type {
  AppSettings,
  CsvSourceSchemaConfig,
  GraphicFieldBinding,
  GraphicInstanceConfig,
  OscArgConfig,
  OscArgType,
  OscCommandConfig,
  PreviewElementDefinition,
  PreviewElementKind,
  ReferenceImageAsset,
  ShowProfileConfig,
  TransformOrigin,
} from '@/settings/models/appConfig'
import { csvSourceSchemaConfigSchema } from '@/settings/schemas/appConfigSchemas'
import {
  oscArgConfigSchema,
  validateOscAddress,
  validateOscHost,
  validateOscPort,
} from '@/settings/schemas/oscConfigSchemas'
import { resolveActivePreviewBackground } from '@/settings/utils/previewBackgrounds'
import type { GraphicConfigLibraryImportResult } from '@/settings/storage/graphicConfigImport'
import type { ProfileLibraryImportResult } from '@/settings/storage/profileConfigImport'
import {
  createGraphicConfigLibraryService,
  findGraphicConfigReferences,
  type GraphicConfigReference,
} from '@/settings/storage/graphicConfigLibraryService'
import {
  SettingsHeaderActions,
  SettingsPlaceholderCard,
  SettingsTabNavigation,
  PreviewCanvasSidebar,
  type SettingsTabMeta,
} from '@/features/settings/components/SettingsPanelChrome'
import { useNotificationStore } from '@/features/notifications/notificationsContext'
import { Panel } from '@/shared/ui/panel'
import { getControlButtonClassName, getStateBadgeClassName } from '@/shared/ui/theme'

export interface SettingsFeedback {
  kind: 'success' | 'error'
  message: string
}

interface SettingsPanelProps {
  settings: AppSettings
  diagnostics: string[]
  feedback: SettingsFeedback | null
  selectedGraphic?: GraphicInstanceConfig
  previewContent: Record<string, string | undefined>
  isImportingGraphicConfig: boolean
  isImportingProfile: boolean
  pendingImportSummary:
    | {
      kind: 'graphic'
      filePath: string
      preview: GraphicConfigLibraryImportResult
    }
    | {
      kind: 'profile'
      filePath: string
      preview: ProfileLibraryImportResult
    }
    | null
  onSettingsChange: (settings: AppSettings) => void
  onSave: () => void
  onReload: () => void
  onImportGraphicConfig: () => Promise<void>
  onImportProfile: () => Promise<void>
  onConfirmImport: () => void
  onCancelImport: () => void
  onExportGraphicConfig: (graphic: GraphicInstanceConfig) => Promise<void>
  onExportProfile: (profileId: string) => Promise<void>
  onTestOscCommand: (
    graphic: GraphicInstanceConfig,
    actionType: 'playGraphic' | 'stopGraphic' | 'resumeGraphic',
  ) => Promise<void>
}

const transformOrigins: TransformOrigin[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']
const previewElementKinds: PreviewElementKind[] = ['text', 'box', 'image']
const oscArgTypes: OscArgType[] = ['s', 'i', 'f']
const graphicConfigLibraryService = createGraphicConfigLibraryService()
const graphicBindingSourceFieldOptions: Record<SupportedEntityType, string[]> = {
  title: ['text', 'number'],
  person: ['name', 'role'],
  location: ['value'],
  phone: ['label', 'number'],
  image: ['staticAsset'],
}
type SettingsTabId = 'show' | 'osc' | 'graphics' | 'preview' | 'assets'

const settingsTabs: SettingsTabMeta[] = [
  {
    id: 'show',
    label: 'Show',
    description: 'Profile activ, sursa CSV si schema de lucru.',
  },
  {
    id: 'osc',
    label: 'OSC',
    description: 'Target-ul general si comenzile globale LiveBoard.',
  },
  {
    id: 'graphics',
    label: 'Graphics',
    description: 'Selectie graphic, datasource, bindings si template-ul LiveBoard.',
  },
  {
    id: 'preview',
    label: 'Preview',
    description: 'Template preview si reglajele vizuale locale din APlay.',
  },
  {
    id: 'assets',
    label: 'Assets',
    description: 'Imagini de referinta folosite doar pentru calibrare preview.',
  },
]

const settingsFieldClassName = 'ap-focus w-full rounded-xl border border-border bg-surface-app px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled disabled:cursor-not-allowed disabled:border-border-muted disabled:bg-surface-muted disabled:text-text-disabled'
const settingsReadOnlyFieldClassName = 'w-full rounded-xl border border-border-muted bg-surface-muted px-3 py-2.5 text-sm text-text-secondary'
const settingsLabelClassName = 'text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary'
const settingsEyebrowClassName = 'text-[11px] font-semibold uppercase tracking-[0.22em] text-accent/90'
const settingsHelperTextClassName = 'text-sm leading-6 text-text-secondary'
const settingsMetaTextClassName = 'text-xs uppercase tracking-[0.16em] text-text-secondary'
const settingsCheckboxRowClassName = 'ap-focus flex items-center gap-2 rounded-xl border border-border-muted bg-surface-app/60 px-3 py-2.5 text-sm text-text-primary'
const settingsCompactCheckboxRowClassName = 'ap-focus inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-muted bg-surface-app/60 px-2 py-1.5 text-xs text-text-primary'
const settingsSubsectionClassName = 'rounded-2xl border border-border bg-card p-4 sm:p-5'
const settingsInsetSectionClassName = 'rounded-2xl border border-border-muted bg-surface-muted p-4'
const settingsActionRowClassName = 'flex flex-wrap items-center gap-2'
const settingsActionRowEndClassName = 'flex flex-wrap items-center justify-end gap-2'
const settingsSplitActionRowClassName = 'flex flex-wrap items-start justify-between gap-3'
const settingsCompactFieldGroupClassName = 'space-y-3'
const settingsCompactEditorStackClassName = 'space-y-4'
const settingsCompactScrollAreaClassName = 'space-y-3 xl:max-h-[34rem] xl:overflow-y-auto xl:pr-1'
const settingsNestedEditorRowClassName = 'grid gap-3 rounded-xl border border-border-muted bg-surface-app/40 p-4'
const settingsSecondaryButtonClassName = getControlButtonClassName()
const settingsDangerButtonClassName = getControlButtonClassName({ tone: 'danger', variant: 'outline' })
const settingsSuccessButtonClassName = getControlButtonClassName({ tone: 'success', variant: 'outline' })
const settingsWarningButtonClassName = getControlButtonClassName({ tone: 'warning', variant: 'outline' })
const settingsAccentButtonClassName = getControlButtonClassName({ tone: 'accent', variant: 'solid' })

function getSettingsStatusClassName(kind: 'success' | 'warning' | 'error'): string {
  return kind === 'success'
    ? 'ap-banner ap-banner-success'
    : kind === 'warning'
      ? 'ap-banner ap-banner-warning'
      : 'ap-banner ap-banner-danger'
}

export function SettingsPanel({
  settings,
  diagnostics,
  feedback,
  selectedGraphic: activeGraphic,
  previewContent,
  isImportingGraphicConfig,
  isImportingProfile,
  pendingImportSummary,
  onSettingsChange,
  onSave,
  onReload,
  onImportGraphicConfig,
  onImportProfile,
  onConfirmImport,
  onCancelImport,
  onExportGraphicConfig,
  onExportProfile,
  onTestOscCommand,
}: SettingsPanelProps) {
  const notificationStore = useNotificationStore()
  const selectedProfile = settings.profiles.find((profile) => profile.id === settings.selectedProfileId)
  const invalidGraphicNames = settings.graphics.filter((graphic) => graphic.name.trim().length === 0)
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(selectedProfile?.graphicConfigIds[0] ?? null)
  const [draftGraphicEntityType, setDraftGraphicEntityType] = useState<GraphicInstanceConfig['entityType']>('title')
  const [draftGraphicId, setDraftGraphicId] = useState('')
  const [libraryFeedback, setLibraryFeedback] = useState<SettingsFeedback | null>(null)
  const [pendingGraphicDelete, setPendingGraphicDelete] = useState<{
    graphicId: string
    references: GraphicConfigReference[]
  } | null>(null)
  const [draftReferenceImageName, setDraftReferenceImageName] = useState('')
  const [draftReferenceImagePath, setDraftReferenceImagePath] = useState('')
  const [isPickingReferenceImage, setIsPickingReferenceImage] = useState(false)
  const [isPickingSourceFile, setIsPickingSourceFile] = useState(false)
  const [isPickingDatasourceJson, setIsPickingDatasourceJson] = useState(false)
  const [isPickingStaticAsset, setIsPickingStaticAsset] = useState(false)
  const [isExportingGraphicConfig, setIsExportingGraphicConfig] = useState(false)
  const [isExportingProfile, setIsExportingProfile] = useState(false)
  const [oscArgDrafts, setOscArgDrafts] = useState<Record<string, string>>({})
  const [testingOscActionKey, setTestingOscActionKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SettingsTabId>('show')
  const lastExternalFeedbackRef = useRef<SettingsFeedback | null>(null)
  const lastLibraryFeedbackRef = useRef<SettingsFeedback | null>(null)

  useEffect(() => {
    if (!feedback) {
      lastExternalFeedbackRef.current = null
      return
    }

    if (lastExternalFeedbackRef.current === feedback) {
      return
    }

    notificationStore.publish({
      variant: feedback.kind === 'success' ? 'success' : 'danger',
      title: 'Settings',
      message: feedback.message,
      timeoutMs: 8000,
    })
    lastExternalFeedbackRef.current = feedback
  }, [feedback, notificationStore])

  useEffect(() => {
    if (!libraryFeedback) {
      lastLibraryFeedbackRef.current = null
      return
    }

    if (lastLibraryFeedbackRef.current === libraryFeedback) {
      return
    }

    notificationStore.publish({
      variant: libraryFeedback.kind === 'success' ? 'success' : 'danger',
      title: 'Settings library',
      message: libraryFeedback.message,
      timeoutMs: 8000,
    })
    lastLibraryFeedbackRef.current = libraryFeedback
  }, [libraryFeedback, notificationStore])

  useEffect(() => {
    const nextGraphicId = selectedProfile?.graphicConfigIds[0] ?? null

    if (!selectedProfile && settings.graphics.length === 0) {
      setSelectedGraphicId(null)
      return
    }

    if (!selectedGraphicId) {
      setSelectedGraphicId(nextGraphicId ?? settings.graphics[0]?.id ?? null)
      return
    }

    if (!settings.graphics.some((graphic) => graphic.id === selectedGraphicId)) {
      setSelectedGraphicId(nextGraphicId ?? settings.graphics[0]?.id ?? null)
    }
  }, [selectedGraphicId, selectedProfile, settings.graphics])

  const selectedGraphic = selectedGraphicId
    ? settings.graphics.find((graphic) => graphic.id === selectedGraphicId)
    : undefined

  const applySettingsResult = (
    nextSettings: AppSettings,
    nextFeedback: SettingsFeedback | null = null,
    nextSelectedGraphicId?: string | null,
  ) => {
    onSettingsChange(nextSettings)
    setLibraryFeedback(nextFeedback)
    setPendingGraphicDelete(null)
    if (nextSelectedGraphicId !== undefined) {
      setSelectedGraphicId(nextSelectedGraphicId)
    }
  }

  const updateProfile = (updater: (profile: ShowProfileConfig) => ShowProfileConfig) => {
    if (!selectedProfile) {
      return
    }

    onSettingsChange({
      ...settings,
      profiles: settings.profiles.map((profile) => profile.id === selectedProfile.id ? updater(profile) : profile),
    })
  }

  const updateGraphic = (updater: (graphic: GraphicInstanceConfig) => GraphicInstanceConfig) => {
    if (!selectedGraphic) {
      return
    }

    try {
      const result = graphicConfigLibraryService.updateGraphicConfig(
        { settings, graphicFiles: {} },
        selectedGraphic.id,
        updater,
      )
      applySettingsResult(
        result.settings,
        null,
        result.graphic.id,
      )
    } catch (error) {
      setLibraryFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Graphic config update failed.',
      })
    }
  }

  const updateBinding = (bindingIndex: number, updater: (binding: GraphicFieldBinding) => GraphicFieldBinding) => {
    updateGraphic((graphic) => ({
      ...graphic,
      bindings: (graphic.bindings ?? []).map((binding, index) => index === bindingIndex ? updater(binding) : binding),
    }))
  }

  const updatePreviewElement = (
    elementIndex: number,
    updater: (element: PreviewElementDefinition) => PreviewElementDefinition,
  ) => {
    updateGraphic((graphic) => ({
      ...graphic,
      preview: {
        ...graphic.preview,
        elements: graphic.preview.elements.map((element, index) => index === elementIndex ? updater(element) : element),
      },
    }))
  }

  const addReferenceImage = () => {
    const name = draftReferenceImageName.trim()
    const filePath = draftReferenceImagePath.trim()

    if (name.length === 0 || filePath.length === 0) {
      return
    }

    const nextReferenceImage: ReferenceImageAsset = {
      id: createUniqueReferenceImageId(settings, name),
      name,
      filePath,
    }

    onSettingsChange({
      ...settings,
      referenceImages: [...settings.referenceImages, nextReferenceImage],
    })
    setDraftReferenceImageName('')
    setDraftReferenceImagePath('')
  }

  const removeReferenceImage = (referenceImageId: string) => {
    onSettingsChange({
      ...settings,
      referenceImages: settings.referenceImages.filter((image) => image.id !== referenceImageId),
      graphics: settings.graphics.map((graphic) => ({
        ...graphic,
        preview: {
          ...graphic.preview,
          ...(graphic.preview.background?.referenceImageId === referenceImageId
            ? {
              background: {
                ...graphic.preview.background,
                referenceImageId: undefined,
              },
            }
            : {}),
        },
      })),
    })
  }

  const handleCreateGraphicConfig = () => {
    try {
      const nextGraphic = createDefaultGraphicConfig(
        settings,
        draftGraphicEntityType,
        draftGraphicId.trim() || undefined,
      )
      const result = graphicConfigLibraryService.createGraphicConfig(
        { settings, graphicFiles: {} },
        nextGraphic,
      )
      applySettingsResult(
        result.settings,
        {
          kind: 'success',
          message: `Graphic config "${result.graphic.name}" created in the library.`,
        },
        result.graphic.id,
      )
      setDraftGraphicId('')
    } catch (error) {
      setLibraryFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Graphic config creation failed.',
      })
    }
  }

  const handleDuplicateGraphicConfig = (graphicId: string) => {
    try {
      const result = graphicConfigLibraryService.duplicateGraphicConfig(
        { settings, graphicFiles: {} },
        graphicId,
      )
      applySettingsResult(
        result.settings,
        {
          kind: 'success',
          message: `Graphic config "${result.graphic.name}" duplicated successfully.`,
        },
        result.graphic.id,
      )
    } catch (error) {
      setLibraryFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Graphic config duplication failed.',
      })
    }
  }

  const handleDeleteGraphicRequest = (graphicId: string) => {
    setPendingGraphicDelete({
      graphicId,
      references: findGraphicConfigReferences(settings, graphicId),
    })
  }

  const handleConfirmDeleteGraphic = () => {
    if (!pendingGraphicDelete) {
      return
    }

    try {
      const result = graphicConfigLibraryService.deleteGraphicConfig(
        { settings, graphicFiles: {} },
        pendingGraphicDelete.graphicId,
      )
      const nextSelectedId = selectedGraphicId === pendingGraphicDelete.graphicId
        ? selectedProfile?.graphicConfigIds.find((id) => id !== pendingGraphicDelete.graphicId)
          ?? result.settings.graphics[0]?.id
          ?? null
        : selectedGraphicId
      applySettingsResult(
        result.settings,
        {
          kind: 'success',
          message: `Graphic config deleted from the library.`,
        },
        nextSelectedId,
      )
    } catch (error) {
      setLibraryFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Graphic config deletion failed.',
      })
    }
  }

  const handleAttachGraphicToProfile = (graphicId: string) => {
    if (!selectedProfile) {
      return
    }

    try {
      const result = graphicConfigLibraryService.attachGraphicConfigToProfile(
        { settings, graphicFiles: {} },
        selectedProfile.id,
        graphicId,
      )
      applySettingsResult(
        result.settings,
        {
          kind: 'success',
          message: result.status === 'already-attached'
            ? `Graphic config "${graphicId}" is already assigned to profile "${selectedProfile.label}".`
            : `Graphic config "${graphicId}" added to profile "${selectedProfile.label}".`,
        },
        graphicId,
      )
    } catch (error) {
      setLibraryFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Profile assignment failed.',
      })
    }
  }

  const handleDetachGraphicFromProfile = (graphicId: string) => {
    if (!selectedProfile) {
      return
    }

    try {
      const result = graphicConfigLibraryService.detachGraphicConfigFromProfile(
        { settings, graphicFiles: {} },
        selectedProfile.id,
        graphicId,
      )
      const nextSelectedId = selectedGraphicId === graphicId
        ? selectedProfile.graphicConfigIds.find((id) => id !== graphicId) ?? selectedGraphicId
        : selectedGraphicId
      applySettingsResult(
        result.settings,
        {
          kind: 'success',
          message: result.status === 'already-detached'
            ? `Graphic config "${graphicId}" is already removed from profile "${selectedProfile.label}".`
            : `Graphic config "${graphicId}" removed from profile "${selectedProfile.label}".`,
        },
        nextSelectedId,
      )
    } catch (error) {
      setLibraryFeedback({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Profile removal failed.',
      })
    }
  }

  const handlePickReferenceImage = async () => {
    if (!window.settingsApi?.pickReferenceImage) {
      return
    }

    setIsPickingReferenceImage(true)

    try {
      const filePath = await window.settingsApi.pickReferenceImage()
      if (!filePath) {
        return
      }

      setDraftReferenceImagePath(filePath)
      if (draftReferenceImageName.trim().length === 0) {
        setDraftReferenceImageName(getFileNameFromPath(filePath))
      }
    } finally {
      setIsPickingReferenceImage(false)
    }
  }

  const handlePickSourceFile = async () => {
    if (!window.settingsApi?.pickSourceCsvFile || !selectedProfile) {
      return
    }

    setIsPickingSourceFile(true)

    try {
      const filePath = await window.settingsApi.pickSourceCsvFile()
      if (!filePath) {
        return
      }

      updateProfile((profile) => ({
        ...profile,
        source: {
          type: 'csv',
          filePath,
          schemaId: profile.source?.schemaId,
        },
      }))
    } finally {
      setIsPickingSourceFile(false)
    }
  }

  const handlePickDatasourceJsonFile = async () => {
    if (!window.settingsApi?.pickDatasourceJsonFile || !selectedGraphic) {
      return
    }

    setIsPickingDatasourceJson(true)

    try {
      const filePath = await window.settingsApi.pickDatasourceJsonFile()
      if (!filePath) {
        return
      }

      updateGraphic((graphic) => ({
        ...graphic,
        datasourcePath: filePath,
      }))
    } finally {
      setIsPickingDatasourceJson(false)
    }
  }

  const handlePickStaticAssetFile = async () => {
    if (!window.settingsApi?.pickReferenceImage || !selectedGraphic) {
      return
    }

    setIsPickingStaticAsset(true)

    try {
      const filePath = await window.settingsApi.pickReferenceImage()
      if (!filePath) {
        return
      }

      updateGraphic((graphic) => ({
        ...graphic,
        kind: 'static',
        staticAsset: {
          assetPath: filePath,
          assetType: 'image',
        },
      }))
    } finally {
      setIsPickingStaticAsset(false)
    }
  }

  const handleGraphicConfigExport = async () => {
    if (!selectedGraphic || isExportingGraphicConfig) {
      return
    }

    setIsExportingGraphicConfig(true)

    try {
      await onExportGraphicConfig(selectedGraphic)
    } finally {
      setIsExportingGraphicConfig(false)
    }
  }

  const handleProfileExport = async () => {
    if (!selectedProfile || isExportingProfile) {
      return
    }

    setIsExportingProfile(true)

    try {
      await onExportProfile(selectedProfile.id)
    } finally {
      setIsExportingProfile(false)
    }
  }

  return (
    <Panel
      title='Settings'
      eyebrow='Application config'
      aside={(
        <SettingsHeaderActions
          isImportingProfile={isImportingProfile}
          isImportingGraphicConfig={isImportingGraphicConfig}
          canExportProfile={Boolean(selectedProfile)}
          canExportGraphic={Boolean(selectedGraphic)}
          isExportingProfile={isExportingProfile}
          isExportingGraphicConfig={isExportingGraphicConfig}
          canSave={invalidGraphicNames.length === 0}
          onImportProfile={() => void onImportProfile()}
          onImportGraphicConfig={() => void onImportGraphicConfig()}
          onExportProfile={() => void handleProfileExport()}
          onExportGraphicConfig={() => void handleGraphicConfigExport()}
          onReload={onReload}
          onSave={onSave}
        />
      )}
    >
      <div className='ap-settings space-y-6'>
        <SettingsTabNavigation
          tabs={settingsTabs}
          activeTabId={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as SettingsTabId)}
        />

        {invalidGraphicNames.length > 0 ? (
          <div className='ap-banner ap-banner-warning'>
            Display Name is required for every graphic config before settings can be saved.
          </div>
        ) : null}

        {pendingImportSummary ? (
          <ImportSummaryCard
            summary={pendingImportSummary}
            onConfirm={onConfirmImport}
            onCancel={onCancelImport}
          />
        ) : null}

        {diagnostics.length > 0 ? (
          <div className='ap-banner ap-banner-warning'>
            {diagnostics.join(' | ')}
          </div>
        ) : null}

        {activeTab === 'show' ? (
          <section className='grid gap-6 xl:grid-cols-[22rem,minmax(0,1fr)]'>
            <div className='space-y-4'>
              <ProfileSection
                settings={settings}
                selectedProfile={selectedProfile}
                isPickingSourceFile={isPickingSourceFile}
                onSettingsChange={onSettingsChange}
                onProfileUpdate={updateProfile}
                onPickSourceFile={handlePickSourceFile}
                onAttachGraphicConfig={handleAttachGraphicToProfile}
                onDetachGraphicConfig={handleDetachGraphicFromProfile}
              />
            </div>

            <div className='space-y-4'>
              <CsvSchemaSection
                settings={settings}
                selectedProfile={selectedProfile}
                onSettingsChange={onSettingsChange}
              />
            </div>
          </section>
        ) : null}

        {activeTab === 'osc' ? (
          <section className='space-y-4'>
            <GlobalOscSettingsSection
              settings={settings}
              onSettingsChange={onSettingsChange}
              oscArgDrafts={oscArgDrafts}
              onOscArgDraftChange={(draftKey, value) => setOscArgDrafts((current) => ({ ...current, [draftKey]: value }))}
            />
          </section>
        ) : null}

        {activeTab === 'graphics' ? (
          <section className='space-y-4 w-full'>
            <GraphicSelectionSection
              settings={settings}
              selectedProfile={selectedProfile}
              selectedGraphicId={selectedGraphicId}
              onSelectedGraphicIdChange={setSelectedGraphicId}
              draftGraphicEntityType={draftGraphicEntityType}
              draftGraphicId={draftGraphicId}
              pendingGraphicDelete={pendingGraphicDelete}
              onDraftGraphicEntityTypeChange={setDraftGraphicEntityType}
              onDraftGraphicIdChange={setDraftGraphicId}
              onCreateGraphicConfig={handleCreateGraphicConfig}
              onDuplicateGraphicConfig={handleDuplicateGraphicConfig}
              onRequestDeleteGraphicConfig={handleDeleteGraphicRequest}
              onConfirmDeleteGraphicConfig={handleConfirmDeleteGraphic}
              onCancelDeleteGraphicConfig={() => setPendingGraphicDelete(null)}
              onAttachGraphicConfig={handleAttachGraphicToProfile}
              onDetachGraphicConfig={handleDetachGraphicFromProfile}
            />

            {selectedGraphic ? (
              <GraphicBindingSection
                graphic={selectedGraphic}
                updateGraphic={updateGraphic}
                updateBinding={updateBinding}
                isPickingDatasourceJson={isPickingDatasourceJson}
                isPickingStaticAsset={isPickingStaticAsset}
                onPickDatasourceJsonFile={handlePickDatasourceJsonFile}
                onPickStaticAssetFile={handlePickStaticAssetFile}
                testingOscActionKey={testingOscActionKey}
                onTestOscCommand={async (graphic, actionType) => {
                  const actionKey = `${graphic.id}:${actionType}`
                  setTestingOscActionKey(actionKey)
                  try {
                    await onTestOscCommand(graphic, actionType)
                  } finally {
                    setTestingOscActionKey(null)
                  }
                }}
              />
            ) : (
              <SettingsPlaceholderCard>
                Select a profile-loaded graphic config to edit datasource and LiveBoard template settings.
              </SettingsPlaceholderCard>
            )}
          </section>
        ) : null}

        {activeTab === 'preview' ? (
          <section className='space-y-4 w-full'>
            <div className='w-full'>
              <GraphicSelectionSection
                settings={settings}
                selectedProfile={selectedProfile}
                selectedGraphicId={selectedGraphicId}
                onSelectedGraphicIdChange={setSelectedGraphicId}
                draftGraphicEntityType={draftGraphicEntityType}
                draftGraphicId={draftGraphicId}
                pendingGraphicDelete={pendingGraphicDelete}
                onDraftGraphicEntityTypeChange={setDraftGraphicEntityType}
                onDraftGraphicIdChange={setDraftGraphicId}
                onCreateGraphicConfig={handleCreateGraphicConfig}
                onDuplicateGraphicConfig={handleDuplicateGraphicConfig}
                onRequestDeleteGraphicConfig={handleDeleteGraphicRequest}
                onConfirmDeleteGraphicConfig={handleConfirmDeleteGraphic}
                onCancelDeleteGraphicConfig={() => setPendingGraphicDelete(null)}
                onAttachGraphicConfig={handleAttachGraphicToProfile}
                onDetachGraphicConfig={handleDetachGraphicFromProfile}
              />
            </div>

            {selectedGraphic ? (
              <PreviewTemplateSection
                settings={settings}
                graphic={selectedGraphic}
                activeGraphic={activeGraphic}
                previewContent={previewContent}
                updateGraphic={updateGraphic}
                updatePreviewElement={updatePreviewElement}
              />
            ) : (
              <SettingsPlaceholderCard>
                Select a profile-loaded graphic config to edit preview settings.
              </SettingsPlaceholderCard>
            )}
          </section>
        ) : null}

        {activeTab === 'assets' ? (
          <section className='space-y-4'>
            <ReferenceImagesSection
              referenceImages={settings.referenceImages}
              draftName={draftReferenceImageName}
              draftPath={draftReferenceImagePath}
              isPickingReferenceImage={isPickingReferenceImage}
              onDraftNameChange={setDraftReferenceImageName}
              onDraftPathChange={setDraftReferenceImagePath}
              onPickReferenceImage={handlePickReferenceImage}
              onAddReferenceImage={addReferenceImage}
              onRemoveReferenceImage={removeReferenceImage}
            />
          </section>
        ) : null}
      </div>
    </Panel>
  )
}

function FormSection({ title, description, children }: PropsWithChildren<{ title: string; description: string }>) {
  return (
    <section className='ap-form-section'>
      <div className='ap-form-section-header'>
        <h3 className='ap-panel-title'>{title}</h3>
        <p className={`mt-1 max-w-3xl ${settingsHelperTextClassName}`}>{description}</p>
      </div>
      <div className='space-y-4'>{children}</div>
    </section>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  showSlider = true,
  compact = false,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  showSlider?: boolean
  compact?: boolean
}) {
  return (
    <label className={`space-y-2 ${compact ? 'max-w-[8.5rem]' : ''}`}>
      <span className={settingsLabelClassName}>{label}</span>
      <div className='space-y-2'>
        <input
          type='number'
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const nextValue = Number(event.target.value)
            if (!Number.isFinite(nextValue)) {
              return
            }

            onChange(nextValue)
          }}
          className={`${settingsFieldClassName} ${compact ? 'h-8 w-[12ch] min-w-[12ch] rounded-lg px-2 py-1 text-xs' : ''}`}
        />
        {showSlider && min !== undefined && max !== undefined ? (
          <div className={`flex items-center gap-2 ${compact ? 'max-w-[8.5rem]' : ''}`}>
            <input
              type='range'
              min={min}
              max={max}
              step={step}
              value={Math.min(max, Math.max(min, value))}
              onChange={(event) => onChange(Number(event.target.value))}
              className='w-full min-w-0 accent-accent'
            />
            {!compact ? (
              <span className='min-w-14 text-right text-xs font-medium text-text-secondary'>{value}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </label>
  )
}

function ColorField({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string
  value: string | undefined
  onChange: (value: string | undefined) => void
  compact?: boolean
}) {
  const normalizedValue = normalizeHexColor(value)

  return (
    <label className={`space-y-2 ${compact ? 'max-w-[12rem]' : ''}`}>
      <span className={settingsLabelClassName}>{label}</span>
      <div className={`flex items-center gap-2 rounded-lg border border-border-muted bg-surface-app px-2 py-1.5 ${compact ? 'max-w-[10.5rem]' : ''}`}>
        <input
          type='color'
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value)}
          className={`shrink-0 cursor-pointer rounded border-0 bg-transparent p-0 ${compact ? 'h-8 w-8' : 'h-10 w-10'}`}
        />
        <input
          value={value ?? ''}
          placeholder='#ffffff'
          onChange={(event) => onChange(normalizeOptionalInput(event.target.value))}
          className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-disabled ${compact ? 'text-xs text-text-primary' : 'text-sm text-text-primary'}`}
        />
      </div>
    </label>
  )
}

function createDefaultBinding(entityType: GraphicInstanceConfig['entityType'] = 'title'): GraphicFieldBinding {
  const sourceField = getGraphicBindingSourceOptions(entityType)[0] ?? 'text'

  return {
    sourceField,
    targetField: sourceField,
    required: true,
  }
}

function createDefaultPreviewElement(index: number): PreviewElementDefinition {
  const defaultBehavior = {
    fitInBox: true,
    minScaleX: 0.7,
    fontSize: 64,
    fontFamily: 'Arial',
    textAlign: 'left' as const,
    paddingLeft: 0,
    paddingRight: 0,
  }

  return {
    id: `element-${index}`,
    kind: 'text',
    sourceField: 'text',
    previewText: 'Sample Preview Text',
    visible: true,
    transformOrigin: 'top-left',
    borderRadius: 0,
    box: { x: 120, y: 120, width: 640, height: 80 },
    textColor: '#ffffff',
    behavior: defaultBehavior,
    text: defaultBehavior,
  }
}

function getGraphicBindingSourceOptions(entityType: GraphicInstanceConfig['entityType']): string[] {
  return graphicBindingSourceFieldOptions[entityType] ?? []
}

function getGraphicBindingTargetOptions(graphic: GraphicInstanceConfig): string[] {
  const options = new Set<string>()

  for (const element of graphic.preview.elements) {
    const value = element.sourceField.trim()
    if (value) {
      options.add(value)
    }
  }

  for (const binding of graphic.bindings ?? []) {
    const value = binding.targetField.trim()
    if (value) {
      options.add(value)
    }
  }

  if (graphic.kind === 'static' || graphic.entityType === 'image') {
    options.add('staticAsset')
  }

  return [...options]
}

function createBindingDraft(graphic: GraphicInstanceConfig): GraphicFieldBinding {
  const sourceField = getGraphicBindingSourceOptions(graphic.entityType)[0] ?? 'text'
  const targetField = getGraphicBindingTargetOptions(graphic)[0] ?? sourceField

  return {
    sourceField,
    targetField,
    required: true,
  }
}

function createProfileBindingDraft(
  graphic: GraphicInstanceConfig,
  detectedColumns: string[],
): GraphicFieldBinding {
  const targetField = getGraphicBindingTargetOptions(graphic)[0] ?? ''

  return {
    sourceField: detectedColumns[0] ?? '',
    targetField,
    required: true,
  }
}

function createUniqueGraphicConfigId(settings: AppSettings, preferredId?: string): string {
  const baseId = (preferredId?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    || 'graphic-config')
  let candidate = baseId
  let index = 2

  while (settings.graphics.some((graphic) => graphic.id === candidate)) {
    candidate = `${baseId}-${index}`
    index += 1
  }

  return candidate
}

function createDefaultGraphicConfig(
  settings: AppSettings,
  entityType: GraphicInstanceConfig['entityType'],
  preferredId?: string,
): GraphicInstanceConfig {
  const id = createUniqueGraphicConfigId(settings, preferredId ?? entityType)
  const dataFileName = `${id}.json`
  const isStaticGraphic = entityType === 'image'

  return {
    id,
    name: createGraphicConfigDisplayName(id),
    entityType,
    ...(isStaticGraphic ? { kind: 'static' as const } : {}),
    dataFileName,
      ...(!isStaticGraphic ? { datasourcePath: `datasources/${dataFileName}` } : {}),
      control: {
        templateName: id.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
      },
    ...(!isStaticGraphic ? { bindings: [createDefaultBinding(entityType)] } : {}),
    ...(isStaticGraphic
      ? {
        staticAsset: {
          assetPath: `assets/${dataFileName.replace(/\.json$/i, '.png')}`,
          assetType: 'image' as const,
        },
      }
      : {}),
    preview: {
      id: `${id}-preview`,
      designWidth: 1920,
      designHeight: 1080,
      elements: [createDefaultPreviewElement(1)],
    },
    actions: [
      { actionType: 'playGraphic', label: 'Play' },
      { actionType: 'stopGraphic', label: 'Stop' },
      { actionType: 'resumeGraphic', label: 'Resume' },
    ],
  }
}

function createGraphicConfigDisplayName(graphicId: string): string {
  const normalized = graphicId.trim()
  if (normalized.length === 0) {
    return 'Unnamed graphic config'
  }

  return normalized
    .split(/[-_]+/g)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function createUniqueProfileId(settings: AppSettings): string {
  let index = settings.profiles.length + 1
  let candidate = `profile-${index}`

  while (settings.profiles.some((profile) => profile.id === candidate)) {
    index += 1
    candidate = `profile-${index}`
  }

  return candidate
}

function createUniqueSourceSchemaId(settings: AppSettings): string {
  let index = settings.sourceSchemas.length + 1
  let candidate = `csv-schema-${index}`

  while (settings.sourceSchemas.some((schema) => schema.id === candidate)) {
    index += 1
    candidate = `csv-schema-${index}`
  }

  return candidate
}

function createDefaultCsvSourceSchema(settings: AppSettings): CsvSourceSchemaConfig {
  const index = settings.sourceSchemas.length + 1

  return {
    id: createUniqueSourceSchemaId(settings),
    name: `CSV Schema ${index}`,
    type: 'csv',
    delimiter: ';',
    hasHeader: true,
    blockDetection: {
      mode: 'columnRegex',
      sourceColumn: 'Nr',
      pattern: '^---\\s*(.+?)\\s*---$',
    },
    entityMappings: {
      title: {
        enabled: true,
        fields: {
          number: 'Nr',
          title: 'Titlu',
        },
      },
      person: {
        enabled: true,
        fields: {
          name: 'Nume',
          role: 'Functie',
        },
      },
      location: {
        enabled: true,
        fields: {
          value: 'Locatie',
        },
      },
      phone: {
        enabled: false,
      },
    },
  }
}

function createUniqueReferenceImageId(settings: AppSettings, name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'reference-image'

  let candidate = base
  let index = 2

  while (settings.referenceImages.some((image) => image.id === candidate)) {
    candidate = `${base}-${index}`
    index += 1
  }

  return candidate
}

function normalizeHexColor(value: string | undefined): string {
  if (!value) {
    return '#000000'
  }

  const normalized = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized
  }

  return '#000000'
}

function normalizeOptionalInput(value: string): string | undefined {
  const normalized = value.trim()
  return normalized.length > 0 ? value : undefined
}

function getFileNameFromPath(filePath: string): string {
  const segments = filePath.split(/[\\/]/)
  return segments[segments.length - 1] ?? filePath
}

function getSelectedSourceSchema(
  settings: AppSettings,
  selectedProfile: ShowProfileConfig | undefined,
): CsvSourceSchemaConfig | undefined {
  const schemaId = selectedProfile?.source?.schemaId
  if (schemaId) {
    return settings.sourceSchemas.find((schema) => schema.id === schemaId)
  }

  return settings.sourceSchemas[0]
}

function validateCsvSchemaMessages(schema: CsvSourceSchemaConfig | undefined): string[] {
  if (!schema) {
    return ['No CSV schema is selected for the active profile.']
  }

  try {
    csvSourceSchemaConfigSchema.parse(schema)
    return []
  } catch (error) {
    return [error instanceof Error ? error.message : 'CSV schema is invalid.']
  }
}

function detectCsvHeaderColumns(
  filePath: string | undefined,
  delimiter: string,
  hasHeader: boolean,
): string[] {
  if (!filePath || !hasHeader) {
    return []
  }

  const content = window.settingsApi?.readSourceFileSync?.(filePath)
  if (!content) {
    return []
  }

  const firstSignificantLine = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  if (!firstSignificantLine) {
    return []
  }

  return splitCsvLine(firstSignificantLine, delimiter)
    .map((column) => column.trim())
    .filter((column) => column.length > 0)
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const effectiveDelimiter = delimiter === ',' ? ',' : ';'
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]

    if (character === '"') {
      const nextCharacter = line[index + 1]
      if (inQuotes && nextCharacter === '"') {
        current += '"'
        index += 1
        continue
      }

      inQuotes = !inQuotes
      continue
    }

    if (character === effectiveDelimiter && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += character
  }

  values.push(current)
  return values
}

function isValidCsvFilePath(filePath: string): boolean {
  const normalized = filePath.trim()
  if (normalized.length === 0) {
    return false
  }

  if (!normalized.toLowerCase().endsWith('.csv')) {
    return false
  }

  return !/[<>:"|?*]/.test(normalized.replace(/^[a-zA-Z]:\\/, ''))
}

function getElementBehavior(element: PreviewElementDefinition) {
  return {
    fontFamily: 'Arial',
    textAlign: 'left' as const,
    paddingLeft: 0,
    paddingRight: 0,
    ...(element.behavior ?? element.text ?? {}),
  }
}

function normalizeGraphicControlCommand(
  command: string | OscCommandConfig,
): OscCommandConfig {
  return typeof command === 'string'
    ? {
      address: command,
      args: [],
    }
    : command
}

function updateGraphicControlAddress(
  command: string | OscCommandConfig,
  address: string,
): OscCommandConfig {
  return {
    ...normalizeGraphicControlCommand(command),
    address,
  }
}

function updateGraphicControlArgs(
  command: string | OscCommandConfig,
  args: OscArgConfig[],
): OscCommandConfig {
  return {
    ...normalizeGraphicControlCommand(command),
    args,
  }
}

function createDefaultOscArg(type: OscArgType = 's'): OscArgConfig {
  return {
    type,
    value: type === 's' ? '' : 0,
  }
}

function coerceOscArgValue(type: OscArgType, currentValue: string | number): string | number {
  if (type === 's') {
    return typeof currentValue === 'string' ? currentValue : String(currentValue)
  }

  if (typeof currentValue === 'number' && Number.isFinite(currentValue)) {
    return type === 'i' ? Math.trunc(currentValue) : currentValue
  }

  const parsed = Number(currentValue)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return type === 'i' ? Math.trunc(parsed) : parsed
}

function getOscInputClass(hasError: boolean): string {
  return [
    settingsFieldClassName,
    hasError ? 'border-state-danger bg-state-danger/10 text-text-primary' : '',
  ].filter(Boolean).join(' ')
}

function getOscTargetValidationMessages(target: { host: string; port: number } | undefined): string[] {
  if (!target) {
    return ['OSC target host and port are required before APlay can trigger this graphic.']
  }

  const messages: string[] = []

  try {
    validateOscHost(target.host)
  } catch (error) {
    messages.push(error instanceof Error ? error.message : 'OSC host is invalid.')
  }

  try {
    validateOscPort(target.port)
  } catch (error) {
    messages.push(error instanceof Error ? error.message : 'OSC port is invalid.')
  }

  return messages
}

function getOscCommandValidationMessages(command: string | OscCommandConfig): string[] {
  const normalizedCommand = normalizeGraphicControlCommand(command)
  const messages: string[] = []

  try {
    validateOscAddress(normalizedCommand.address)
  } catch (error) {
    messages.push(error instanceof Error ? error.message : 'OSC address is invalid.')
  }

  normalizedCommand.args.forEach((arg, index) => {
    try {
      oscArgConfigSchema.parse(arg)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OSC arg is invalid.'
      messages.push(`Arg ${index + 1}: ${message}`)
    }
  })

  return messages
}

function getOscArgDraftKey(
  graphicId: string,
  commandKey: 'play' | 'stop' | 'resume' | 'stopall',
  argIndex: number,
): string {
  return `${graphicId}:${commandKey}:${argIndex}`
}

function getOscArgInputError(
  arg: OscArgConfig,
  draftValue: string,
): string | null {
  if (arg.type === 's') {
    return null
  }

  if (draftValue.trim().length === 0) {
    return 'Value is required.'
  }

  const numericValue = Number(draftValue)
  if (!Number.isFinite(numericValue)) {
    return arg.type === 'i' ? 'Enter a valid integer.' : 'Enter a valid number.'
  }

  if (arg.type === 'i' && !Number.isInteger(numericValue)) {
    return 'Enter a valid integer.'
  }

  return null
}

function updateElementBehavior(
  element: PreviewElementDefinition,
  updater: (behavior: NonNullable<PreviewElementDefinition['behavior']>) => NonNullable<PreviewElementDefinition['behavior']>,
): PreviewElementDefinition {
  const currentBehavior = getElementBehavior(element) ?? {}
  const nextBehavior = updater(currentBehavior)

  return {
    ...element,
    behavior: nextBehavior,
    text: nextBehavior,
  }
}

function ProfileSection({
  settings,
  selectedProfile,
  isPickingSourceFile,
  onSettingsChange,
  onProfileUpdate,
  onPickSourceFile,
  onAttachGraphicConfig,
  onDetachGraphicConfig,
}: {
  settings: AppSettings
  selectedProfile: ShowProfileConfig | undefined
  isPickingSourceFile: boolean
  onSettingsChange: (settings: AppSettings) => void
  onProfileUpdate: (updater: (profile: ShowProfileConfig) => ShowProfileConfig) => void
  onPickSourceFile: () => Promise<void>
  onAttachGraphicConfig: (graphicId: string) => void
  onDetachGraphicConfig: (graphicId: string) => void
}) {
  const availableGraphics = settings.graphics.filter((graphic) => !(selectedProfile?.graphicConfigIds ?? []).includes(graphic.id))
  const [graphicToAttach, setGraphicToAttach] = useState<string>(availableGraphics[0]?.id ?? '')

  useEffect(() => {
    if (!availableGraphics.some((graphic) => graphic.id === graphicToAttach)) {
      setGraphicToAttach(availableGraphics[0]?.id ?? '')
    }
  }, [availableGraphics, graphicToAttach])

  const addProfile = () => {
    const nextId = createUniqueProfileId(settings)
    const nextProfile: ShowProfileConfig = {
      id: nextId,
      label: `Profile ${settings.profiles.length + 1}`,
      source: {
        type: 'csv',
      },
      graphicConfigIds: selectedProfile?.graphicConfigIds ?? [],
    }

    onSettingsChange({
      ...settings,
      selectedProfileId: nextId,
      profiles: [...settings.profiles, nextProfile],
    })
  }

  const removeProfile = () => {
    if (!selectedProfile || settings.profiles.length === 1) {
      return
    }

    const nextProfiles = settings.profiles.filter((profile) => profile.id !== selectedProfile.id)
    onSettingsChange({
      ...settings,
      selectedProfileId: nextProfiles[0]?.id ?? settings.selectedProfileId,
      profiles: nextProfiles,
    })
  }

  return (
    <FormSection title='Show profiles' description='Select the active show/emission profile and control which graphic configs it loads.'>
      <label className='space-y-2'>
        <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Active profile</span>
        <select
          value={settings.selectedProfileId}
          onChange={(event) => onSettingsChange({ ...settings, selectedProfileId: event.target.value })}
          className={settingsFieldClassName}
        >
          {settings.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.label}
            </option>
          ))}
        </select>
      </label>

      <div className='grid gap-3 sm:grid-cols-2'>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Profile id</span>
          <input value={selectedProfile?.id ?? ''} readOnly className={settingsReadOnlyFieldClassName} />
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Label</span>
          <input
            value={selectedProfile?.label ?? ''}
            onChange={(event) => onProfileUpdate((profile) => ({ ...profile, label: event.target.value }))}
            className={settingsFieldClassName}
          />
        </label>
      </div>

      <div className={settingsActionRowClassName}>
        <button type='button' onClick={addProfile} className={settingsSecondaryButtonClassName}>
          Add profile
        </button>
        <button
          type='button'
          onClick={removeProfile}
          disabled={settings.profiles.length === 1}
          className={settingsDangerButtonClassName}
        >
          Remove profile
        </button>
      </div>

      <div className={`space-y-3 ${settingsSubsectionClassName}`}>
        <div>
          <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Working source file</p>
          <p className='mt-1 text-sm text-muted'>
            The working source file belongs to the active show profile and is independent from graphic config files.
          </p>
        </div>

        <div className='grid gap-3 sm:grid-cols-[10rem,minmax(0,1fr)]'>
          <label className='space-y-2'>
            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Source type</span>
            <select
              value={selectedProfile?.source?.type ?? 'csv'}
              disabled
              className={settingsReadOnlyFieldClassName}
            >
              <option value='csv'>CSV</option>
            </select>
          </label>
          <label className='space-y-2'>
            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>CSV file path</span>
            <input
              value={selectedProfile?.source?.filePath ?? ''}
              readOnly
              placeholder='No CSV file selected for this profile'
              className={settingsReadOnlyFieldClassName}
            />
          </label>
        </div>

        <div className={settingsActionRowClassName}>
          <button
            type='button'
            onClick={() => void onPickSourceFile()}
            disabled={!selectedProfile || isPickingSourceFile}
            className={settingsSecondaryButtonClassName}
          >
            {isPickingSourceFile ? 'Selecting CSV...' : 'Choose CSV file'}
          </button>
          <button
            type='button'
            onClick={() => onProfileUpdate((profile) => ({
              ...profile,
              source: {
                type: 'csv',
              },
            }))}
            disabled={!selectedProfile?.source?.filePath}
            className={settingsDangerButtonClassName}
          >
            Clear file
          </button>
        </div>

        <ProfileSourceStatus profile={selectedProfile} />
      </div>

      <div className={`space-y-4 ${settingsInsetSectionClassName}`}>
        <div className={settingsSplitActionRowClassName}>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Profile graphic configs</p>
            <p className='mt-1 text-sm text-muted'>
              Remove from profile only detaches the config from this show. It does not delete it from the global library.
            </p>
          </div>
          <span className={getStateBadgeClassName('multiSelected')}>
            Profile assignment only
          </span>
        </div>

        {(selectedProfile?.graphicConfigIds.length ?? 0) > 0 ? (
          <div className='space-y-2'>
            {selectedProfile?.graphicConfigIds.map((graphicId) => {
              const graphic = settings.graphics.find((item) => item.id === graphicId)
              if (!graphic) {
                return (
                  <div key={graphicId} className='ap-banner ap-banner-warning'>
                    Missing graphic config reference: <span className='font-semibold'>{graphicId}</span>
                  </div>
                )
              }

              return (
                <div key={graphic.id} className='ap-card px-4 py-3'>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-semibold text-text-primary'>{graphic.name}</p>
                    <p className='mt-1 text-xs uppercase tracking-[0.16em] text-muted'>{graphic.entityType}</p>
                  </div>
                  <div className='mt-3'>
                    <button
                      type='button'
                      onClick={() => onDetachGraphicConfig(graphic.id)}
                      className={settingsWarningButtonClassName}
                    >
                      Remove from profile
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className='ap-empty-state'>
            No graphic configs are assigned to this profile yet.
          </div>
        )}

        <div className={`grid gap-3 ${settingsSubsectionClassName} md:grid-cols-[minmax(0,1fr),auto] md:items-end`}>
          <label className='space-y-2'>
            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Add existing library config</span>
            <select
              value={graphicToAttach}
              onChange={(event) => setGraphicToAttach(event.target.value)}
              className={settingsFieldClassName}
            >
              {availableGraphics.length === 0 ? <option value=''>No unassigned configs available</option> : null}
              {availableGraphics.map((graphic) => (
                <option key={graphic.id} value={graphic.id}>
                  {graphic.name} | {graphic.entityType}
                </option>
              ))}
            </select>
          </label>
          <button
            type='button'
            onClick={() => graphicToAttach && onAttachGraphicConfig(graphicToAttach)}
            disabled={!graphicToAttach}
            className={settingsAccentButtonClassName}
          >
            Add to profile
          </button>
        </div>
      </div>
    </FormSection>
  )
}

function IconActionButton({
  label,
  icon,
  onClick,
  tone,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  tone: 'neutral' | 'emerald' | 'amber' | 'rose'
}) {
  const toneClass = tone === 'emerald'
    ? getControlButtonClassName({ tone: 'success', variant: 'outline' })
    : tone === 'amber'
      ? getControlButtonClassName({ tone: 'warning', variant: 'outline' })
      : tone === 'rose'
        ? getControlButtonClassName({ tone: 'danger', variant: 'outline' })
        : getControlButtonClassName()
  const badgeToneClass = tone === 'emerald'
    ? 'border-state-active/50 bg-state-active text-slate-950'
    : tone === 'amber'
      ? 'border-state-warning/50 bg-state-warning text-slate-950'
      : tone === 'rose'
        ? 'border-state-danger/50 bg-state-danger text-white'
        : 'border-border-strong bg-card text-text-primary'

  return (
    <div className='group relative'>
      <button
        type='button'
        onClick={onClick}
        aria-label={label}
        className={`inline-flex h-9 w-9 items-center justify-center !min-h-9 !px-0 !py-0 ${toneClass}`}
      >
        {icon}
      </button>
      <span className={`pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-semibold opacity-0 transition group-hover:opacity-100 ${badgeToneClass}`}>
        {label}
      </span>
    </div>
  )
}

function ProfileAddIcon() {
  return (
    <svg viewBox='0 0 20 20' fill='none' className='block h-4 w-4 shrink-0' aria-hidden='true'>
      <rect x='3.5' y='4.5' width='8.5' height='11' rx='2' stroke='currentColor' strokeWidth='1.7' />
      <path d='M7 7.5h2' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' />
      <path d='M14.5 8.5v6' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' />
      <path d='M11.5 11.5h6' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' />
    </svg>
  )
}

function ProfileRemoveIcon() {
  return (
    <svg viewBox='0 0 20 20' fill='none' className='block h-4 w-4 shrink-0' aria-hidden='true'>
      <rect x='3.5' y='4.5' width='8.5' height='11' rx='2' stroke='currentColor' strokeWidth='1.7' />
      <path d='M7 7.5h2' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' />
      <path d='M11.5 11.5h6' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' />
    </svg>
  )
}

function DuplicateIcon() {
  return (
    <svg viewBox='0 0 20 20' fill='none' className='block h-4 w-4 shrink-0' aria-hidden='true'>
      <rect x='6.5' y='6.5' width='9' height='9' rx='2' stroke='currentColor' strokeWidth='1.7' />
      <path d='M4.5 12V6a1.5 1.5 0 0 1 1.5-1.5H12' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg viewBox='0 0 20 20' fill='none' className='block h-4 w-4 shrink-0' aria-hidden='true'>
      <path d='M4.5 6h11' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' />
      <path d='M8 3.8h4' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' />
      <path d='M6.5 6 7 15a1.5 1.5 0 0 0 1.5 1.4h3a1.5 1.5 0 0 0 1.5-1.4l.5-9' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round' />
      <path d='M8.5 8.5v4.5M11.5 8.5v4.5' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' />
    </svg>
  )
}

function CsvSchemaSection({
  settings,
  selectedProfile,
  onSettingsChange,
}: {
  settings: AppSettings
  selectedProfile: ShowProfileConfig | undefined
  onSettingsChange: (settings: AppSettings) => void
}) {
  const selectedSchema = getSelectedSourceSchema(settings, selectedProfile)
  const profileGraphics = (selectedProfile?.graphicConfigIds ?? [])
    .map((graphicId) => settings.graphics.find((graphic) => graphic.id === graphicId))
    .filter((graphic): graphic is GraphicInstanceConfig => graphic !== undefined)
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])

  useEffect(() => {
    setDetectedColumns(
      detectCsvHeaderColumns(
        selectedProfile?.source?.filePath,
        selectedSchema?.delimiter ?? ';',
        selectedSchema?.hasHeader ?? true,
      ),
    )
  }, [
    selectedProfile?.source?.filePath,
    selectedSchema?.delimiter,
    selectedSchema?.hasHeader,
  ])

  const validationMessages = validateCsvSchemaMessages(selectedSchema)

  const updateSelectedSchema = (updater: (schema: CsvSourceSchemaConfig) => CsvSourceSchemaConfig) => {
    if (!selectedSchema) {
      return
    }

    onSettingsChange({
      ...settings,
      sourceSchemas: settings.sourceSchemas.map((schema) =>
        schema.id === selectedSchema.id ? updater(schema) : schema),
    })
  }

  const attachSchemaToProfile = (schemaId: string | undefined) => {
    if (!selectedProfile) {
      return
    }

    onSettingsChange({
      ...settings,
      profiles: settings.profiles.map((profile) => profile.id === selectedProfile.id
        ? {
          ...profile,
          source: {
            type: profile.source?.type ?? 'csv',
            ...(profile.source?.filePath ? { filePath: profile.source.filePath } : {}),
            ...(schemaId ? { schemaId } : {}),
          },
        }
        : profile),
    })
  }

  const addSchema = () => {
    const nextSchema = createDefaultCsvSourceSchema(settings)

    onSettingsChange({
      ...settings,
      sourceSchemas: [...settings.sourceSchemas, nextSchema],
      profiles: selectedProfile
        ? settings.profiles.map((profile) => profile.id === selectedProfile.id
          ? {
            ...profile,
            source: {
              type: profile.source?.type ?? 'csv',
              ...(profile.source?.filePath ? { filePath: profile.source.filePath } : {}),
              schemaId: nextSchema.id,
            },
          }
          : profile)
        : settings.profiles,
    })
  }

  const removeSchema = () => {
    if (!selectedSchema || settings.sourceSchemas.length <= 1) {
      return
    }

    const nextSchemas = settings.sourceSchemas.filter((schema) => schema.id !== selectedSchema.id)
    const fallbackSchemaId = nextSchemas[0]?.id

    onSettingsChange({
      ...settings,
      sourceSchemas: nextSchemas,
      profiles: settings.profiles.map((profile) => profile.source?.schemaId === selectedSchema.id
        ? {
          ...profile,
          source: {
            type: profile.source?.type ?? 'csv',
            ...(profile.source?.filePath ? { filePath: profile.source.filePath } : {}),
            ...(fallbackSchemaId ? { schemaId: fallbackSchemaId } : {}),
          },
        }
        : profile),
    })
  }

  const updateProfileGraphic = (
    graphicId: string,
    updater: (graphic: GraphicInstanceConfig) => GraphicInstanceConfig,
  ) => {
    onSettingsChange({
      ...settings,
      graphics: settings.graphics.map((graphic) => graphic.id === graphicId ? updater(graphic) : graphic),
    })
  }

  return (
    <FormSection title='CSV schema' description='Define how APlay should read the working CSV: delimiter, block detection, and manual profile graphic mappings.'>
      <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr),auto,auto]'>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Profile schema</span>
          <select
            value={selectedProfile?.source?.schemaId ?? selectedSchema?.id ?? ''}
            onChange={(event) => attachSchemaToProfile(normalizeOptionalInput(event.target.value))}
            className={settingsFieldClassName}
          >
            <option value=''>No schema selected</option>
            {settings.sourceSchemas.map((schema) => (
              <option key={schema.id} value={schema.id}>
                {schema.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type='button'
          onClick={addSchema}
          className={`self-end ${settingsSecondaryButtonClassName}`}
        >
          Add schema
        </button>
        <button
          type='button'
          onClick={removeSchema}
          disabled={!selectedSchema || settings.sourceSchemas.length <= 1}
          className={`self-end ${settingsDangerButtonClassName}`}
        >
          Remove schema
        </button>
      </div>

      {!selectedSchema ? (
        <div className={getSettingsStatusClassName('error')}>
          No CSV schema is attached to the active profile.
        </div>
      ) : (
        <>
          <div className='grid gap-3 md:grid-cols-3'>
            <label className='space-y-2 md:col-span-2'>
              <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Schema name</span>
              <input
                value={selectedSchema.name}
                onChange={(event) => updateSelectedSchema((schema) => ({ ...schema, name: event.target.value }))}
                className={settingsFieldClassName}
              />
            </label>
            <label className='space-y-2'>
              <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Delimiter</span>
              <select
                value={selectedSchema.delimiter}
                onChange={(event) => updateSelectedSchema((schema) => ({ ...schema, delimiter: event.target.value }))}
                className={settingsFieldClassName}
              >
                <option value=';'>Semicolon (;)</option>
                <option value=','>Comma (,)</option>
              </select>
            </label>
          </div>

          <label className={settingsCheckboxRowClassName}>
            <input
              type='checkbox'
              checked={selectedSchema.hasHeader}
              onChange={(event) => updateSelectedSchema((schema) => ({ ...schema, hasHeader: event.target.checked }))}
              className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
            />
            CSV has header row
          </label>

          <div className={`space-y-3 ${settingsSubsectionClassName}`}>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Block detection</p>
              <p className='mt-1 text-sm text-muted'>
                Use one source column and a regex pattern to detect editorial block delimiters.
              </p>
            </div>
            <div className='grid gap-3 md:grid-cols-2'>
              <SchemaColumnField
                label='Block source column'
                value={selectedSchema.blockDetection.sourceColumn}
                detectedColumns={detectedColumns}
                onChange={(value) => updateSelectedSchema((schema) => ({
                  ...schema,
                  blockDetection: {
                    ...schema.blockDetection,
                    sourceColumn: value,
                  },
                }))}
              />
              <label className='space-y-2'>
                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Block regex</span>
                <input
                  value={selectedSchema.blockDetection.pattern}
                  onChange={(event) => updateSelectedSchema((schema) => ({
                    ...schema,
                    blockDetection: {
                      ...schema.blockDetection,
                      pattern: event.target.value,
                    },
                  }))}
                  className={settingsFieldClassName}
                />
              </label>
            </div>
          </div>

          <div className={`space-y-3 ${settingsSubsectionClassName}`}>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Detected header columns</p>
              <p className='mt-1 text-sm text-muted'>
                {detectedColumns.length > 0
                  ? detectedColumns.join(' | ')
                  : 'No readable header row detected yet. Column fields remain editable for manual input.'}
              </p>
            </div>
          </div>

          <div className={`space-y-3 ${settingsInsetSectionClassName}`}>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Profile graphic config mapping</p>
              <p className='mt-1 text-sm text-muted'>
                Configure the CSV columns used by each graphic config assigned to this profile. These manual mappings drive the entity collections for the current show. Static configs do not require CSV data.
              </p>
            </div>

            {profileGraphics.length > 0 ? (
              <div className='space-y-2'>
                {profileGraphics.map((graphic) => {
                  const isStaticGraphic = graphic.kind === 'static' || graphic.entityType === 'image'
                  const targetOptions = getGraphicBindingTargetOptions(graphic)

                  return (
                    <div key={graphic.id} className='ap-card px-4 py-3'>
                      <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div className='min-w-0'>
                          <p className='truncate text-sm font-semibold text-text-primary'>{graphic.name}</p>
                          <p className='mt-1 text-xs uppercase tracking-[0.16em] text-muted'>{graphic.entityType}</p>
                        </div>
                        <span className={getStateBadgeClassName(isStaticGraphic ? 'active' : 'multiSelected')}>
                          {isStaticGraphic ? 'Static asset' : 'Manual bindings'}
                        </span>
                      </div>

                      {isStaticGraphic ? (
                        <p className='mt-3 text-sm text-muted'>
                          This static graphic config does not use CSV schema mapping.
                        </p>
                      ) : (
                        <div className='mt-3 space-y-3'>
                          <div className='flex items-center justify-between gap-3'>
                            <p className='text-[11px] font-semibold uppercase tracking-[0.16em] text-muted'>Graphic bindings</p>
                            <button
                              type='button'
                              onClick={() => updateProfileGraphic(
                                graphic.id,
                                (current) => ({ ...current, bindings: [...(current.bindings ?? []), createProfileBindingDraft(current, detectedColumns)] }),
                              )}
                              className={settingsSecondaryButtonClassName}
                            >
                              Add binding
                            </button>
                          </div>

                          {(graphic.bindings ?? []).length > 0 ? (
                            <div className='space-y-2'>
                              {(graphic.bindings ?? []).map((binding, index) => (
                                <div key={`${graphic.id}-${index}`} className={`grid gap-3 ${settingsInsetSectionClassName} md:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto,auto] md:items-end`}>
                                  <SchemaColumnField
                                    label='Source field'
                                    value={binding.sourceField}
                                    detectedColumns={detectedColumns}
                                    onChange={(value) => updateProfileGraphic(
                                      graphic.id,
                                      (current) => ({
                                        ...current,
                                        bindings: (current.bindings ?? []).map((item, bindingIndex) =>
                                          bindingIndex === index ? { ...item, sourceField: value } : item),
                                      }),
                                    )}
                                  />
                                  <FieldOptionSelect
                                    label='Target field'
                                    value={binding.targetField}
                                    options={targetOptions}
                                    emptyLabel='Select target field'
                                    onChange={(value) => updateProfileGraphic(
                                      graphic.id,
                                      (current) => ({
                                        ...current,
                                        bindings: (current.bindings ?? []).map((item, bindingIndex) =>
                                          bindingIndex === index ? { ...item, targetField: value } : item),
                                      }),
                                    )}
                                  />
                                  <label className={settingsCheckboxRowClassName}>
                                    <input
                                      type='checkbox'
                                      checked={binding.required ?? false}
                                      onChange={(event) => updateProfileGraphic(
                                        graphic.id,
                                        (current) => ({
                                          ...current,
                                          bindings: (current.bindings ?? []).map((item, bindingIndex) =>
                                            bindingIndex === index ? { ...item, required: event.target.checked } : item),
                                        }),
                                      )}
                                      className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
                                    />
                                    Required
                                  </label>
                                  <button
                                    type='button'
                                    onClick={() => updateProfileGraphic(
                                      graphic.id,
                                      (current) => ({
                                        ...current,
                                        bindings: (current.bindings ?? []).filter((_, bindingIndex) => bindingIndex !== index),
                                      }),
                                    )}
                                    className={settingsDangerButtonClassName}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className='ap-empty-state px-3 py-3'>
                              No bindings configured yet for this graphic config.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className='ap-empty-state'>
                No graphic configs are assigned to the active profile yet.
              </div>
            )}
          </div>

          {validationMessages.length > 0 ? (
            <div className={getSettingsStatusClassName('error')}>
              {validationMessages.join(' | ')}
            </div>
          ) : (
            <div className={getSettingsStatusClassName('success')}>
              CSV schema is structurally valid.
            </div>
          )}
        </>
      )}
    </FormSection>
  )
}

function SchemaColumnField({
  label,
  value,
  detectedColumns,
  disabled,
  onChange,
}: {
  label: string
  value: string
  detectedColumns: string[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className='space-y-2'>
      <span className={settingsLabelClassName}>{label}</span>
      {detectedColumns.length > 0 ? (
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={settingsFieldClassName}
        >
          <option value=''>Select column</option>
          {detectedColumns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={settingsFieldClassName}
        />
      )}
    </label>
  )
}

function FieldOptionSelect({
  label,
  value,
  options,
  disabled,
  emptyLabel = 'Select field',
  onChange,
}: {
  label: string
  value: string
  options: string[]
  disabled?: boolean
  emptyLabel?: string
  onChange: (value: string) => void
}) {
  const resolvedOptions = Array.from(new Set([
    ...options.filter((option) => option.trim().length > 0),
    ...(value.trim().length > 0 ? [value] : []),
  ]))

  return (
    <label className='space-y-2'>
      <span className='text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary'>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={settingsFieldClassName}
      >
        <option value=''>{emptyLabel}</option>
        {resolvedOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function ProfileSourceStatus({ profile }: { profile: ShowProfileConfig | undefined }) {
  if (!profile?.source) {
    return (
      <div className='ap-banner ap-banner-warning'>
        This profile has no source configuration yet.
      </div>
    )
  }

  if (!profile.source.filePath) {
    return (
      <div className='rounded-2xl border border-dashed border-border bg-surface-muted px-4 py-3 text-sm text-text-secondary'>
        No CSV file selected for this profile.
      </div>
    )
  }

  if (!isValidCsvFilePath(profile.source.filePath)) {
    return (
      <div className={getSettingsStatusClassName('error')}>
        The selected source path is invalid. Choose a valid `.csv` file.
      </div>
    )
  }

  return (
    <div className={getSettingsStatusClassName('success')}>
      Active source file: {profile.source.filePath}
    </div>
  )
}

function GraphicSelectionSection({
  settings,
  selectedProfile,
  selectedGraphicId,
  onSelectedGraphicIdChange,
  draftGraphicEntityType,
  draftGraphicId,
  pendingGraphicDelete,
  onDraftGraphicEntityTypeChange,
  onDraftGraphicIdChange,
  onCreateGraphicConfig,
  onDuplicateGraphicConfig,
  onRequestDeleteGraphicConfig,
  onConfirmDeleteGraphicConfig,
  onCancelDeleteGraphicConfig,
  onAttachGraphicConfig,
  onDetachGraphicConfig,
}: {
  settings: AppSettings
  selectedProfile: ShowProfileConfig | undefined
  selectedGraphicId: string | null
  onSelectedGraphicIdChange: (graphicId: string | null) => void
  draftGraphicEntityType: GraphicInstanceConfig['entityType']
  draftGraphicId: string
  pendingGraphicDelete: { graphicId: string; references: GraphicConfigReference[] } | null
  onDraftGraphicEntityTypeChange: (entityType: GraphicInstanceConfig['entityType']) => void
  onDraftGraphicIdChange: (value: string) => void
  onCreateGraphicConfig: () => void
  onDuplicateGraphicConfig: (graphicId: string) => void
  onRequestDeleteGraphicConfig: (graphicId: string) => void
  onConfirmDeleteGraphicConfig: () => void
  onCancelDeleteGraphicConfig: () => void
  onAttachGraphicConfig: (graphicId: string) => void
  onDetachGraphicConfig: (graphicId: string) => void
}) {
  return (
    <FormSection title='Graphic config library' description='Create, select, duplicate, and delete reusable graphic configs in one compact library flow.'>
      <div className='flex flex-col gap-4 xl:flex-row xl:items-start'>
        <div className='xl:w-[30%] xl:min-w-[18rem]'>
          <div className={`space-y-3 ${settingsInsetSectionClassName}`}>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Create new graphic config</p>
            </div>

            <div className='space-y-3'>
              <label className='space-y-2'>
                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Entity type</span>
                <select
                  value={draftGraphicEntityType}
                  onChange={(event) => onDraftGraphicEntityTypeChange(event.target.value as GraphicInstanceConfig['entityType'])}
                  className={settingsFieldClassName}
                >
                  {supportedEntityTypes.map((entityType) => (
                    <option key={entityType} value={entityType}>
                      {entityType}
                    </option>
                  ))}
                </select>
              </label>
              <label className='space-y-2'>
                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Preferred id</span>
                <input
                  value={draftGraphicId}
                  onChange={(event) => onDraftGraphicIdChange(event.target.value)}
                  placeholder={`${draftGraphicEntityType}-main`}
                  className={settingsFieldClassName}
                />
              </label>
              <button
                type='button'
                onClick={onCreateGraphicConfig}
                className='w-full rounded-xl border border-accent bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90'
              >
                Create config
              </button>
            </div>

            {!selectedGraphicId ? (
              <div className='rounded-2xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted'>
                Select any library graphic config card to edit it.
              </div>
            ) : null}
          </div>
        </div>

        <div className='min-w-0 flex-1'>
          <div className='space-y-3'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Graphic config library</p>
            </div>
            <span className={getStateBadgeClassName('invalid')}>
              Delete from library is global
            </span>
          </div>

          <div className={settingsCompactScrollAreaClassName}>
            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
              {settings.graphics.map((graphic) => {
                const isLoadedByProfile = selectedProfile?.graphicConfigIds.includes(graphic.id) ?? false
                const isSelected = selectedGraphicId === graphic.id
                const deleteIsPending = pendingGraphicDelete?.graphicId === graphic.id

                return (
                  <div
                    key={graphic.id}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-accent bg-accent/5'
                        : 'border-border bg-card hover:border-accent/40'
                    }`}
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <button
                        type='button'
                        onClick={() => onSelectedGraphicIdChange(graphic.id)}
                        className='min-w-0 flex-1 text-left'
                      >
                        <p className='truncate text-sm font-semibold text-text-primary'>{graphic.name}</p>
                        <p className='mt-1 text-xs uppercase tracking-[0.16em] text-muted'>{graphic.entityType}</p>
                        <p className='mt-2 text-xs text-text-secondary'>{graphic.id}</p>
                      </button>
                      <span className={getStateBadgeClassName(isLoadedByProfile ? 'active' : 'warning')}>
                        {isLoadedByProfile ? 'Assigned' : 'Library only'}
                      </span>
                    </div>

                    <div className='mt-3 flex flex-wrap items-center gap-2'>
                      <IconActionButton
                        label={isLoadedByProfile ? 'Remove from profile' : 'Add to profile'}
                        onClick={() => isLoadedByProfile ? onDetachGraphicConfig(graphic.id) : onAttachGraphicConfig(graphic.id)}
                        tone={isLoadedByProfile ? 'amber' : 'emerald'}
                        icon={isLoadedByProfile ? <ProfileRemoveIcon /> : <ProfileAddIcon />}
                      />
                      <IconActionButton
                        label='Duplicate'
                        onClick={() => onDuplicateGraphicConfig(graphic.id)}
                        tone='neutral'
                        icon={<DuplicateIcon />}
                      />
                      <IconActionButton
                        label='Delete from library'
                        onClick={() => onRequestDeleteGraphicConfig(graphic.id)}
                        tone='rose'
                        icon={<DeleteIcon />}
                      />
                    </div>
                    {deleteIsPending ? (
                      <div className='mt-3 ap-banner ap-banner-danger p-4'>
                        <p className='font-semibold'>Delete "{graphic.name}" from the library?</p>
                        {pendingGraphicDelete.references.length > 0 ? (
                          <div className='mt-2 space-y-2'>
                            <p>
                              This config is still used by: {pendingGraphicDelete.references.map((reference) => reference.profileLabel).join(', ')}.
                            </p>
                            <p>Remove it from those profiles first. Library deletion is blocked while references exist.</p>
                          </div>
                        ) : (
                          <p className='mt-2'>
                            This permanently removes the config from the reusable library for all profiles.
                          </p>
                        )}
                        <div className={`mt-3 ${settingsActionRowClassName}`}>
                          <button
                            type='button'
                            onClick={onCancelDeleteGraphicConfig}
                            className={settingsSecondaryButtonClassName}
                          >
                            Cancel
                          </button>
                          <button
                            type='button'
                            onClick={onConfirmDeleteGraphicConfig}
                            disabled={pendingGraphicDelete.references.length > 0}
                            className='rounded-xl border border-rose-500 bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition enabled:hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50'
                          >
                            Confirm delete
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        </div>
      </div>
    </FormSection>
  )
}

function ImportSummaryCard({
  summary,
  onConfirm,
  onCancel,
}: {
  summary:
    | {
      kind: 'graphic'
      filePath: string
      preview: GraphicConfigLibraryImportResult
    }
    | {
      kind: 'profile'
      filePath: string
      preview: ProfileLibraryImportResult
    }
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <section className='ap-panel p-5'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <p className='ap-section-eyebrow'>Import summary</p>
          <h3 className='mt-1 text-lg font-semibold text-text-primary'>Review before importing</h3>
          <p className='mt-1 text-sm text-text-secondary'>{summary.filePath}</p>
        </div>
        <div className={settingsActionRowClassName}>
          <button
            type='button'
            onClick={onCancel}
            className={settingsDangerButtonClassName}
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onConfirm}
            className={settingsAccentButtonClassName}
          >
            Confirm import
          </button>
        </div>
      </div>

      {summary.kind === 'graphic' ? (
        <div className='mt-4 grid gap-3 md:grid-cols-3'>
          <SummaryItem label='Name' value={summary.preview.importedGraphic.name} />
          <SummaryItem label='Kind' value={summary.preview.importedGraphic.entityType} />
          <SummaryItem
            label='Category'
            value={summary.preview.importedGraphic.datasourcePath ? 'Dynamic' : 'Static'}
          />
          <SummaryItem
            label='Conflict outcome'
            value={summary.preview.conflict
              ? `${summary.preview.conflict.policy} -> ${summary.preview.conflict.resolvedGraphicId}`
              : 'New item'}
          />
        </div>
      ) : (
        <div className='mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5'>
          <SummaryItem label='Profile name' value={summary.preview.importedProfile.label} />
          <SummaryItem label='Embedded graphics' value={String(summary.preview.importedProfile.graphicConfigIds.length)} />
          <SummaryItem label='Source schema' value={summary.preview.settings.sourceSchemas.some((schema) => schema.id === summary.preview.importedProfile.source?.schemaId) ? 'Included' : 'None'} />
          <SummaryItem
            label='Reference images'
            value={summary.preview.importedProfile.graphicConfigIds.some((graphicId) =>
              summary.preview.settings.graphics.find((graphic) => graphic.id === graphicId)?.preview.background?.referenceImageId)
              ? 'Included'
              : 'None'}
          />
          <SummaryItem
            label='Conflict outcome'
            value={createProfileConflictSummary(summary.preview)}
          />
        </div>
      )}
    </section>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className='ap-card px-4 py-3'>
      <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>{label}</p>
      <p className='mt-1 text-sm font-semibold text-text-primary'>{value}</p>
    </div>
  )
}

function createProfileConflictSummary(result: ProfileLibraryImportResult): string {
  const parts: string[] = []
  if (result.conflicts.profile) {
    parts.push(`profile ${result.conflicts.profile}`)
  }
  if (result.conflicts.graphics.length > 0) {
    parts.push(`${result.conflicts.graphics.length} graphic`)
  }
  if (result.conflicts.schemas.length > 0) {
    parts.push(`${result.conflicts.schemas.length} schema`)
  }
  if (result.conflicts.referenceImages.length > 0) {
    parts.push(`${result.conflicts.referenceImages.length} image`)
  }

  return parts.length > 0 ? parts.join(' | ') : 'No conflicts detected'
}

function ReferenceImagesSection({
  referenceImages,
  draftName,
  draftPath,
  isPickingReferenceImage,
  onDraftNameChange,
  onDraftPathChange,
  onPickReferenceImage,
  onAddReferenceImage,
  onRemoveReferenceImage,
}: {
  referenceImages: ReferenceImageAsset[]
  draftName: string
  draftPath: string
  isPickingReferenceImage: boolean
  onDraftNameChange: (value: string) => void
  onDraftPathChange: (value: string) => void
  onPickReferenceImage: () => Promise<void>
  onAddReferenceImage: () => void
  onRemoveReferenceImage: (referenceImageId: string) => void
}) {
  return (
    <FormSection title='Reference images' description='Manage reusable background images used only for Preview16x9 calibration.'>
      <div className='grid gap-4 xl:grid-cols-[minmax(0,22rem),minmax(0,1fr)]'>
        <div className={`space-y-2 ${settingsSubsectionClassName}`}>
          <label className='space-y-1.5'>
            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Image name</span>
            <input
              value={draftName}
              onChange={(event) => onDraftNameChange(event.target.value)}
              placeholder='Title reference'
              className={settingsFieldClassName}
            />
          </label>

          <div className='grid gap-2.5 sm:grid-cols-[minmax(0,1fr),auto,auto] sm:items-end'>
            <label className='space-y-1.5 sm:col-span-3'>
              <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Image file path</span>
              <input
                value={draftPath}
                onChange={(event) => onDraftPathChange(event.target.value)}
                placeholder='C:\\APlay\\references\\title.png'
                className={settingsFieldClassName}
              />
            </label>
            <button
              type='button'
              onClick={onPickReferenceImage}
              disabled={isPickingReferenceImage}
              className={settingsSecondaryButtonClassName}
            >
              {isPickingReferenceImage ? 'Choosing file...' : 'Choose image'}
            </button>
            <button
              type='button'
              onClick={onAddReferenceImage}
              disabled={draftName.trim().length === 0 || draftPath.trim().length === 0}
              className={settingsAccentButtonClassName}
            >
              Add image
            </button>
          </div>
        </div>

        <div className={`space-y-3 ${settingsSubsectionClassName}`}>
          <div className='flex items-center justify-between gap-3'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Reference image previews</p>
            <span className={getStateBadgeClassName(referenceImages.length > 0 ? 'selected' : 'disabled')}>
              Preview panel
            </span>
          </div>
          <div className='max-h-[28rem] overflow-y-auto pr-1'>
            {referenceImages.length > 0 ? (
              <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                {referenceImages.map((image) => (
                  <ReferenceImagePreviewTile
                    key={image.id}
                    image={image}
                    onRemove={() => onRemoveReferenceImage(image.id)}
                  />
                ))}
              </div>
            ) : (
              <div className='ap-empty-state rounded-2xl border border-dashed border-border bg-surface/30 p-4'>
                <p className='ap-section-title'>No reference images added yet.</p>
                <p className='mt-1 ap-help'>Preview panel</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </FormSection>
  )
}

function ReferenceImagePreviewTile({
  image,
  onRemove,
}: {
  image: ReferenceImageAsset
  onRemove: () => void
}) {
  const [hasLoadError, setHasLoadError] = useState(false)

  return (
    <article className='ap-card group overflow-hidden p-2 transition-colors hover:border-border-focus'>
      <div className='relative'>
        <div className='aspect-video overflow-hidden rounded-lg border border-border bg-surface-app transition-colors group-hover:border-border-focus'>
          {hasLoadError ? (
            <div className='flex h-full w-full items-center justify-center bg-surface-muted px-3 text-center'>
              <div>
                <p className='text-sm font-semibold text-text-primary'>Preview unavailable</p>
                <p className='mt-1 text-xs text-text-secondary'>Image could not be loaded.</p>
              </div>
            </div>
          ) : (
            <img
              src={image.filePath}
              alt={image.name}
              loading='lazy'
              onError={() => setHasLoadError(true)}
              className='h-full w-full object-cover'
            />
          )}
        </div>
        <button
          type='button'
          onClick={onRemove}
          aria-label={`Delete image ${image.name}`}
          className={`absolute right-2 top-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${settingsDangerButtonClassName}`}
        >
          Delete image
        </button>
      </div>
      <p
        className='mt-2 truncate text-center text-xs font-semibold text-text-primary'
        title={image.name}
      >
        {image.name}
      </p>
    </article>
  )
}

function GraphicBindingSection({
  graphic,
  updateGraphic,
  updateBinding,
  isPickingDatasourceJson,
  isPickingStaticAsset,
  onPickDatasourceJsonFile,
  onPickStaticAssetFile,
  testingOscActionKey,
  onTestOscCommand,
}: {
  graphic: GraphicInstanceConfig
  updateGraphic: (updater: (graphic: GraphicInstanceConfig) => GraphicInstanceConfig) => void
  updateBinding: (bindingIndex: number, updater: (binding: GraphicFieldBinding) => GraphicFieldBinding) => void
  isPickingDatasourceJson: boolean
  isPickingStaticAsset: boolean
  onPickDatasourceJsonFile: () => Promise<void>
  onPickStaticAssetFile: () => Promise<void>
  testingOscActionKey: string | null
  onTestOscCommand: (
    graphic: GraphicInstanceConfig,
    actionType: 'playGraphic' | 'stopGraphic' | 'resumeGraphic',
  ) => Promise<void>
}) {
  const isStaticGraphic = graphic.kind === 'static' || graphic.entityType === 'image'
  const sourceOptions = getGraphicBindingSourceOptions(graphic.entityType)
  const targetOptions = getGraphicBindingTargetOptions(graphic)
  const trimmedDisplayName = graphic.name.trim()
  const displayNameError = trimmedDisplayName.length === 0
    ? 'Display Name is required.'
    : null
  const normalizedOnAirMode = graphic.onAir?.mode ?? 'manual'
  const [zIndexDraft, setZIndexDraft] = useState(graphic.zIndex === undefined ? '' : String(graphic.zIndex))
  const [onAirDurationDraft, setOnAirDurationDraft] = useState(
    graphic.onAir?.mode === 'autoHide' && graphic.onAir.durationSeconds !== undefined
      ? String(graphic.onAir.durationSeconds)
      : '',
  )

  useEffect(() => {
    setZIndexDraft(graphic.zIndex === undefined ? '' : String(graphic.zIndex))
  }, [graphic.id, graphic.zIndex])

  useEffect(() => {
    setOnAirDurationDraft(
      graphic.onAir?.mode === 'autoHide' && graphic.onAir.durationSeconds !== undefined
        ? String(graphic.onAir.durationSeconds)
        : '',
    )
  }, [graphic.id, graphic.onAir?.mode, graphic.onAir?.durationSeconds])

  const trimmedZIndexDraft = zIndexDraft.trim()
  const parsedZIndex = trimmedZIndexDraft.length === 0 ? 0 : Number(trimmedZIndexDraft)
  const zIndexError = trimmedZIndexDraft.length > 0 && !Number.isFinite(parsedZIndex)
    ? 'zIndex must be a valid number.'
    : null
  const trimmedOnAirDurationDraft = onAirDurationDraft.trim()
  const parsedOnAirDuration = trimmedOnAirDurationDraft.length === 0
    ? Number.NaN
    : Number(trimmedOnAirDurationDraft)
  const onAirDurationError = normalizedOnAirMode === 'autoHide' && (
    trimmedOnAirDurationDraft.length === 0 ||
    !Number.isFinite(parsedOnAirDuration) ||
    parsedOnAirDuration <= 0
  )
    ? 'Duration must be greater than 0 seconds.'
    : null

  return (
    <FormSection title='Graphic configuration' description='Configure runtime behavior for the selected graphic config. Static graphics use image assets; dynamic graphics use datasource mappings.'>
      <div className='grid gap-3 md:grid-cols-2'>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Graphic id</span>
          <input value={graphic.id} readOnly className={settingsReadOnlyFieldClassName} />
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Display name</span>
          <input
            value={graphic.name}
            onChange={(event) => updateGraphic((current) => ({ ...current, name: event.target.value }))}
            required
            placeholder='Example: Main title'
            className={[
              settingsFieldClassName,
              displayNameError ? 'border-state-danger bg-state-danger/10 text-text-primary' : '',
            ].filter(Boolean).join(' ')}
          />
          <p className={`text-xs ${displayNameError ? 'text-red-300' : 'text-muted'}`}>
            {displayNameError ?? 'Human-readable label used everywhere in the UI.'}
          </p>
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Entity type</span>
          <select
            value={graphic.entityType}
            onChange={(event) => updateGraphic((current) => ({ ...current, entityType: event.target.value as GraphicInstanceConfig['entityType'] }))}
            className={settingsFieldClassName}
          >
            {supportedEntityTypes.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
            ))}
          </select>
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Config kind</span>
          <div className={`flex h-[42px] items-center rounded-xl border px-3 py-2 text-sm font-semibold ${
            isStaticGraphic
              ? 'border-state-active/40 bg-state-active/10 text-emerald-300'
              : 'border-state-multi/40 bg-state-multi/10 text-cyan-300'
          }`}>
            {isStaticGraphic ? 'Static graphic config' : 'Dynamic graphic config'}
          </div>
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Datasource file name</span>
          <input
            value={graphic.dataFileName}
            onChange={(event) => updateGraphic((current) => ({ ...current, dataFileName: event.target.value }))}
            className={settingsFieldClassName}
          />
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>LiveBoard template</span>
          <input
            value={graphic.control.templateName ?? ''}
            onChange={(event) => updateGraphic((current) => ({
              ...current,
              control: {
                ...current.control,
                templateName: normalizeOptionalInput(event.target.value),
              },
            }))}
            placeholder='LOWER_THIRD_01'
            className={settingsFieldClassName}
          />
        </label>
        <label className='space-y-2 md:col-span-2'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Preview z-index</span>
            <span className={getStateBadgeClassName(zIndexError ? 'invalid' : 'selected')}>
              Resolved layer in APlay preview: {zIndexError ? 'invalid' : parsedZIndex}
            </span>
          </div>
          <input
            type='number'
            inputMode='numeric'
            step='1'
            value={zIndexDraft}
            onChange={(event) => {
              const nextDraft = event.target.value
              const trimmedNextDraft = nextDraft.trim()

              setZIndexDraft(nextDraft)

              if (trimmedNextDraft.length === 0) {
                updateGraphic((current) => ({ ...current, zIndex: undefined }))
                return
              }

              const nextValue = Number(trimmedNextDraft)
              if (!Number.isFinite(nextValue)) {
                return
              }

              updateGraphic((current) => ({ ...current, zIndex: nextValue }))
            }}
            placeholder='0'
            className={[
              settingsFieldClassName,
              zIndexError ? 'border-state-danger bg-state-danger/10 text-text-primary' : '',
            ].filter(Boolean).join(' ')}
          />
          <p className={`text-xs ${zIndexError ? 'text-red-300' : 'text-muted'}`}>
            {zIndexError ?? 'Controls preview stacking only inside APlay. Leave empty to use the safe default layer 0.'}
          </p>
        </label>
      </div>

      <div className={`space-y-3 ${settingsSubsectionClassName}`}>
        <div className={settingsSplitActionRowClassName}>
          <div>
            <p className='text-sm font-semibold text-text-primary'>ONAIR behavior</p>
            <p className='mt-1 text-sm text-muted'>
              Choose whether this graphic stays visible until Stop or leaves the APlay ONAIR screen automatically.
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <span className={getStateBadgeClassName(normalizedOnAirMode === 'autoHide' ? 'selected' : 'disabled')}>
              {normalizedOnAirMode === 'autoHide' ? 'Timed ONAIR' : 'Manual ONAIR'}
            </span>
            {normalizedOnAirMode === 'autoHide' && !onAirDurationError && trimmedOnAirDurationDraft.length > 0 ? (
              <span className={getStateBadgeClassName('multiSelected')}>
                Auto-hide after {trimmedOnAirDurationDraft}s
              </span>
            ) : null}
          </div>
        </div>

        <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr),12rem] lg:items-start'>
          <div className='grid gap-2 sm:grid-cols-2'>
            <label className={`${settingsCompactCheckboxRowClassName} min-h-[42px] justify-between rounded-xl border border-border bg-surface-app/50 px-3 py-2`}>
              <span className='min-w-0'>
                <span className='block text-sm font-semibold text-text-primary'>Manual on-air</span>
                <span className='block text-xs text-muted'>Stays on-air until Stop.</span>
              </span>
              <input
                type='radio'
                name={`onair-mode-${graphic.id}`}
                checked={normalizedOnAirMode === 'manual'}
                onChange={() => {
                  setOnAirDurationDraft('')
                  updateGraphic((current) => ({
                    ...current,
                    onAir: {
                      mode: 'manual',
                    },
                  }))
                }}
                className='h-4 w-4 shrink-0 border-border text-accent focus:ring-accent'
              />
            </label>

            <label className={`${settingsCompactCheckboxRowClassName} min-h-[42px] justify-between rounded-xl border border-border bg-surface-app/50 px-3 py-2`}>
              <span className='min-w-0'>
                <span className='block text-sm font-semibold text-text-primary'>Auto-hide</span>
                <span className='block text-xs text-muted'>Timed / auto-hide after N seconds.</span>
              </span>
              <input
                type='radio'
                name={`onair-mode-${graphic.id}`}
                checked={normalizedOnAirMode === 'autoHide'}
                onChange={() => {
                  const nextDuration = graphic.onAir?.mode === 'autoHide' && graphic.onAir.durationSeconds !== undefined && graphic.onAir.durationSeconds > 0
                    ? graphic.onAir.durationSeconds
                    : 10
                  setOnAirDurationDraft(String(nextDuration))
                  updateGraphic((current) => ({
                    ...current,
                    onAir: {
                      mode: 'autoHide',
                      durationSeconds: nextDuration,
                    },
                  }))
                }}
                className='h-4 w-4 shrink-0 border-border text-accent focus:ring-accent'
              />
            </label>
          </div>

          <label className='space-y-2'>
            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Duration (seconds)</span>
            <input
              type='number'
              inputMode='numeric'
              min='1'
              step='1'
              disabled={normalizedOnAirMode !== 'autoHide'}
              value={normalizedOnAirMode === 'autoHide' ? onAirDurationDraft : ''}
              onChange={(event) => {
                const nextDraft = event.target.value
                const trimmedNextDraft = nextDraft.trim()
                setOnAirDurationDraft(nextDraft)

                if (trimmedNextDraft.length === 0) {
                  return
                }

                const nextDuration = Number(trimmedNextDraft)
                if (!Number.isFinite(nextDuration) || nextDuration <= 0) {
                  return
                }

                updateGraphic((current) => ({
                  ...current,
                  onAir: {
                    mode: 'autoHide',
                    durationSeconds: nextDuration,
                  },
                }))
              }}
              placeholder='10'
              className={[
                settingsFieldClassName,
                'max-w-[12ch]',
                normalizedOnAirMode !== 'autoHide' ? 'cursor-not-allowed opacity-60' : '',
                onAirDurationError ? 'border-state-danger bg-state-danger/10 text-text-primary' : '',
              ].filter(Boolean).join(' ')}
            />
            <p className={`text-xs ${onAirDurationError ? 'text-red-300' : 'text-muted'}`}>
              {normalizedOnAirMode === 'autoHide'
                ? (onAirDurationError ?? 'Auto-hide after the configured number of seconds.')
                : 'Duration is used only for timed ONAIR mode.'}
            </p>
          </label>
        </div>
      </div>

      {isStaticGraphic ? (
        <div className={`space-y-4 ${settingsSubsectionClassName}`}>
          <div>
            <p className='text-sm font-semibold text-emerald-300'>Static asset</p>
            <p className='mt-1 text-sm text-text-secondary'>
              Static graphic configs render directly from an image asset and do not use datasource JSON or source bindings.
            </p>
          </div>

          <div className='grid gap-3 md:grid-cols-[minmax(0,1fr),auto] md:items-end'>
            <label className='space-y-2'>
              <span className='text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300'>Asset file path</span>
              <input
                value={graphic.staticAsset?.assetPath ?? ''}
                onChange={(event) => updateGraphic((current) => ({
                  ...current,
                  kind: 'static',
                  staticAsset: {
                    assetPath: event.target.value,
                    assetType: current.staticAsset?.assetType ?? 'image',
                  },
                }))}
                placeholder='C:\\APlay\\assets\\logo.png'
                className={settingsFieldClassName}
              />
            </label>
            <button
              type='button'
              onClick={() => void onPickStaticAssetFile()}
              disabled={isPickingStaticAsset}
              className={settingsSuccessButtonClassName}
            >
              {isPickingStaticAsset ? 'Choosing...' : 'Choose image'}
            </button>
          </div>

          <div className={getSettingsStatusClassName('success')}>
            Preview, play, and stop actions remain available for static graphics. Only datasource-specific controls are hidden.
          </div>
        </div>
      ) : (
        <div className={`space-y-4 ${settingsSubsectionClassName}`}>
          <div>
            <p className='text-sm font-semibold text-cyan-300'>Dynamic datasource</p>
            <p className='mt-1 text-sm text-text-secondary'>
              Dynamic graphic configs use datasource JSON and source-field bindings to publish values at runtime.
            </p>
          </div>

          <label className='space-y-2'>
            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300'>Datasource JSON path</span>
            <div className='flex gap-2'>
              <input
                value={graphic.datasourcePath ?? ''}
                onChange={(event) => updateGraphic((current) => ({ ...current, datasourcePath: event.target.value }))}
                className={settingsFieldClassName}
              />
              <button
                type='button'
                onClick={() => void onPickDatasourceJsonFile()}
                disabled={isPickingDatasourceJson}
                className={`shrink-0 ${settingsSecondaryButtonClassName}`}
              >
                {isPickingDatasourceJson ? 'Choosing...' : 'Choose JSON'}
              </button>
            </div>
          </label>
        </div>
      )}

      <div className={`space-y-4 ${settingsInsetSectionClassName}`}>
        <div className={settingsSplitActionRowClassName}>
          <div>
            <p className='text-sm font-semibold text-text-primary'>Graphic debug actions</p>
            <p className='mt-1 text-sm text-muted'>
              Trigger the global OSC commands using the selected graphic and its configured LiveBoard template name.
            </p>
          </div>
          <span className={getStateBadgeClassName('selected')}>
            Goes through GraphicsAdapter
          </span>
        </div>

        <div className={settingsActionRowClassName}>
          {([
            { actionType: 'playGraphic', label: 'Test play' },
            { actionType: 'stopGraphic', label: 'Test stop' },
            { actionType: 'resumeGraphic', label: 'Test resume' },
          ] as const).map((action) => {
            const isTesting = testingOscActionKey === `${graphic.id}:${action.actionType}`

            return (
              <button
                key={action.actionType}
                type='button'
                onClick={() => onTestOscCommand(graphic, action.actionType)}
                disabled={isTesting}
                className={settingsAccentButtonClassName}
              >
                {isTesting ? 'Sending...' : action.label}
              </button>
            )
          })}
        </div>

        {graphic.control.templateName?.trim() ? (
          <div className={getSettingsStatusClassName('success')}>
            Template argument is ready: <span className='font-semibold'>{graphic.control.templateName}</span>
          </div>
        ) : (
          <div className='ap-banner ap-banner-warning'>
            Set a LiveBoard template name for this graphic if the global OSC commands use the <code>{'{{templateName}}'}</code> placeholder.
          </div>
        )}
      </div>

      {!isStaticGraphic ? (
        <div className='space-y-3'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Required source field bindings</p>
            <button
              type='button'
              onClick={() => updateGraphic((current) => ({ ...current, bindings: [...(current.bindings ?? []), createBindingDraft(current)] }))}
              className={settingsSecondaryButtonClassName}
            >
              Add binding
            </button>
          </div>

            {(graphic.bindings ?? []).map((binding, bindingIndex) => (
              <div key={bindingIndex} className={`${settingsNestedEditorRowClassName} md:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto,auto] md:items-end`}>
              <FieldOptionSelect
                label='Source field'
                value={binding.sourceField}
                options={sourceOptions}
                emptyLabel='Select source field'
                onChange={(value) => updateBinding(bindingIndex, (current) => ({ ...current, sourceField: value }))}
              />
              <FieldOptionSelect
                label='Target field'
                value={binding.targetField}
                options={targetOptions}
                emptyLabel='Select target field'
                onChange={(value) => updateBinding(bindingIndex, (current) => ({ ...current, targetField: value }))}
              />
              <label className={settingsCheckboxRowClassName}>
                <input
                  type='checkbox'
                  checked={binding.required ?? false}
                  onChange={(event) => updateBinding(bindingIndex, (current) => ({ ...current, required: event.target.checked }))}
                  className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
                />
                Required
              </label>
              <button
                type='button'
                onClick={() => updateGraphic((current) => ({ ...current, bindings: (current.bindings ?? []).filter((_, index) => index !== bindingIndex) }))}
                className={settingsDangerButtonClassName}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className='ap-empty-state border-state-active/30 bg-state-active/10 text-emerald-300'>
          Source bindings are hidden for static graphic configs because they render directly from the selected asset.
        </div>
      )}
    </FormSection>
  )
}

function GlobalOscSettingsSection({
  settings,
  onSettingsChange,
  oscArgDrafts,
  onOscArgDraftChange,
}: {
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
  oscArgDrafts: Record<string, string>
  onOscArgDraftChange: (draftKey: string, value: string) => void
}) {
  const oscSettings = settings.osc ?? {
    target: {
      host: '',
      port: 9000,
    },
    commands: {
      play: {
        address: '/liveboard/play',
        args: [{ type: 's' as const, value: '{{templateName}}' }],
      },
      stop: {
        address: '/liveboard/stop',
        args: [{ type: 's' as const, value: '{{templateName}}' }],
      },
      resume: {
        address: '/liveboard/resume',
        args: [{ type: 's' as const, value: '{{templateName}}' }],
      },
      stopall: {
        address: '/liveboard/stopall',
        args: [],
      },
    },
  }
  const targetValidationMessages = getOscTargetValidationMessages(oscSettings.target)
  const notificationStore = useNotificationStore()
  const lastOscTargetNotificationRef = useRef<string | null>(null)

  const updateOscSettings = (updater: (current: NonNullable<AppSettings['osc']>) => NonNullable<AppSettings['osc']>) => {
    onSettingsChange({
      ...settings,
      osc: updater(oscSettings),
    })
  }

  useEffect(() => {
    if (targetValidationMessages.length === 0) {
      lastOscTargetNotificationRef.current = null
      return
    }

    const nextMessage = targetValidationMessages.join(' | ')
    if (lastOscTargetNotificationRef.current === nextMessage) {
      return
    }

    notificationStore.publish({
      variant: 'danger',
      title: 'OSC target',
      message: nextMessage,
      timeoutMs: 8000,
    })
    lastOscTargetNotificationRef.current = nextMessage
  }, [notificationStore, targetValidationMessages])

  return (
    <div className='grid gap-4 xl:grid-cols-3 xl:items-start'>
      <FormSection title='OSC target' description=''>
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-1'>
          <label className='space-y-2'>
            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Host</span>
            <input
              value={oscSettings.target.host}
              onChange={(event) => updateOscSettings((current) => ({
                ...current,
                target: {
                  ...current.target,
                  host: event.target.value,
                },
              }))}
              placeholder='127.0.0.1'
              className={getOscInputClass(targetValidationMessages.some((message) => message.includes('host')))}
            />
          </label>
          <label className='space-y-2 xl:max-w-[10rem]'>
            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Port</span>
            <input
              type='number'
              min={1}
              max={65535}
              value={oscSettings.target.port}
              onChange={(event) => updateOscSettings((current) => ({
                ...current,
                target: {
                  ...current.target,
                  port: Number(event.target.value),
                },
              }))}
              className={getOscInputClass(targetValidationMessages.some((message) => message.includes('port')))}
            />
          </label>
        </div>

      </FormSection>

      <GlobalOscCommandEditor
        label='Play command'
        commandKey='play'
        command={oscSettings.commands.play}
        updateCommand={(command) => updateOscSettings((current) => ({
          ...current,
          commands: {
            ...current.commands,
            play: command,
          },
        }))}
        oscArgDrafts={oscArgDrafts}
        onOscArgDraftChange={onOscArgDraftChange}
      />
      <GlobalOscCommandEditor
        label='Stop command'
        commandKey='stop'
        command={oscSettings.commands.stop}
        updateCommand={(command) => updateOscSettings((current) => ({
          ...current,
          commands: {
            ...current.commands,
            stop: command,
          },
        }))}
        oscArgDrafts={oscArgDrafts}
        onOscArgDraftChange={onOscArgDraftChange}
      />
      <GlobalOscCommandEditor
        label='Resume command'
        commandKey='resume'
        command={oscSettings.commands.resume}
        updateCommand={(command) => updateOscSettings((current) => ({
          ...current,
          commands: {
            ...current.commands,
            resume: command,
          },
        }))}
        oscArgDrafts={oscArgDrafts}
        onOscArgDraftChange={onOscArgDraftChange}
      />
      <GlobalOscCommandEditor
        label='Stopall command'
        commandKey='stopall'
        command={oscSettings.commands.stopall}
        updateCommand={(command) => updateOscSettings((current) => ({
          ...current,
          commands: {
            ...current.commands,
            stopall: command,
          },
        }))}
        oscArgDrafts={oscArgDrafts}
        onOscArgDraftChange={onOscArgDraftChange}
      />
    </div>
  )
}

function OscCommandEditor({
  graphic,
  commandKey,
  label,
  command,
  updateGraphic,
  oscArgDrafts,
  onOscArgDraftChange,
  testingOscActionKey,
  onTestOscCommand,
}: {
  graphic: GraphicInstanceConfig
  commandKey: 'play' | 'stop' | 'resume'
  label: string
  command: string | OscCommandConfig
  updateGraphic: (updater: (graphic: GraphicInstanceConfig) => GraphicInstanceConfig) => void
  oscArgDrafts: Record<string, string>
  onOscArgDraftChange: (draftKey: string, value: string) => void
  testingOscActionKey: string | null
  onTestOscCommand: (
    graphic: GraphicInstanceConfig,
    actionType: 'playGraphic' | 'stopGraphic' | 'resumeGraphic',
  ) => Promise<void>
}) {
  const normalizedCommand = normalizeGraphicControlCommand(command)
  const validationMessages = getOscCommandValidationMessages(command)
  const commandHasAddressError = validationMessages.some((message) => message.includes('start with "/"'))
  const actionType = commandKey === 'play' ? 'playGraphic' : commandKey === 'stop' ? 'stopGraphic' : 'resumeGraphic'
  const isTesting = testingOscActionKey === `${graphic.id}:${actionType}`

  const updateCommand = (nextCommand: OscCommandConfig) => {
    updateGraphic((current) => ({
      ...current,
      control: {
        ...current.control,
        [commandKey]: nextCommand,
      },
    }))
  }

  return (
    <section className='ap-form-section'>
      <div className={settingsSplitActionRowClassName}>
        <div>
          <p className='text-sm font-semibold text-text-primary'>{label}</p>
          <p className='mt-1 text-sm text-muted'>
            Configure the OSC address and typed arguments that APlay should send for this command.
          </p>
        </div>
        <button
          type='button'
          onClick={() => updateCommand({
            ...normalizedCommand,
            args: [...normalizedCommand.args, createDefaultOscArg()],
          })}
          className={settingsSecondaryButtonClassName}
        >
          Add arg
        </button>
        <button
          type='button'
          onClick={() => onTestOscCommand(graphic, actionType)}
          disabled={isTesting}
          className={settingsAccentButtonClassName}
        >
          {isTesting ? 'Sending...' : 'Test send'}
        </button>
      </div>

      <label className='space-y-2'>
        <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Address</span>
        <input
          value={normalizedCommand.address}
          onChange={(event) => updateCommand(updateGraphicControlAddress(command, event.target.value))}
          placeholder='/custom/play'
          className={getOscInputClass(commandHasAddressError)}
        />
      </label>

      {normalizedCommand.args.length === 0 ? (
        <div className='rounded-2xl border border-dashed border-border bg-surface/20 px-4 py-3 text-sm text-muted'>
          No args configured. That is valid for commands that only need an OSC address.
        </div>
      ) : (
        <div className={settingsCompactFieldGroupClassName}>
          {normalizedCommand.args.map((arg, argIndex) => {
            const draftKey = getOscArgDraftKey(graphic.id, commandKey, argIndex)
            const draftValue = oscArgDrafts[draftKey] ?? String(arg.value)
            const argError = getOscArgInputError(arg, draftValue)

            return (
              <div key={draftKey} className={`${settingsNestedEditorRowClassName} md:grid-cols-[7rem,minmax(0,1fr),auto] md:items-end`}>
                <label className='space-y-2'>
                  <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Type</span>
                  <select
                    value={arg.type}
                    onChange={(event) => {
                      const nextType = event.target.value as OscArgType
                      updateCommand(updateGraphicControlArgs(command, normalizedCommand.args.map((currentArg, currentIndex) => currentIndex === argIndex
                        ? {
                          type: nextType,
                          value: coerceOscArgValue(nextType, currentArg.value),
                        }
                        : currentArg)))
                      onOscArgDraftChange(
                        draftKey,
                        String(coerceOscArgValue(nextType, arg.value)),
                      )
                    }}
                    className={getOscInputClass(false)}
                  >
                    {oscArgTypes.map((argType) => (
                      <option key={argType} value={argType}>
                        {argType}
                      </option>
                    ))}
                  </select>
                </label>

                <label className='space-y-2'>
                  <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Value</span>
                  <input
                    type={arg.type === 's' ? 'text' : 'number'}
                    step={arg.type === 'f' ? 'any' : 1}
                    value={draftValue}
                    onChange={(event) => {
                      const nextDraftValue = event.target.value
                      onOscArgDraftChange(draftKey, nextDraftValue)

                      if (arg.type === 's') {
                        updateCommand(updateGraphicControlArgs(command, normalizedCommand.args.map((currentArg, currentIndex) => currentIndex === argIndex
                          ? {
                            ...currentArg,
                            value: nextDraftValue,
                          }
                          : currentArg)))
                        return
                      }

                      const numericValue = Number(nextDraftValue)
                      if (!Number.isFinite(numericValue)) {
                        return
                      }

                      if (arg.type === 'i' && !Number.isInteger(numericValue)) {
                        return
                      }

                      updateCommand(updateGraphicControlArgs(command, normalizedCommand.args.map((currentArg, currentIndex) => currentIndex === argIndex
                        ? {
                          ...currentArg,
                          value: arg.type === 'i' ? Math.trunc(numericValue) : numericValue,
                        }
                        : currentArg)))
                    }}
                    placeholder={arg.type === 's' ? 'TemplateName' : arg.type === 'i' ? '1' : '0.5'}
                    className={getOscInputClass(argError !== null)}
                  />
                  {argError ? (
                    <p className='text-xs font-medium text-red-300'>{argError}</p>
                  ) : (
                    <p className='text-xs text-muted'>
                      {arg.type === 's' ? 'String value' : arg.type === 'i' ? 'Integer value' : 'Float value'}
                    </p>
                  )}
                </label>

                <button
                  type='button'
                  onClick={() => updateCommand(updateGraphicControlArgs(command, normalizedCommand.args.filter((_, currentIndex) => currentIndex !== argIndex)))}
                  className={`${settingsDangerButtonClassName} self-start md:self-end`}
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      )}

      {validationMessages.length > 0 ? (
        <div className={getSettingsStatusClassName('error')}>
          {validationMessages.map((message) => <p key={message}>{message}</p>)}
        </div>
      ) : (
        <div className={getSettingsStatusClassName('success')}>
          Command config is valid and ready to save.
        </div>
      )}
    </section>
  )
}

function GlobalOscCommandEditor({
  label,
  commandKey,
  command,
  updateCommand,
  oscArgDrafts,
  onOscArgDraftChange,
}: {
  label: string
  commandKey: 'play' | 'stop' | 'resume' | 'stopall'
  command: OscCommandConfig
  updateCommand: (command: OscCommandConfig) => void
  oscArgDrafts: Record<string, string>
  onOscArgDraftChange: (draftKey: string, value: string) => void
}) {
  const validationMessages = getOscCommandValidationMessages(command)
  const commandHasAddressError = validationMessages.some((message) => message.includes('start with "/"'))
  const notificationStore = useNotificationStore()
  const lastOscCommandNotificationRef = useRef<string | null>(null)

  useEffect(() => {
    if (validationMessages.length === 0) {
      lastOscCommandNotificationRef.current = null
      return
    }

    const nextMessage = validationMessages.join(' | ')
    if (lastOscCommandNotificationRef.current === nextMessage) {
      return
    }

    notificationStore.publish({
      variant: 'danger',
      title: label,
      message: nextMessage,
      timeoutMs: 8000,
    })
    lastOscCommandNotificationRef.current = nextMessage
  }, [label, notificationStore, validationMessages])

  return (
    <section className='ap-form-section'>
      <div className={settingsSplitActionRowClassName}>
        <div>
          <p className='text-sm font-semibold text-text-primary'>{label}</p>
        </div>
        <button
          type='button'
          onClick={() => updateCommand({
            ...command,
            args: [...command.args, createDefaultOscArg()],
          })}
          className={settingsSecondaryButtonClassName}
        >
          Add arg
        </button>
      </div>

      <label className='space-y-2'>
        <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Address</span>
        <input
          value={command.address}
          onChange={(event) => updateCommand({
            ...command,
            address: event.target.value,
          })}
          placeholder='/liveboard/play'
          className={getOscInputClass(commandHasAddressError)}
        />
      </label>

      <div className={settingsCompactFieldGroupClassName}>
        {command.args.map((arg, argIndex) => {
          const draftKey = getOscArgDraftKey(`global-${commandKey}`, commandKey, argIndex)
          const draftValue = oscArgDrafts[draftKey] ?? String(arg.value)
          const argError = getOscArgInputError(arg, draftValue)

          return (
            <div key={draftKey} className={`${settingsNestedEditorRowClassName} md:grid-cols-[7rem,minmax(0,1fr),auto] md:items-end`}>
              <label className='space-y-2'>
                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Type</span>
                <select
                  value={arg.type}
                  onChange={(event) => {
                    const nextType = event.target.value as OscArgType
                    updateCommand({
                      ...command,
                      args: command.args.map((currentArg, currentIndex) => currentIndex === argIndex
                        ? { type: nextType, value: coerceOscArgValue(nextType, currentArg.value) }
                        : currentArg),
                    })
                    onOscArgDraftChange(draftKey, String(coerceOscArgValue(nextType, arg.value)))
                  }}
                  className={getOscInputClass(false)}
                >
                  {oscArgTypes.map((argType) => (
                    <option key={argType} value={argType}>
                      {argType}
                    </option>
                  ))}
                </select>
              </label>

              <label className='space-y-2'>
                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Value</span>
                <input
                  type={arg.type === 's' ? 'text' : 'number'}
                  step={arg.type === 'f' ? 'any' : 1}
                  value={draftValue}
                  onChange={(event) => {
                    const nextDraftValue = event.target.value
                    onOscArgDraftChange(draftKey, nextDraftValue)

                    if (arg.type === 's') {
                      updateCommand({
                        ...command,
                        args: command.args.map((currentArg, currentIndex) => currentIndex === argIndex
                          ? { ...currentArg, value: nextDraftValue }
                          : currentArg),
                      })
                      return
                    }

                    const numericValue = Number(nextDraftValue)
                    if (!Number.isFinite(numericValue)) {
                      return
                    }
                    if (arg.type === 'i' && !Number.isInteger(numericValue)) {
                      return
                    }

                    updateCommand({
                      ...command,
                      args: command.args.map((currentArg, currentIndex) => currentIndex === argIndex
                        ? { ...currentArg, value: arg.type === 'i' ? Math.trunc(numericValue) : numericValue }
                        : currentArg),
                    })
                  }}
                  className={getOscInputClass(argError !== null)}
                />
                {argError ? (
                  <p className='text-xs font-medium text-red-300'>{argError}</p>
                ) : null}
              </label>

              <button
                type='button'
                onClick={() => updateCommand({
                  ...command,
                  args: command.args.filter((_, currentIndex) => currentIndex !== argIndex),
                })}
                className={`${settingsDangerButtonClassName} self-start md:self-end`}
              >
                Remove
              </button>
            </div>
          )
        })}
      </div>

    </section>
  )
}

function PreviewTemplateSection({
  settings,
  graphic,
  activeGraphic,
  previewContent,
  updateGraphic,
  updatePreviewElement,
}: {
  settings: AppSettings
  graphic: GraphicInstanceConfig
  activeGraphic?: GraphicInstanceConfig
  previewContent: Record<string, string | undefined>
  updateGraphic: (updater: (graphic: GraphicInstanceConfig) => GraphicInstanceConfig) => void
  updatePreviewElement: (
    elementIndex: number,
    updater: (element: PreviewElementDefinition) => PreviewElementDefinition,
  ) => void
}) {
  const previewBackground = resolveActivePreviewBackground(settings, graphic)
  const resolvedPreviewContent = graphic.staticAsset?.assetPath
    ? { ...previewContent, staticAsset: graphic.staticAsset.assetPath }
    : previewContent
  const previewElementCardClassName = 'space-y-2.5 rounded-xl border border-border bg-card p-2.5 sm:p-3'
  const previewElementGroupClassName = 'space-y-2 rounded-xl border border-border-muted bg-surface-muted px-2.5 py-2'

  return (
    <FormSection title='Preview template' description='Edit the APlay-side preview approximation for the selected graphic.'>
      <div className='grid gap-4 xl:grid-cols-2 xl:items-start'>
        <div className='space-y-4'>
          <div className='grid gap-3 md:grid-cols-[minmax(0,1fr),9rem,9rem]'>
            <label className='space-y-2'>
              <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Template id</span>
              <input
                value={graphic.preview.id}
                onChange={(event) => updateGraphic((current) => ({ ...current, preview: { ...current.preview, id: event.target.value } }))}
                className={settingsFieldClassName}
              />
            </label>
            <NumberField label='Design width' value={graphic.preview.designWidth} min={320} max={3840} step={10} onChange={(value) => updateGraphic((current) => ({ ...current, preview: { ...current.preview, designWidth: value } }))} />
            <NumberField label='Design height' value={graphic.preview.designHeight} min={180} max={2160} step={10} onChange={(value) => updateGraphic((current) => ({ ...current, preview: { ...current.preview, designHeight: value } }))} />
          </div>

          <div className={`space-y-3 ${settingsSubsectionClassName}`}>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Preview background</p>
              <p className='mt-1 text-sm text-muted'>
                Background images are used only for APlay preview calibration and do not affect LiveBoard output.
              </p>
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
              <label className='space-y-2 md:col-span-2'>
                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Reference image</span>
                <select
                  value={graphic.preview.background?.referenceImageId ?? ''}
                  onChange={(event) => updateGraphic((current) => ({
                    ...current,
                    preview: {
                      ...current.preview,
                      background: event.target.value
                        ? {
                          opacity: current.preview.background?.opacity ?? 1,
                          fitMode: current.preview.background?.fitMode ?? 'contain',
                          position: current.preview.background?.position ?? 'center',
                          referenceImageId: event.target.value,
                        }
                        : {
                          opacity: current.preview.background?.opacity ?? 1,
                          fitMode: current.preview.background?.fitMode ?? 'contain',
                          position: current.preview.background?.position ?? 'center',
                        },
                    },
                  }))}
                  className={settingsFieldClassName}
                >
                  <option value=''>No background</option>
                  {settings.referenceImages.map((referenceImage) => (
                    <option key={referenceImage.id} value={referenceImage.id}>
                      {referenceImage.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className='space-y-2'>
                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>
                  Opacity {Math.round((graphic.preview.background?.opacity ?? 1) * 100)}%
                </span>
                <input
                  type='range'
                  min='0'
                  max='1'
                  step='0.05'
                  value={graphic.preview.background?.opacity ?? 1}
                  onChange={(event) => updateGraphic((current) => ({
                    ...current,
                    preview: {
                      ...current.preview,
                      background: {
                        referenceImageId: current.preview.background?.referenceImageId,
                        opacity: Number(event.target.value),
                        fitMode: current.preview.background?.fitMode ?? 'contain',
                        position: current.preview.background?.position ?? 'center',
                      },
                    },
                  }))}
                  className='w-full accent-accent'
                />
              </label>

              <label className='space-y-2'>
                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Fit mode</span>
                <select
                  value={graphic.preview.background?.fitMode ?? 'contain'}
                  onChange={(event) => updateGraphic((current) => ({
                    ...current,
                    preview: {
                      ...current.preview,
                      background: {
                        referenceImageId: current.preview.background?.referenceImageId,
                        opacity: current.preview.background?.opacity ?? 1,
                        fitMode: event.target.value as 'contain' | 'cover',
                        position: current.preview.background?.position ?? 'center',
                      },
                    },
                  }))}
                  className={settingsFieldClassName}
                >
                  <option value='contain'>Contain</option>
                  <option value='cover'>Cover</option>
                </select>
              </label>
            </div>

            <div className={settingsActionRowClassName}>
              <button
                type='button'
                onClick={() => updateGraphic((current) => ({
                  ...current,
                  preview: {
                    ...current.preview,
                    background: {
                      opacity: current.preview.background?.opacity ?? 1,
                      fitMode: current.preview.background?.fitMode ?? 'contain',
                      position: current.preview.background?.position ?? 'center',
                    },
                  },
                }))}
                className={settingsSecondaryButtonClassName}
              >
                Clear selection
              </button>
            </div>

            {previewBackground.diagnostics.length > 0 ? (
              <div className='ap-banner ap-banner-warning'>
                {previewBackground.diagnostics.join(' | ')}
              </div>
            ) : null}
          </div>

          <div className={settingsCompactFieldGroupClassName}>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Preview elements</p>
              <button
                type='button'
                onClick={() => updateGraphic((current) => ({ ...current, preview: { ...current.preview, elements: [...current.preview.elements, createDefaultPreviewElement(current.preview.elements.length + 1)] } }))}
                className={settingsSecondaryButtonClassName}
              >
                Add element
              </button>
            </div>

            <div className={settingsCompactScrollAreaClassName}>
              {graphic.preview.elements.map((element, elementIndex) => {
                const textBehavior = getElementBehavior(element)

                return (
                  <div key={`${elementIndex}`} className={previewElementCardClassName}>
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
                      <p className='text-sm font-semibold text-text-primary'>{element.id}</p>
                      <label className={settingsCompactCheckboxRowClassName}>
                        <input
                          type='checkbox'
                          checked={element.visible ?? true}
                          onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, visible: event.target.checked }))}
                          className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
                        />
                        {element.visible ?? true ? 'VIEW' : 'HIDE'}
                      </label>
                      {element.kind === 'text' ? (
                        <label className={settingsCompactCheckboxRowClassName}>
                          <input
                            type='checkbox'
                            checked={textBehavior?.allCaps ?? false}
                            onChange={(event) => updatePreviewElement(elementIndex, (current) =>
                              updateElementBehavior(current, (behavior) => ({ ...behavior, allCaps: event.target.checked })))}
                            className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
                          />
                          ALL CAPS
                        </label>
                      ) : null}
                      {element.kind === 'text' ? (
                        <label className={settingsCompactCheckboxRowClassName}>
                          <input
                            type='checkbox'
                            checked={textBehavior?.fitInBox ?? false}
                            onChange={(event) => updatePreviewElement(elementIndex, (current) =>
                              updateElementBehavior(current, (behavior) => ({ ...behavior, fitInBox: event.target.checked })))}
                            className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
                          />
                          Fit in box
                        </label>
                      ) : null}
                    </div>
                    <button
                      type='button'
                      onClick={() => updateGraphic((current) => ({ ...current, preview: { ...current.preview, elements: current.preview.elements.filter((_, index) => index !== elementIndex) } }))}
                      disabled={graphic.preview.elements.length === 1}
                      className={settingsDangerButtonClassName}
                    >
                      Remove
                    </button>
                  </div>

                  <div className={previewElementGroupClassName}>
                    <div className='grid gap-2.5 md:grid-cols-[minmax(0,1fr),9rem,9rem]'>
                      <label className='space-y-2'>
                        <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Element id</span>
                        <input
                          value={element.id}
                          onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, id: event.target.value }))}
                          className={settingsFieldClassName}
                        />
                      </label>
                      <label className='space-y-2'>
                        <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Kind</span>
                        <select
                          value={element.kind}
                          onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, kind: event.target.value as PreviewElementKind }))}
                          className={settingsFieldClassName}
                        >
                          {previewElementKinds.map((kind) => (
                            <option key={kind} value={kind}>
                              {kind}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className='space-y-2'>
                        <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Source field</span>
                        <input
                          value={element.sourceField}
                          onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, sourceField: event.target.value }))}
                          className={settingsFieldClassName}
                        />
                      </label>
                    </div>
                    {element.kind === 'text' ? (
                      <div className='max-w-[24rem]'>
                        <label className='space-y-2'>
                          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Preview text override</span>
                          <input
                            value={element.previewText ?? ''}
                            onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, previewText: normalizeOptionalInput(event.target.value) }))}
                            placeholder='Write the exact text you want to arrange in preview'
                            className={settingsFieldClassName}
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>

                  <div className={previewElementGroupClassName}>
                    <div className='grid gap-2.5 md:grid-cols-[8.5rem,8.5rem,minmax(0,8.5rem)]'>
                      <NumberField compact label='Border radius' value={element.borderRadius ?? 0} min={0} max={200} step={1} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, borderRadius: value }))} />
                      <label className='max-w-[10.5rem] space-y-2'>
                        <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Transform origin</span>
                        <select
                          value={element.transformOrigin ?? 'top-left'}
                          onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, transformOrigin: event.target.value as TransformOrigin }))}
                          className={`${settingsFieldClassName} max-w-[10.5rem] h-7 rounded-lg px-1.5 py-0.5 text-[11px]`}
                        >
                          {transformOrigins.map((origin) => (
                            <option key={origin} value={origin}>
                              {origin}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className={previewElementGroupClassName}>
                    <div className='grid gap-2.5 md:grid-cols-2'>
                      <div className='grid gap-2.5 grid-cols-2'>
                        <NumberField compact label='X' value={element.box.x} min={0} max={1920} step={1} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, box: { ...current.box, x: value } }))} />
                        <NumberField compact label='Y' value={element.box.y} min={0} max={1080} step={1} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, box: { ...current.box, y: value } }))} />
                      </div>
                      <div className='grid gap-2.5 grid-cols-2'>
                        <NumberField compact label='Width' value={element.box.width} min={0} max={1920} step={1} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, box: { ...current.box, width: value } }))} />
                        <NumberField compact label='Height' value={element.box.height} min={0} max={1080} step={1} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, box: { ...current.box, height: value } }))} />
                      </div>
                    </div>
                  </div>

                  <div className={previewElementGroupClassName}>
                    <div className='grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3'>
                      <ColorField
                        compact
                        label='Text color'
                        value={element.textColor}
                        onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, textColor: value }))}
                      />
                      <ColorField
                        compact
                        label='Background color'
                        value={element.backgroundColor}
                        onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, backgroundColor: value }))}
                      />
                      <ColorField
                        compact
                        label='Border color'
                        value={element.borderColor}
                        onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, borderColor: value }))}
                      />
                    </div>
                  </div>
                  {element.kind === 'text' ? (
                    <div className={previewElementGroupClassName}>
                      <div className='grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3'>
                        <NumberField compact label='Font size' value={textBehavior?.fontSize ?? 64} min={0} max={300} step={1} onChange={(value) => updatePreviewElement(elementIndex, (current) =>
                          updateElementBehavior(current, (behavior) => ({ ...behavior, fontSize: value })))} />
                        <NumberField compact label='Min scaleX' value={textBehavior?.minScaleX ?? 0} min={0} max={1} step={0.01} onChange={(value) => updatePreviewElement(elementIndex, (current) =>
                          updateElementBehavior(current, (behavior) => ({ ...behavior, minScaleX: value })))} />
                        <label className='max-w-[10.5rem] space-y-2'>
                          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Text align</span>
                          <select
                            value={textBehavior?.textAlign ?? 'left'}
                            onChange={(event) => updatePreviewElement(elementIndex, (current) =>
                              updateElementBehavior(current, (behavior) => ({ ...behavior, textAlign: event.target.value as 'left' | 'center' })))}
                            className={`${settingsFieldClassName} max-w-[10.5rem] h-7 rounded-lg px-1.5 py-0.5 text-[11px]`}
                          >
                            <option value='left'>Left</option>
                            <option value='center'>Center</option>
                          </select>
                        </label>
                      </div>
                      <div className='grid gap-2.5 md:grid-cols-[8.5rem,8.5rem,minmax(0,12rem)]'>
                        <NumberField compact label='Padding left' value={textBehavior?.paddingLeft ?? 0} min={0} max={400} step={1} showSlider={false} onChange={(value) => updatePreviewElement(elementIndex, (current) =>
                          updateElementBehavior(current, (behavior) => ({ ...behavior, paddingLeft: value })))} />
                        <NumberField compact label='Padding right' value={textBehavior?.paddingRight ?? 0} min={0} max={400} step={1} showSlider={false} onChange={(value) => updatePreviewElement(elementIndex, (current) =>
                          updateElementBehavior(current, (behavior) => ({ ...behavior, paddingRight: value })))} />
                        <label className='max-w-[12rem] space-y-2'>
                          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Font family</span>
                          <input
                            value={textBehavior?.fontFamily ?? 'Arial'}
                            onChange={(event) => updatePreviewElement(elementIndex, (current) =>
                              updateElementBehavior(current, (behavior) => ({ ...behavior, fontFamily: normalizeOptionalInput(event.target.value) })))}
                            placeholder='Arial, Helvetica, "My Local Font"'
                            className={`${settingsFieldClassName} max-w-[12rem] h-8 rounded-lg px-2 py-1 text-xs`}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <PreviewCanvasSidebar settings={settings} graphic={graphic} activeGraphic={activeGraphic} previewContent={resolvedPreviewContent} />
      </div>
    </FormSection>
  )
}

