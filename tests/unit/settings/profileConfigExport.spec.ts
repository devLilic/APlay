import { describe, expect, it } from 'vitest'
import type {
  AppSettings,
  CsvSourceSchemaConfig,
  GraphicInstanceConfig,
  ReferenceImageAsset,
  ShowProfileConfig,
} from '@/settings/models/appConfig'
import {
  createProfileConfigExportEnvelope,
  createProfileConfigFileSaveService,
  parseProfileConfigImport,
  profileConfigExportType,
  profileConfigExportVersion,
  serializeProfileConfigExport,
} from '@/settings/storage/profileConfigExport'
import {
  csvSourceSchemaConfigSchema,
  graphicInstanceConfigSchema,
  referenceImageAssetSchema,
  showProfileConfigSchema,
} from '@/settings/schemas/appConfigSchemas'

const referenceImages: ReferenceImageAsset[] = [
  {
    id: 'ref-title',
    name: 'Title Reference',
    filePath: 'C:\\APlay\\references\\title.png',
  },
  {
    id: 'ref-person',
    name: 'Person Reference',
    filePath: 'C:\\APlay\\references\\person.png',
  },
]

const sourceSchema: CsvSourceSchemaConfig = {
  id: 'csv-news-default',
  name: 'News rundown CSV',
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
      enabled: false,
    },
    breakingNews: {
      enabled: false,
    },
    waitingTitle: {
      enabled: false,
    },
    waitingLocation: {
      enabled: false,
    },
    phone: {
      enabled: false,
    },
  },
}

const titleGraphic: GraphicInstanceConfig = {
  id: 'title-main',
  entityType: 'title',
  dataFileName: 'title-main.json',
  datasourcePath: 'datasources/title-main.json',
  control: {
    play: '/graphics/title/play',
    stop: '/graphics/title/stop',
    resume: '/graphics/title/resume',
  },
  bindings: [{ sourceField: 'text', targetField: 'headline', required: true }],
  preview: {
    id: 'title-preview',
    designWidth: 1920,
    designHeight: 1080,
    background: {
      referenceImageId: 'ref-title',
      opacity: 0.45,
      fitMode: 'cover',
      position: 'center',
    },
    elements: [
      {
        id: 'headline',
        kind: 'text',
        sourceField: 'text',
        previewText: 'Sample title',
        box: {
          x: 100,
          y: 150,
          width: 900,
          height: 180,
        },
      },
    ],
  },
  actions: [{ actionType: 'playGraphic', label: 'Play' }],
}

const personGraphic: GraphicInstanceConfig = {
  id: 'person-main',
  entityType: 'person',
  dataFileName: 'person-main.json',
  datasourcePath: 'datasources/person-main.json',
  control: {
    play: '/graphics/person/play',
    stop: '/graphics/person/stop',
    resume: '/graphics/person/resume',
  },
  bindings: [
    { sourceField: 'name', targetField: 'name', required: true },
    { sourceField: 'role', targetField: 'role' },
  ],
  preview: {
    id: 'person-preview',
    designWidth: 1920,
    designHeight: 1080,
    background: {
      referenceImageId: 'ref-person',
      opacity: 0.35,
      fitMode: 'contain',
      position: 'center',
    },
    elements: [
      {
        id: 'person-name',
        kind: 'text',
        sourceField: 'name',
        box: {
          x: 100,
          y: 760,
          width: 700,
          height: 120,
        },
      },
    ],
  },
  actions: [{ actionType: 'playGraphic', label: 'Play' }],
}

const profileConfig: ShowProfileConfig = {
  id: 'news-am',
  label: 'Morning News',
  source: {
    type: 'csv',
    filePath: 'C:\\APlay\\sources\\morning.csv',
    schemaId: 'csv-news-default',
  },
  graphicConfigIds: ['title-main', 'person-main'],
}

function createSettingsFixture(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    selectedProfileId: 'news-am',
    referenceImages,
    sourceSchemas: [sourceSchema],
    profiles: [profileConfig],
    graphics: [titleGraphic, personGraphic],
    ...overrides,
  }
}

