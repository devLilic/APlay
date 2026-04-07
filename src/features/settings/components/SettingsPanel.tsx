import { useEffect, useState, type PropsWithChildren } from 'react'
import { supportedEntityTypes } from '@/core/entities/entityTypes'
import { PreviewCanvas } from '@/features/preview/components/PreviewCanvas'
import type {
  AppSettings,
  CsvSourceSchemaConfig,
  GraphicFieldBinding,
  GraphicInstanceConfig,
  PreviewElementDefinition,
  PreviewElementKind,
  ReferenceImageAsset,
  ShowProfileConfig,
  TransformOrigin,
} from '@/settings/models/appConfig'
import { csvSourceSchemaConfigSchema } from '@/settings/schemas/appConfigSchemas'
import { resolveActivePreviewBackground } from '@/settings/utils/previewBackgrounds'
import { Panel } from '@/shared/ui/panel'

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
  onSettingsChange: (settings: AppSettings) => void
  onSave: () => void
  onReload: () => void
}

const transformOrigins: TransformOrigin[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']
const previewElementKinds: PreviewElementKind[] = ['text', 'box', 'image']

export function SettingsPanel({
  settings,
  diagnostics,
  feedback,
  selectedGraphic: activeGraphic,
  previewContent,
  onSettingsChange,
  onSave,
  onReload,
}: SettingsPanelProps) {
  const selectedProfile = settings.profiles.find((profile) => profile.id === settings.selectedProfileId)
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(selectedProfile?.graphicConfigIds[0] ?? null)
  const [draftReferenceImageName, setDraftReferenceImageName] = useState('')
  const [draftReferenceImagePath, setDraftReferenceImagePath] = useState('')
  const [isPickingReferenceImage, setIsPickingReferenceImage] = useState(false)
  const [isPickingSourceFile, setIsPickingSourceFile] = useState(false)

  useEffect(() => {
    const nextGraphicId = selectedProfile?.graphicConfigIds[0] ?? null

    if (!selectedProfile) {
      setSelectedGraphicId(null)
      return
    }

    if (!selectedGraphicId || !selectedProfile.graphicConfigIds.includes(selectedGraphicId)) {
      setSelectedGraphicId(nextGraphicId)
    }
  }, [selectedGraphicId, selectedProfile])

  const selectedGraphic = selectedGraphicId
    ? settings.graphics.find((graphic) => graphic.id === selectedGraphicId)
    : undefined

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

    onSettingsChange({
      ...settings,
      graphics: settings.graphics.map((graphic) => graphic.id === selectedGraphic.id ? updater(graphic) : graphic),
    })
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

  return (
    <Panel
      title='Settings'
      eyebrow='Application config'
      aside={(
        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            onClick={onReload}
            className='rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:border-accent'
          >
            Reload
          </button>
          <button
            type='button'
            onClick={onSave}
            className='rounded-xl border border-accent bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-accent/90'
          >
            Save settings
          </button>
        </div>
      )}
    >
      <div className='space-y-6'>
        <div className='rounded-2xl border border-border bg-surface/40 p-4'>
          <p className='text-sm font-semibold text-ink'>Preview settings are APlay-side only</p>
          <p className='mt-1 text-sm text-muted'>
            These forms edit the application preview approximation and output bindings. LiveBoard styling is not edited here.
          </p>
        </div>

        {feedback ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            {feedback.message}
          </div>
        ) : null}

        {diagnostics.length > 0 ? (
          <div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700'>
            {diagnostics.join(' | ')}
          </div>
        ) : null}

        <section className='grid gap-6 xl:grid-cols-[22rem,minmax(0,1fr)]'>
          <div className='space-y-4'>
            <ProfileSection
              settings={settings}
              selectedProfile={selectedProfile}
              isPickingSourceFile={isPickingSourceFile}
              onSettingsChange={onSettingsChange}
              onProfileUpdate={updateProfile}
              onPickSourceFile={handlePickSourceFile}
            />

            <CsvSchemaSection
              settings={settings}
              selectedProfile={selectedProfile}
              onSettingsChange={onSettingsChange}
            />

            <GraphicSelectionSection
              settings={settings}
              selectedProfile={selectedProfile}
              selectedGraphicId={selectedGraphicId}
              onSelectedGraphicIdChange={setSelectedGraphicId}
            />

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
          </div>

          <div className='space-y-4'>
            {selectedGraphic ? (
              <>
                <GraphicBindingSection graphic={selectedGraphic} updateGraphic={updateGraphic} updateBinding={updateBinding} />
                <PreviewTemplateSection
                  settings={settings}
                  graphic={selectedGraphic}
                  activeGraphic={activeGraphic}
                  previewContent={previewContent}
                  updateGraphic={updateGraphic}
                  updatePreviewElement={updatePreviewElement}
                />
              </>
            ) : (
              <div className='rounded-2xl border border-dashed border-border bg-surface/30 p-6 text-sm text-muted'>
                Select a profile-loaded graphic config to edit preview and output settings.
              </div>
            )}
          </div>
        </section>
      </div>
    </Panel>
  )
}

