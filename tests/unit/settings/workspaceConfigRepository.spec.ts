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
})