const normalizedProfileConfig = showProfileConfigSchema.parse(profileConfig)
const normalizedSourceSchema = csvSourceSchemaConfigSchema.parse(sourceSchema)
const normalizedGraphics = [graphicInstanceConfigSchema.parse(titleGraphic), graphicInstanceConfigSchema.parse(personGraphic)]
const normalizedReferenceImages = referenceImages.map((referenceImage) => referenceImageAssetSchema.parse(referenceImage))

describe('profileConfigExport', () => {
  it('profile export contains profile config', () => {
    const exported = createProfileConfigExportEnvelope(createSettingsFixture(), 'news-am')

    expect(exported.payload.profile).toEqual(normalizedProfileConfig)
  })

  it('profile export contains referenced CSV source schema', () => {
    const exported = createProfileConfigExportEnvelope(createSettingsFixture(), 'news-am')

    expect(exported.payload.sourceSchemas).toEqual([normalizedSourceSchema])
  })

  it('profile export contains referenced graphic configs as full embedded objects', () => {
    const exported = createProfileConfigExportEnvelope(createSettingsFixture(), 'news-am')

    expect(exported.payload.graphics).toEqual(normalizedGraphics)
    expect(exported.payload.graphics[0]).not.toHaveProperty('graphicConfigId')
  })

  it('profile export contains reference image metadata/config where applicable', () => {
    const exported = createProfileConfigExportEnvelope(createSettingsFixture(), 'news-am')

    expect(exported.payload.referenceImages).toEqual(normalizedReferenceImages)
  })

  it('profile export includes version metadata', () => {
    const exported = createProfileConfigExportEnvelope(createSettingsFixture(), 'news-am')

    expect(exported.version).toBe(profileConfigExportVersion)
  })

  it('profile export includes export type metadata', () => {
    const exported = createProfileConfigExportEnvelope(createSettingsFixture(), 'news-am')

    expect(exported.exportType).toBe(profileConfigExportType)
  })

  it('profile export is stable and import-ready', () => {
    const settings = createSettingsFixture()
    const first = serializeProfileConfigExport(settings, 'news-am')
    const second = serializeProfileConfigExport(createSettingsFixture(), 'news-am')
    const imported = parseProfileConfigImport(JSON.parse(first) as unknown)

    expect(first).toBe(second)
    expect(imported).toEqual({
      profile: normalizedProfileConfig,
      sourceSchemas: [normalizedSourceSchema],
      graphics: normalizedGraphics,
      referenceImages: normalizedReferenceImages,
    })
  })

  it('invalid or missing referenced config is handled safely', () => {
    expect(() =>
      createProfileConfigExportEnvelope(createSettingsFixture({
        graphics: [titleGraphic],
      }), 'news-am')
    ).toThrow()
  })

  it('export does not include volatile runtime state', () => {
    const exported = createProfileConfigExportEnvelope(createSettingsFixture(), 'news-am')

    expect(exported.payload).not.toHaveProperty('selectedProfileId')
    expect(exported.payload).not.toHaveProperty('diagnostics')
    expect(exported.payload).not.toHaveProperty('activeSourceFilePath')
    expect(exported.payload).not.toHaveProperty('graphicsByEntityType')
  })

  it('export preserves profile-level source file configuration', () => {
    const exported = createProfileConfigExportEnvelope(createSettingsFixture(), 'news-am')

    expect(exported.payload.profile.source).toEqual({
      type: 'csv',
      filePath: 'C:\\APlay\\sources\\morning.csv',
      schemaId: 'csv-news-default',
    })
  })
})

describe('profileConfigFileSaveService', () => {
  it('writes one validated profile export file', async () => {
    const pickFilePath = async () => 'C:\\Exports\\news-am.profile.json'
    let writtenFilePath: string | null = null
    let writtenContent: string | null = null
    const service = createProfileConfigFileSaveService({
      pickFilePath,
      async writeFile(filePath, content) {
        writtenFilePath = filePath
        writtenContent = content
      },
    })

    const result = await service.save(createSettingsFixture(), 'news-am')

    expect(result.status).toBe('saved')
    expect(result.filePath).toBe('C:\\Exports\\news-am.profile.json')
    expect(result.content).toBe(serializeProfileConfigExport(createSettingsFixture(), 'news-am'))
    expect(writtenFilePath).toBe('C:\\Exports\\news-am.profile.json')
    expect(writtenContent).toBe(serializeProfileConfigExport(createSettingsFixture(), 'news-am'))
  })
})