function FormSection({ title, description, children }: PropsWithChildren<{ title: string; description: string }>) {
  return (
    <section className='space-y-4 rounded-3xl border border-border bg-panel p-5 shadow-panel'>
      <div>
        <h3 className='text-lg font-semibold text-ink'>{title}</h3>
        <p className='mt-1 text-sm text-muted'>{description}</p>
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
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  showSlider?: boolean
}) {
  return (
    <label className='space-y-2'>
      <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>{label}</span>
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
          className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
        />
        {showSlider && min !== undefined && max !== undefined ? (
          <div className='flex items-center gap-3'>
            <input
              type='range'
              min={min}
              max={max}
              step={step}
              value={Math.min(max, Math.max(min, value))}
              onChange={(event) => onChange(Number(event.target.value))}
              className='w-full accent-accent'
            />
            <span className='min-w-14 text-right text-xs font-medium text-muted'>{value}</span>
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
}: {
  label: string
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  const normalizedValue = normalizeHexColor(value)

  return (
    <label className='space-y-2'>
      <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>{label}</span>
      <div className='flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2'>
        <input
          type='color'
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value)}
          className='h-10 w-12 cursor-pointer rounded border-0 bg-transparent p-0'
        />
        <input
          value={value ?? ''}
          placeholder='#ffffff'
          onChange={(event) => onChange(normalizeOptionalInput(event.target.value))}
          className='w-full bg-transparent text-sm text-ink outline-none'
        />
      </div>
    </label>
  )
}

function createDefaultBinding(): GraphicFieldBinding {
  return {
    sourceField: 'text',
    targetField: 'text',
    required: true,
  }
}

function createDefaultPreviewElement(index: number): PreviewElementDefinition {
  const defaultBehavior = { fitInBox: true, minScaleX: 0.7, fontSize: 64, fontFamily: 'Arial', textAlign: 'left' as const }

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
      supertitle: {
        enabled: false,
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
      breakingNews: {
        enabled: true,
        fields: {
          value: 'Ultima Ora',
        },
      },
      waitingTitle: {
        enabled: true,
        fields: {
          value: 'Titlu Asteptare',
        },
      },
      waitingLocation: {
        enabled: true,
        fields: {
          value: 'Locatie Asteptare',
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
    ...(element.behavior ?? element.text ?? {}),
  }
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
}: {
  settings: AppSettings
  selectedProfile: ShowProfileConfig | undefined
  isPickingSourceFile: boolean
  onSettingsChange: (settings: AppSettings) => void
  onProfileUpdate: (updater: (profile: ShowProfileConfig) => ShowProfileConfig) => void
  onPickSourceFile: () => Promise<void>
}) {
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
          className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
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
          <input value={selectedProfile?.id ?? ''} readOnly className='w-full rounded-xl border border-border bg-slate-100 px-3 py-2 text-sm text-muted' />
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Label</span>
          <input
            value={selectedProfile?.label ?? ''}
            onChange={(event) => onProfileUpdate((profile) => ({ ...profile, label: event.target.value }))}
            className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
          />
        </label>
      </div>

      <div className='flex flex-wrap gap-2'>
        <button type='button' onClick={addProfile} className='rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-accent'>
          Add profile
        </button>
        <button
          type='button'
          onClick={removeProfile}
          disabled={settings.profiles.length === 1}
          className='rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition enabled:hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50'
        >
          Remove profile
        </button>
      </div>

      <div className='space-y-3 rounded-2xl border border-border bg-white p-4'>
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
              className='w-full rounded-xl border border-border bg-slate-100 px-3 py-2 text-sm font-medium text-muted'
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
              className='w-full rounded-xl border border-border bg-slate-100 px-3 py-2 text-sm text-muted'
            />
          </label>
        </div>

        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            onClick={() => void onPickSourceFile()}
            disabled={!selectedProfile || isPickingSourceFile}
            className='rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-50'
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
            className='rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition enabled:hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50'
          >
            Clear file
          </button>
        </div>

        <ProfileSourceStatus profile={selectedProfile} />
      </div>

      <div className='space-y-3'>
        <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Loaded graphic configs</p>
        {settings.graphics.map((graphic) => {
          const checked = selectedProfile?.graphicConfigIds.includes(graphic.id) ?? false

          return (
            <label key={graphic.id} className='flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'>
              <input
                type='checkbox'
                checked={checked}
                onChange={(event) =>
                  onProfileUpdate((profile) => ({
                    ...profile,
                    graphicConfigIds: event.target.checked
                      ? Array.from(new Set([...profile.graphicConfigIds, graphic.id]))
                      : profile.graphicConfigIds.filter((graphicId) => graphicId !== graphic.id),
                  }))}
                className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
              />
              <span className='font-medium'>{graphic.id}</span>
              <span className='text-muted'>{graphic.entityType}</span>
            </label>
          )
        })}
      </div>
    </FormSection>
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

  return (
    <FormSection title='CSV schema' description='Define how APlay should understand the working CSV: delimiter, block detection, and entity column mappings.'>
      <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr),auto,auto]'>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Profile schema</span>
          <select
            value={selectedProfile?.source?.schemaId ?? selectedSchema?.id ?? ''}
            onChange={(event) => attachSchemaToProfile(normalizeOptionalInput(event.target.value))}
            className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
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
          className='self-end rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-accent'
        >
          Add schema
        </button>
        <button
          type='button'
          onClick={removeSchema}
          disabled={!selectedSchema || settings.sourceSchemas.length <= 1}
          className='self-end rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition enabled:hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50'
        >
          Remove schema
        </button>
      </div>

      {!selectedSchema ? (
        <div className='rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700'>
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
                className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
              />
            </label>
            <label className='space-y-2'>
              <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Delimiter</span>
              <select
                value={selectedSchema.delimiter}
                onChange={(event) => updateSelectedSchema((schema) => ({ ...schema, delimiter: event.target.value }))}
                className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
              >
                <option value=';'>Semicolon (;)</option>
                <option value=','>Comma (,)</option>
              </select>
            </label>
          </div>

          <label className='flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'>
            <input
              type='checkbox'
              checked={selectedSchema.hasHeader}
              onChange={(event) => updateSelectedSchema((schema) => ({ ...schema, hasHeader: event.target.checked }))}
              className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
            />
            CSV has header row
          </label>

          <div className='space-y-3 rounded-2xl border border-border bg-white p-4'>
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
                  className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
                />
              </label>
            </div>
          </div>

          <div className='space-y-3 rounded-2xl border border-border bg-white p-4'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Detected header columns</p>
              <p className='mt-1 text-sm text-muted'>
                {detectedColumns.length > 0
                  ? detectedColumns.join(' | ')
                  : 'No readable header row detected yet. Column fields remain editable for manual input.'}
              </p>
            </div>
          </div>

          <div className='space-y-4'>
            <CsvEntityMappingCard
              title='Title'
              enabled={selectedSchema.entityMappings.title.enabled}
              onToggle={(enabled) => updateSelectedSchema((schema) => ({
                ...schema,
                entityMappings: {
                  ...schema.entityMappings,
                  title: enabled
                    ? {
                      enabled: true,
                      fields: schema.entityMappings.title.fields ?? { number: '', title: '' },
                    }
                    : { enabled: false },
                },
              }))}
            >
              <div className='grid gap-3 md:grid-cols-2'>
                <SchemaColumnField
                  label='Title number column'
                  value={selectedSchema.entityMappings.title.fields?.number ?? ''}
                  detectedColumns={detectedColumns}
                  disabled={!selectedSchema.entityMappings.title.enabled}
                  onChange={(value) => updateSelectedSchema((schema) => ({
                    ...schema,
                    entityMappings: {
                      ...schema.entityMappings,
                      title: {
                        enabled: true,
                        fields: {
                          number: value,
                          title: schema.entityMappings.title.fields?.title ?? '',
                        },
                      },
                    },
                  }))}
                />
                <SchemaColumnField
                  label='Title text column'
                  value={selectedSchema.entityMappings.title.fields?.title ?? ''}
                  detectedColumns={detectedColumns}
                  disabled={!selectedSchema.entityMappings.title.enabled}
                  onChange={(value) => updateSelectedSchema((schema) => ({
                    ...schema,
                    entityMappings: {
                      ...schema.entityMappings,
                      title: {
                        enabled: true,
                        fields: {
                          number: schema.entityMappings.title.fields?.number ?? '',
                          title: value,
                        },
                      },
                    },
                  }))}
                />
              </div>
            </CsvEntityMappingCard>

            <CsvEntityMappingCard
              title='Supertitle'
              enabled={selectedSchema.entityMappings.supertitle.enabled}
              onToggle={(enabled) => updateSelectedSchema((schema) => ({
                ...schema,
                entityMappings: {
                  ...schema.entityMappings,
                  supertitle: enabled
                    ? {
                      enabled: true,
                      fields: { text: schema.entityMappings.supertitle.fields?.text ?? '' },
                    }
                    : { enabled: false },
                },
              }))}
            >
              <SchemaColumnField
                label='Supertitle value column'
                value={selectedSchema.entityMappings.supertitle.fields?.text ?? ''}
                detectedColumns={detectedColumns}
                disabled={!selectedSchema.entityMappings.supertitle.enabled}
                onChange={(value) => updateSelectedSchema((schema) => ({
                  ...schema,
                  entityMappings: {
                    ...schema.entityMappings,
                    supertitle: {
                      enabled: true,
                      fields: { text: value },
                    },
                  },
                }))}
              />
            </CsvEntityMappingCard>

            <CsvEntityMappingCard
              title='Person'
              enabled={selectedSchema.entityMappings.person.enabled}
              onToggle={(enabled) => updateSelectedSchema((schema) => ({
                ...schema,
                entityMappings: {
                  ...schema.entityMappings,
                  person: enabled
                    ? {
                      enabled: true,
                      fields: schema.entityMappings.person.fields ?? { name: '', role: '' },
                    }
                    : { enabled: false },
                },
              }))}
            >
              <div className='grid gap-3 md:grid-cols-2'>
                <SchemaColumnField
                  label='Person name column'
                  value={selectedSchema.entityMappings.person.fields?.name ?? ''}
                  detectedColumns={detectedColumns}
                  disabled={!selectedSchema.entityMappings.person.enabled}
                  onChange={(value) => updateSelectedSchema((schema) => ({
                    ...schema,
                    entityMappings: {
                      ...schema.entityMappings,
                      person: {
                        enabled: true,
                        fields: {
                          name: value,
                          role: schema.entityMappings.person.fields?.role ?? '',
                        },
                      },
                    },
                  }))}
                />
                <SchemaColumnField
                  label='Person role column'
                  value={selectedSchema.entityMappings.person.fields?.role ?? ''}
                  detectedColumns={detectedColumns}
                  disabled={!selectedSchema.entityMappings.person.enabled}
                  onChange={(value) => updateSelectedSchema((schema) => ({
                    ...schema,
                    entityMappings: {
                      ...schema.entityMappings,
                      person: {
                        enabled: true,
                        fields: {
                          name: schema.entityMappings.person.fields?.name ?? '',
                          role: value,
                        },
                      },
                    },
                  }))}
                />
              </div>
            </CsvEntityMappingCard>

            <CsvEntityMappingCard
              title='Location'
              enabled={selectedSchema.entityMappings.location.enabled}
              onToggle={(enabled) => updateSelectedSchema((schema) => ({
                ...schema,
                entityMappings: {
                  ...schema.entityMappings,
                  location: enabled
                    ? { enabled: true, fields: { value: schema.entityMappings.location.fields?.value ?? '' } }
                    : { enabled: false },
                },
              }))}
            >
              <SchemaColumnField
                label='Location value column'
                value={selectedSchema.entityMappings.location.fields?.value ?? ''}
                detectedColumns={detectedColumns}
                disabled={!selectedSchema.entityMappings.location.enabled}
                onChange={(value) => updateSelectedSchema((schema) => ({
                  ...schema,
                  entityMappings: {
                    ...schema.entityMappings,
                    location: { enabled: true, fields: { value } },
                  },
                }))}
              />
            </CsvEntityMappingCard>

            <CsvEntityMappingCard
              title='Breaking News'
              enabled={selectedSchema.entityMappings.breakingNews.enabled}
              onToggle={(enabled) => updateSelectedSchema((schema) => ({
                ...schema,
                entityMappings: {
                  ...schema.entityMappings,
                  breakingNews: enabled
                    ? { enabled: true, fields: { value: schema.entityMappings.breakingNews.fields?.value ?? '' } }
                    : { enabled: false },
                },
              }))}
            >
              <SchemaColumnField
                label='BreakingNews value column'
                value={selectedSchema.entityMappings.breakingNews.fields?.value ?? ''}
                detectedColumns={detectedColumns}
                disabled={!selectedSchema.entityMappings.breakingNews.enabled}
                onChange={(value) => updateSelectedSchema((schema) => ({
                  ...schema,
                  entityMappings: {
                    ...schema.entityMappings,
                    breakingNews: { enabled: true, fields: { value } },
                  },
                }))}
              />
            </CsvEntityMappingCard>

            <CsvEntityMappingCard
              title='Waiting Title'
              enabled={selectedSchema.entityMappings.waitingTitle.enabled}
              onToggle={(enabled) => updateSelectedSchema((schema) => ({
                ...schema,
                entityMappings: {
                  ...schema.entityMappings,
                  waitingTitle: enabled
                    ? { enabled: true, fields: { value: schema.entityMappings.waitingTitle.fields?.value ?? '' } }
                    : { enabled: false },
                },
              }))}
            >
              <SchemaColumnField
                label='WaitingTitle value column'
                value={selectedSchema.entityMappings.waitingTitle.fields?.value ?? ''}
                detectedColumns={detectedColumns}
                disabled={!selectedSchema.entityMappings.waitingTitle.enabled}
                onChange={(value) => updateSelectedSchema((schema) => ({
                  ...schema,
                  entityMappings: {
                    ...schema.entityMappings,
                    waitingTitle: { enabled: true, fields: { value } },
                  },
                }))}
              />
            </CsvEntityMappingCard>

            <CsvEntityMappingCard
              title='Waiting Location'
              enabled={selectedSchema.entityMappings.waitingLocation.enabled}
              onToggle={(enabled) => updateSelectedSchema((schema) => ({
                ...schema,
                entityMappings: {
                  ...schema.entityMappings,
                  waitingLocation: enabled
                    ? { enabled: true, fields: { value: schema.entityMappings.waitingLocation.fields?.value ?? '' } }
                    : { enabled: false },
                },
              }))}
            >
              <SchemaColumnField
                label='WaitingLocation value column'
                value={selectedSchema.entityMappings.waitingLocation.fields?.value ?? ''}
                detectedColumns={detectedColumns}
                disabled={!selectedSchema.entityMappings.waitingLocation.enabled}
                onChange={(value) => updateSelectedSchema((schema) => ({
                  ...schema,
                  entityMappings: {
                    ...schema.entityMappings,
                    waitingLocation: { enabled: true, fields: { value } },
                  },
                }))}
              />
            </CsvEntityMappingCard>

            <CsvEntityMappingCard
              title='Phone'
              enabled={selectedSchema.entityMappings.phone.enabled}
              onToggle={(enabled) => updateSelectedSchema((schema) => ({
                ...schema,
                entityMappings: {
                  ...schema.entityMappings,
                  phone: enabled
                    ? {
                      enabled: true,
                      fields: schema.entityMappings.phone.fields ?? { label: '', number: '' },
                    }
                    : { enabled: false },
                },
              }))}
            >
              <div className='grid gap-3 md:grid-cols-2'>
                <SchemaColumnField
                  label='Phone label column'
                  value={selectedSchema.entityMappings.phone.fields?.label ?? ''}
                  detectedColumns={detectedColumns}
                  disabled={!selectedSchema.entityMappings.phone.enabled}
                  onChange={(value) => updateSelectedSchema((schema) => ({
                    ...schema,
                    entityMappings: {
                      ...schema.entityMappings,
                      phone: {
                        enabled: true,
                        fields: {
                          label: value,
                          number: schema.entityMappings.phone.fields?.number ?? '',
                        },
                      },
                    },
                  }))}
                />
                <SchemaColumnField
                  label='Phone value column'
                  value={selectedSchema.entityMappings.phone.fields?.number ?? ''}
                  detectedColumns={detectedColumns}
                  disabled={!selectedSchema.entityMappings.phone.enabled}
                  onChange={(value) => updateSelectedSchema((schema) => ({
                    ...schema,
                    entityMappings: {
                      ...schema.entityMappings,
                      phone: {
                        enabled: true,
                        fields: {
                          label: schema.entityMappings.phone.fields?.label ?? '',
                          number: value,
                        },
                      },
                    },
                  }))}
                />
              </div>
            </CsvEntityMappingCard>
          </div>

          {validationMessages.length > 0 ? (
            <div className='rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700'>
              {validationMessages.join(' | ')}
            </div>
          ) : (
            <div className='rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700'>
              CSV schema is structurally valid.
            </div>
          )}
        </>
      )}
    </FormSection>
  )
}

