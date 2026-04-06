import { describe, expect, it } from 'vitest'
import { sampleGraphicFiles, sampleSettings } from '@/features/workspace/data/sampleWorkspaceConfig'
import {
  createMemoryKeyValueStorage,
  createWorkspaceConfigRepository,
} from '@/settings/storage/workspaceConfigRepository'

describe('workspaceConfigRepository', () => {
  it('loads default settings and separate graphic files when storage is empty', () => {
    const repository = createWorkspaceConfigRepository(createMemoryKeyValueStorage(), {
      settings: sampleSettings,
      graphicFiles: sampleGraphicFiles,
    })

    const snapshot = repository.load()

    expect(snapshot.settings.selectedProfileId).toBe('default-news')
    expect(Object.keys(snapshot.graphicFiles)).toContain('title-main.json')
    expect(snapshot.settings.graphics).toHaveLength(sampleSettings.graphics.length)
  })

  it('persists updated graphics back into the separate graphic file map', () => {
    const storage = createMemoryKeyValueStorage()
    const repository = createWorkspaceConfigRepository(storage, {
      settings: sampleSettings,
      graphicFiles: sampleGraphicFiles,
    })

    const updatedSettings = {
      ...sampleSettings,
      graphics: sampleSettings.graphics.map((graphic) =>
        graphic.id === 'title-main'
          ? { ...graphic, datasourcePath: 'datasources/custom-title.json' }
          : graphic),
    }

    repository.save(updatedSettings)
    const reloaded = repository.load()

    expect(reloaded.settings.graphics.find((graphic) => graphic.id === 'title-main')?.datasourcePath)
      .toBe('datasources/custom-title.json')
    expect(reloaded.graphicFiles['title-main.json']).toContain('datasources/custom-title.json')
  })

  it('fails clearly when the persisted settings root file is invalid', () => {
    const storage = createMemoryKeyValueStorage({
      'aplay.settings.v1': '{invalid-json',
    })
    const repository = createWorkspaceConfigRepository(storage, {
      settings: sampleSettings,
      graphicFiles: sampleGraphicFiles,
    })

    expect(() => repository.load()).toThrow()
  })

  it('falls back to root settings when a separate graphic config file is invalid', () => {
    const storage = createMemoryKeyValueStorage({
      'aplay.graphic-config-files.v1': JSON.stringify({
        'title-main.json': '{invalid-json',
      }),
    })
    const repository = createWorkspaceConfigRepository(storage, {
      settings: sampleSettings,
      graphicFiles: sampleGraphicFiles,
    })

    const snapshot = repository.load()

    expect(snapshot.settings.graphics.find((graphic) => graphic.id === 'title-main')?.datasourcePath)
      .toBe('datasources/title-main.json')
  })
})
