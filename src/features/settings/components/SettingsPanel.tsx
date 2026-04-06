import { useEffect, useState, type PropsWithChildren } from 'react'
import { supportedEntityTypes } from '@/core/entities/entityTypes'
import type {
  AppSettings,
  GraphicFieldBinding,
  GraphicInstanceConfig,
  PreviewElementDefinition,
  PreviewElementKind,
  ShowProfileConfig,
  TransformOrigin,
} from '@/settings/models/appConfig'
import { Panel } from '@/shared/ui/panel'

export interface SettingsFeedback {
  kind: 'success' | 'error'
  message: string
}

interface SettingsPanelProps {
  settings: AppSettings
  diagnostics: string[]
  feedback: SettingsFeedback | null
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
  onSettingsChange,
  onSave,
  onReload,
}: SettingsPanelProps) {
  const selectedProfile = settings.profiles.find((profile) => profile.id === settings.selectedProfileId)
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(selectedProfile?.graphicConfigIds[0] ?? null)

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
              onSettingsChange={onSettingsChange}
              onProfileUpdate={updateProfile}
            />

            <GraphicSelectionSection
              settings={settings}
              selectedProfile={selectedProfile}
              selectedGraphicId={selectedGraphicId}
              onSelectedGraphicIdChange={setSelectedGraphicId}
            />
          </div>

          <div className='space-y-4'>
            {selectedGraphic ? (
              <>
                <GraphicBindingSection graphic={selectedGraphic} updateGraphic={updateGraphic} updateBinding={updateBinding} />
                <PreviewTemplateSection
                  graphic={selectedGraphic}
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
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className='space-y-2'>
      <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>{label}</span>
      <input
        type='number'
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
      />
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
  return {
    id: `element-${index}`,
    kind: 'text',
    sourceField: 'text',
    transformOrigin: 'top-left',
    box: { x: 120, y: 120, width: 640, height: 80 },
    textColor: '#ffffff',
    text: { fitInBox: true, minScaleX: 0.7 },
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

function ProfileSection({
  settings,
  selectedProfile,
  onSettingsChange,
  onProfileUpdate,
}: {
  settings: AppSettings
  selectedProfile: ShowProfileConfig | undefined
  onSettingsChange: (settings: AppSettings) => void
  onProfileUpdate: (updater: (profile: ShowProfileConfig) => ShowProfileConfig) => void
}) {
  const addProfile = () => {
    const nextId = createUniqueProfileId(settings)
    const nextProfile: ShowProfileConfig = {
      id: nextId,
      label: `Profile ${settings.profiles.length + 1}`,
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
  graphic,
  updateGraphic,
  updatePreviewElement,
}: {
  graphic: GraphicInstanceConfig
  updateGraphic: (updater: (graphic: GraphicInstanceConfig) => GraphicInstanceConfig) => void
  updatePreviewElement: (
    elementIndex: number,
    updater: (element: PreviewElementDefinition) => PreviewElementDefinition,
  ) => void
}) {
  return (
    <FormSection title='Preview template' description='Edit the APlay-side preview approximation for the selected graphic.'>
      <div className='grid gap-3 md:grid-cols-3'>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Template id</span>
          <input
            value={graphic.preview.id}
            onChange={(event) => updateGraphic((current) => ({ ...current, preview: { ...current.preview, id: event.target.value } }))}
            className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
          />
        </label>
        <NumberField label='Design width' value={graphic.preview.designWidth} onChange={(value) => updateGraphic((current) => ({ ...current, preview: { ...current.preview, designWidth: value } }))} />
        <NumberField label='Design height' value={graphic.preview.designHeight} onChange={(value) => updateGraphic((current) => ({ ...current, preview: { ...current.preview, designHeight: value } }))} />
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

        {graphic.preview.elements.map((element, elementIndex) => (
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
              <NumberField label='X' value={element.box.x} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, box: { ...current.box, x: value } }))} />
              <NumberField label='Y' value={element.box.y} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, box: { ...current.box, y: value } }))} />
              <NumberField label='Width' value={element.box.width} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, box: { ...current.box, width: value } }))} />
              <NumberField label='Height' value={element.box.height} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, box: { ...current.box, height: value } }))} />
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
              <label className='space-y-2'>
                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Text color</span>
                <input
                  value={element.textColor ?? ''}
                  onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, textColor: event.target.value }))}
                  className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
                />
              </label>
              <label className='space-y-2'>
                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Background color</span>
                <input
                  value={element.backgroundColor ?? ''}
                  onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, backgroundColor: event.target.value }))}
                  className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
                />
              </label>
              <label className='space-y-2'>
                <span className='text-xs font-semibold uppercase tracking-[0.18em] text-muted'>Border color</span>
                <input
                  value={element.borderColor ?? ''}
                  onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, borderColor: event.target.value }))}
                  className='w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'
                />
              </label>
            </div>

            {element.kind === 'text' ? (
              <div className='grid gap-3 rounded-2xl border border-border bg-surface/40 p-4 md:grid-cols-3'>
                <label className='flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'>
                  <input
                    type='checkbox'
                    checked={element.text?.allCaps ?? false}
                    onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, text: { ...current.text, allCaps: event.target.checked } }))}
                    className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
                  />
                  ALL CAPS
                </label>
                <label className='flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink'>
                  <input
                    type='checkbox'
                    checked={element.text?.fitInBox ?? false}
                    onChange={(event) => updatePreviewElement(elementIndex, (current) => ({ ...current, text: { ...current.text, fitInBox: event.target.checked } }))}
                    className='h-4 w-4 rounded border-border text-accent focus:ring-accent'
                  />
                  Fit in box
                </label>
                <NumberField label='Min scaleX' value={element.text?.minScaleX ?? 0} onChange={(value) => updatePreviewElement(elementIndex, (current) => ({ ...current, text: { ...current.text, minScaleX: value } }))} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </FormSection>
  )
}