function CsvEntityMappingCard({
  title,
  enabled,
  onToggle,
  children,
}: PropsWithChildren<{
  title: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
}>) {
  return (
    <div className='space-y-3 rounded-2xl border border-border bg-white p-4'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <p className='text-sm font-semibold text-ink'>{title}</p>
          <p className='mt-1 text-xs uppercase tracking-[0.18em] text-muted'>
            {enabled ? 'Mapping enabled' : 'Mapping disabled'}
          </p>
        </div>
        <label className='flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink'>
          <input
            type='checkbox'
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
            className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
          />
          Enable
        </label>
      </div>
      {children}
    </div>
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
      <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>{label}</span>
      {detectedColumns.length > 0 ? (
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-muted'
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
          className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-muted'
        />
      )}
    </label>
  )
}

function ProfileSourceStatus({ profile }: { profile: ShowProfileConfig | undefined }) {
  if (!profile?.source) {
    return (
      <div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700'>
        This profile has no source configuration yet.
      </div>
    )
  }

  if (!profile.source.filePath) {
    return (
      <div className='rounded-2xl border border-dashed border-border bg-surface/30 px-4 py-3 text-sm text-muted'>
        No CSV file selected for this profile.
      </div>
    )
  }

  if (!isValidCsvFilePath(profile.source.filePath)) {
    return (
      <div className='rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700'>
        The selected source path is invalid. Choose a valid `.csv` file.
      </div>
    )
  }

  return (
    <div className='rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700'>
      Active source file: {profile.source.filePath}
    </div>
  )
}

function GraphicSelectionSection({
  settings,
  selectedProfile,
  selectedGraphicId,
  onSelectedGraphicIdChange,
}: {
  settings: AppSettings
  selectedProfile: ShowProfileConfig | undefined
  selectedGraphicId: string | null
  onSelectedGraphicIdChange: (graphicId: string | null) => void
}) {
  return (
    <FormSection title='Graphic config selection' description='Edit one graphic config at a time. Changes update the current preview and output behavior.'>
      <label className='space-y-2'>
        <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Graphic config</span>
        <select
          value={selectedGraphicId ?? ''}
          onChange={(event) => onSelectedGraphicIdChange(event.target.value || null)}
          className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
        >
          {(selectedProfile?.graphicConfigIds ?? []).map((graphicId) => {
            const graphic = settings.graphics.find((candidate) => candidate.id === graphicId)

            return graphic ? (
              <option key={graphic.id} value={graphic.id}>
                {graphic.id} | {graphic.entityType}
              </option>
            ) : null
          })}
        </select>
      </label>

      {!selectedGraphicId ? (
        <div className='rounded-2xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted'>
          This profile does not currently load any graphic config.
        </div>
      ) : null}
    </FormSection>
  )
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
      <div className='space-y-3 rounded-2xl border border-border bg-white p-4'>
        <div className='grid gap-3'>
          <label className='space-y-2'>
            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Image name</span>
            <input
              value={draftName}
              onChange={(event) => onDraftNameChange(event.target.value)}
              placeholder='Title reference'
              className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
            />
          </label>

          <label className='space-y-2'>
            <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Image file path</span>
            <input
              value={draftPath}
              onChange={(event) => onDraftPathChange(event.target.value)}
              placeholder='C:\\APlay\\references\\title.png'
              className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
            />
          </label>
        </div>

        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            onClick={onPickReferenceImage}
            disabled={isPickingReferenceImage}
            className='rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition enabled:hover:border-accent disabled:cursor-not-allowed disabled:opacity-50'
          >
            {isPickingReferenceImage ? 'Choosing file...' : 'Choose image'}
          </button>
          <button
            type='button'
            onClick={onAddReferenceImage}
            disabled={draftName.trim().length === 0 || draftPath.trim().length === 0}
            className='rounded-xl border border-accent bg-accent px-3 py-2 text-sm font-semibold text-white transition enabled:hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50'
          >
            Add image
          </button>
        </div>
      </div>

      <div className='space-y-3'>
        <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Available reference images</p>
        {referenceImages.length > 0 ? (
          <div className='space-y-3'>
            {referenceImages.map((image) => (
              <div key={image.id} className='flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-white p-4'>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-semibold text-ink'>{image.name}</p>
                  <p className='mt-1 text-xs uppercase tracking-[0.16em] text-muted'>{image.id}</p>
                  <p className='mt-2 break-all text-sm text-muted'>{image.filePath}</p>
                </div>
                <button
                  type='button'
                  onClick={() => onRemoveReferenceImage(image.id)}
                  className='rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-rose-400'
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className='rounded-2xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted'>
            No reference images added yet.
          </div>
        )}
      </div>
    </FormSection>
  )
}

function GraphicBindingSection({
  graphic,
  updateGraphic,
  updateBinding,
}: {
  graphic: GraphicInstanceConfig
  updateGraphic: (updater: (graphic: GraphicInstanceConfig) => GraphicInstanceConfig) => void
  updateBinding: (bindingIndex: number, updater: (binding: GraphicFieldBinding) => GraphicFieldBinding) => void
}) {
  return (
    <FormSection title='Graphic bindings' description='Datasource path, OSC mappings, and required source fields live with the selected graphic config.'>
      <div className='grid gap-3 md:grid-cols-2'>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Graphic id</span>
          <input value={graphic.id} readOnly className='w-full rounded-xl border border-border bg-slate-100 px-3 py-2 text-sm text-muted' />
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Entity type</span>
          <select
            value={graphic.entityType}
            onChange={(event) => updateGraphic((current) => ({ ...current, entityType: event.target.value as GraphicInstanceConfig['entityType'] }))}
            className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
          >
            {supportedEntityTypes.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
            ))}
          </select>
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Datasource file name</span>
          <input
            value={graphic.dataFileName}
            onChange={(event) => updateGraphic((current) => ({ ...current, dataFileName: event.target.value }))}
            className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
          />
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Datasource JSON path</span>
          <input
            value={graphic.datasourcePath ?? ''}
            onChange={(event) => updateGraphic((current) => ({ ...current, datasourcePath: event.target.value }))}
            className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
          />
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>OSC play</span>
          <input
            value={graphic.control.play}
            onChange={(event) => updateGraphic((current) => ({ ...current, control: { ...current.control, play: event.target.value } }))}
            className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
          />
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>OSC stop</span>
          <input
            value={graphic.control.stop}
            onChange={(event) => updateGraphic((current) => ({ ...current, control: { ...current.control, stop: event.target.value } }))}
            className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
          />
        </label>
        <label className='space-y-2 md:col-span-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>OSC resume</span>
          <input
            value={graphic.control.resume}
            onChange={(event) => updateGraphic((current) => ({ ...current, control: { ...current.control, resume: event.target.value } }))}
            className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
          />
        </label>
      </div>

      <div className='space-y-3'>
        <div className='flex items-center justify-between gap-3'>
          <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Required source field bindings</p>
          <button
            type='button'
            onClick={() => updateGraphic((current) => ({ ...current, bindings: [...(current.bindings ?? []), createDefaultBinding()] }))}
            className='rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-accent'
          >
            Add binding
          </button>
        </div>

        {(graphic.bindings ?? []).map((binding, bindingIndex) => (
          <div key={`${binding.targetField}-${bindingIndex}`} className='grid gap-3 rounded-2xl border border-border bg-white p-4 md:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto,auto] md:items-end'>
            <label className='space-y-2'>
              <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Source field</span>
              <input
                value={binding.sourceField}
                onChange={(event) => updateBinding(bindingIndex, (current) => ({ ...current, sourceField: event.target.value }))}
                className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
              />
            </label>
            <label className='space-y-2'>
              <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Target field</span>
              <input
                value={binding.targetField}
                onChange={(event) => updateBinding(bindingIndex, (current) => ({ ...current, targetField: event.target.value }))}
                className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
              />
            </label>
            <label className='flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink'>
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
              className='rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-rose-400'
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </FormSection>
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

  return (
    <FormSection title='Preview template' description='Edit the APlay-side preview approximation for the selected graphic.'>
      <div className='grid gap-6 2xl:grid-cols-[minmax(0,1.2fr),minmax(22rem,0.8fr)]'>
        <div className='space-y-4'>
          <div className='grid gap-3 md:grid-cols-3'>
            <label className='space-y-2'>
              <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Template id</span>
              <input
                value={graphic.preview.id}
                onChange={(event) => updateGraphic((current) => ({ ...current, preview: { ...current.preview, id: event.target.value } }))}
                className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
              />
            </label>
            <NumberField label='Design width' value={graphic.preview.designWidth} min={320} max={3840} step={10} onChange={(value) => updateGraphic((current) => ({ ...current, preview: { ...current.preview, designWidth: value } }))} />
            <NumberField label='Design height' value={graphic.preview.designHeight} min={180} max={2160} step={10} onChange={(value) => updateGraphic((current) => ({ ...current, preview: { ...current.preview, designHeight: value } }))} />
          </div>

          <div className='space-y-3 rounded-2xl border border-border bg-white p-4'>
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
                  className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
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
                  className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
                >
                  <option value='contain'>Contain</option>
                  <option value='cover'>Cover</option>
                </select>
              </label>
            </div>

            <div className='flex flex-wrap gap-2'>
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
                className='rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-accent'
              >
                Clear selection
              </button>
            </div>

            {previewBackground.diagnostics.length > 0 ? (
              <div className='rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700'>
                {previewBackground.diagnostics.join(' | ')}
              </div>
            ) : null}
          </div>

          <div className='space-y-3'>
            <div className='flex items-center justify-between gap-3'>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Preview elements</p>
              <button
                type='button'
                onClick={() => updateGraphic((current) => ({ ...current, preview: { ...current.preview, elements: [...current.preview.elements, createDefaultPreviewElement(current.preview.elements.length + 1)] } }))}
                className='rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-accent'
              >
                Add element
              </button>
            </div>

            {graphic.preview.elements.map((element, elementIndex) => {
              const textBehavior = getElementBehavior(element)

              return (
                <div key={element.id} className='space-y-4 rounded-2xl border border-border bg-white p-4'>
                <div className='flex items-center justify-between gap-3'>
                  <p className='text-sm font-semibold text-ink'>{element.id}</p>
                  <button
                    type='button'
                    onClick={() => updateGraphic((current) => ({ ...current, preview: { ...current.preview, elements: current.preview.elements.filter((_, index) => index !== elementIndex) } }))}
                    disabled={graphic.preview.elements.length === 1}
                    className='rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition enabled:hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    Remove
                  </button>
                </div>

                <div className='grid gap-3 md:grid-cols-3'>
                  <label className='space-y-2'>
                    <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Element id</span>
                    <input
                      value={element.id}
                      onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, id: event.target.value }))}
                      className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
                    />
                  </label>
                  <label className='space-y-2'>
                    <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Kind</span>
                    <select
                      value={element.kind}
                      onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, kind: event.target.value as PreviewElementKind }))}
                      className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
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
                      className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
                    />
                  </label>
                  {element.kind === 'text' ? (
                    <label className='space-y-2 md:col-span-2'>
                      <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Preview text override</span>
                      <input
                        value={element.previewText ?? ''}
                        onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, previewText: normalizeOptionalInput(event.target.value) }))}
                        placeholder='Write the exact text you want to arrange in preview'
                        className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
                      />
                    </label>
                  ) : null}
                  <label className='flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink'>
                    <input
                      type='checkbox'
                      checked={element.visible ?? true}
                      onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, visible: event.target.checked }))}
                      className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
                    />
                    {element.visible ?? true ? 'VIEW' : 'HIDE'}
                  </label>
                  <NumberField label='X' value={element.box.x} min={0} max={1920} step={1} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, box: { ...current.box, x: value } }))} />
                  <NumberField label='Y' value={element.box.y} min={0} max={1080} step={1} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, box: { ...current.box, y: value } }))} />
                  <NumberField label='Width' value={element.box.width} min={0} max={1920} step={1} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, box: { ...current.box, width: value } }))} />
                  <NumberField label='Height' value={element.box.height} min={0} max={1080} step={1} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, box: { ...current.box, height: value } }))} />
                  <NumberField label='Border radius' value={element.borderRadius ?? 0} min={0} max={200} step={1} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, borderRadius: value }))} />
                  <label className='space-y-2'>
                    <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Transform origin</span>
                    <select
                      value={element.transformOrigin ?? 'top-left'}
                      onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, transformOrigin: event.target.value as TransformOrigin }))}
                      className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
                    >
                      {transformOrigins.map((origin) => (
                        <option key={origin} value={origin}>
                          {origin}
                        </option>
                      ))}
                    </select>
                  </label>
                  <ColorField
                    label='Text color'
                    value={element.textColor}
                    onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, textColor: value }))}
                  />
                  <ColorField
                    label='Background color'
                    value={element.backgroundColor}
                    onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, backgroundColor: value }))}
                  />
                  <ColorField
                    label='Border color'
                    value={element.borderColor}
                    onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, borderColor: value }))}
                  />
                </div>

                {element.kind === 'text' ? (
                  <div className='grid gap-3 rounded-2xl border border-border bg-surface/40 p-4 md:grid-cols-3'>
                    <label className='flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'>
                      <input
                        type='checkbox'
                        checked={textBehavior?.allCaps ?? false}
                        onChange={(event) => updatePreviewElement(elementIndex, (current) =>
                          updateElementBehavior(current, (behavior) => ({ ...behavior, allCaps: event.target.checked })))}
                        className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
                      />
                      ALL CAPS
                    </label>
                    <label className='flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'>
                      <input
                        type='checkbox'
                        checked={textBehavior?.fitInBox ?? false}
                        onChange={(event) => updatePreviewElement(elementIndex, (current) =>
                          updateElementBehavior(current, (behavior) => ({ ...behavior, fitInBox: event.target.checked })))}
                        className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
                      />
                      Fit in box
                    </label>
                    <NumberField label='Min scaleX' value={textBehavior?.minScaleX ?? 0} min={0} max={1} step={0.01} onChange={(value) => updatePreviewElement(elementIndex, (current) =>
                      updateElementBehavior(current, (behavior) => ({ ...behavior, minScaleX: value })))} />
                    <NumberField label='Font size' value={textBehavior?.fontSize ?? 64} min={0} max={300} step={1} onChange={(value) => updatePreviewElement(elementIndex, (current) =>
                      updateElementBehavior(current, (behavior) => ({ ...behavior, fontSize: value })))} />
                    <label className='space-y-2 md:col-span-2'>
                      <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Font family</span>
                      <input
                        value={textBehavior?.fontFamily ?? 'Arial'}
                        onChange={(event) => updatePreviewElement(elementIndex, (current) =>
                          updateElementBehavior(current, (behavior) => ({ ...behavior, fontFamily: normalizeOptionalInput(event.target.value) })))}
                        placeholder='Arial, Helvetica, "My Local Font"'
                        className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
                      />
                    </label>
                    <label className='space-y-2'>
                      <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Text align</span>
                      <select
                        value={textBehavior?.textAlign ?? 'left'}
                        onChange={(event) => updatePreviewElement(elementIndex, (current) =>
                          updateElementBehavior(current, (behavior) => ({ ...behavior, textAlign: event.target.value as 'left' | 'center' })))}
                        className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
                      >
                        <option value='left'>Left</option>
                        <option value='center'>Center</option>
                      </select>
                    </label>
                  </div>
                ) : null}
                </div>
              )
            })}
          </div>
        </div>

        <aside className='space-y-4 self-start rounded-3xl border border-border bg-slate-950 p-5 text-white shadow-panel 2xl:sticky 2xl:top-6'>
          <div className='flex items-center justify-between gap-3'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300'>Preview</p>
              <h4 className='mt-1 text-lg font-semibold'>Preview16x9</h4>
            </div>
            <span className='rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300'>
              {activeGraphic?.id ?? graphic.id}
            </span>
          </div>
          <div className='rounded-3xl border border-white/10 bg-white/5 p-4'>
            <PreviewCanvas
              template={graphic.preview}
              content={previewContent}
              backgroundImagePath={previewBackground.resolvedFilePath}
            />
          </div>
          <p className='text-sm text-slate-300'>
            Preview-ul se actualizează live pe baza configurării curente și a conținutului entității selectate.
          </p>
        </aside>
      </div>
    </FormSection>
  )
}
