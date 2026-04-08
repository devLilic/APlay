import type { AppSettings } from '@/settings/models/appConfig'
import type { FieldBinding } from '@/adapters/publish-target/jsonDatasourcePublishTarget'
import { sampleEditorialCsv } from '@/features/workspace/data/sampleEditorialCsv'
import { serializeGraphicConfigExport } from '@/settings/storage/graphicConfigExport'

const defaultGraphicBindingsByEntityType: Record<string, FieldBinding[]> = {
  title: [{ sourceField: 'text', targetField: 'text', required: true }],
  person: [{ sourceField: 'name', targetField: 'name', required: true }, { sourceField: 'role', targetField: 'role' }],
  location: [{ sourceField: 'value', targetField: 'value', required: true }],
  phone: [{ sourceField: 'label', targetField: 'label', required: true }, { sourceField: 'number', targetField: 'number', required: true }],
  staticImage: [],
}

export const sampleSettings: AppSettings = {
  selectedProfileId: 'default-news',
  osc: {
    target: {
      host: '127.0.0.1',
      port: 53000,
    },
    commands: {
      play: {
        address: '/liveboard/play',
        args: [{ type: 's', value: '{{templateName}}' }],
      },
      stop: {
        address: '/liveboard/stop',
        args: [{ type: 's', value: '{{templateName}}' }],
      },
      resume: {
        address: '/liveboard/resume',
        args: [{ type: 's', value: '{{templateName}}' }],
      },
    },
  },
  referenceImages: [],
  sourceSchemas: [
    {
      id: 'csv-default-news',
      name: 'Default news CSV',
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
    },
  ],
  profiles: [
    {
      id: 'default-news',
      label: 'Default News',
      source: {
        type: 'csv',
        filePath: 'C:\\APlay\\sources\\default-news.csv',
        schemaId: 'csv-default-news',
      },
      graphicConfigIds: [
        'title-main',
        'person-main',
        'location-main',
        'phone-main',
        'static-image-main',
      ],
    },
  ],
  graphics: [
    {
      id: 'title-main',
      name: 'Main title',
      entityType: 'title',
      dataFileName: 'title-main.json',
      datasourcePath: 'datasources/title-main.json',
      control: { templateName: 'TITLE_MAIN', play: '/aplay/title/play', stop: '/aplay/title/stop', resume: '/aplay/title/resume' },
      bindings: defaultGraphicBindingsByEntityType.title,
      preview: {
        id: 'title-preview',
        designWidth: 1920,
        designHeight: 1080,
        elements: [
          { id: 'title-box', kind: 'box', sourceField: 'text', box: { x: 86, y: 708, width: 980, height: 212 }, backgroundColor: '#0f172a', borderColor: '#1e293b' },
          { id: 'title-text', kind: 'text', sourceField: 'text', box: { x: 130, y: 742, width: 900, height: 148 }, textColor: '#ffffff', text: { fitInBox: true, minScaleX: 0.72 } },
        ],
      },
      actions: [{ actionType: 'playGraphic', label: 'Play' }, { actionType: 'stopGraphic', label: 'Stop' }, { actionType: 'resumeGraphic', label: 'Resume' }],
    },
    {
      id: 'person-main',
      name: 'Person main',
      entityType: 'person',
      dataFileName: 'person-main.json',
      datasourcePath: 'datasources/person-main.json',
      control: { templateName: 'PERSON_MAIN', play: '/aplay/person/play', stop: '/aplay/person/stop', resume: '/aplay/person/resume' },
      bindings: defaultGraphicBindingsByEntityType.person,
      preview: {
        id: 'person-preview',
        designWidth: 1920,
        designHeight: 1080,
        elements: [
          { id: 'person-name-box', kind: 'box', sourceField: 'name', box: { x: 86, y: 744, width: 820, height: 142 } },
          { id: 'person-name', kind: 'text', sourceField: 'name', box: { x: 126, y: 768, width: 740, height: 66 }, text: { allCaps: true, fitInBox: true, minScaleX: 0.68 } },
          { id: 'person-role', kind: 'text', sourceField: 'role', box: { x: 126, y: 832, width: 740, height: 40 }, text: { fitInBox: true, minScaleX: 0.75 } },
        ],
      },
      actions: [{ actionType: 'playGraphic', label: 'Play' }, { actionType: 'stopGraphic', label: 'Stop' }, { actionType: 'resumeGraphic', label: 'Resume' }],
    },
    {
      id: 'location-main',
      name: 'Location main',
      entityType: 'location',
      dataFileName: 'location-main.json',
      datasourcePath: 'datasources/location-main.json',
      control: { templateName: 'LOCATION_MAIN', play: '/aplay/location/play', stop: '/aplay/location/stop', resume: '/aplay/location/resume' },
      bindings: defaultGraphicBindingsByEntityType.location,
      preview: {
        id: 'location-preview',
        designWidth: 1920,
        designHeight: 1080,
        elements: [
          { id: 'location-chip', kind: 'box', sourceField: 'value', box: { x: 86, y: 812, width: 460, height: 88 } },
          { id: 'location-text', kind: 'text', sourceField: 'value', box: { x: 126, y: 836, width: 380, height: 36 }, text: { allCaps: true, fitInBox: true, minScaleX: 0.7 } },
        ],
      },
      actions: [{ actionType: 'playGraphic', label: 'Play' }, { actionType: 'stopGraphic', label: 'Stop' }, { actionType: 'resumeGraphic', label: 'Resume' }],
    },
    {
      id: 'phone-main',
      name: 'Phone main',
      entityType: 'phone',
      dataFileName: 'phone-main.json',
      datasourcePath: 'datasources/phone-main.json',
      control: { templateName: 'PHONE_MAIN', play: '/aplay/phone/play', stop: '/aplay/phone/stop', resume: '/aplay/phone/resume' },
      bindings: defaultGraphicBindingsByEntityType.phone,
      preview: {
        id: 'phone-preview',
        designWidth: 1920,
        designHeight: 1080,
        elements: [
          { id: 'phone-box', kind: 'box', sourceField: 'number', box: { x: 1280, y: 760, width: 540, height: 144 } },
          { id: 'phone-label', kind: 'text', sourceField: 'label', box: { x: 1320, y: 784, width: 460, height: 34 }, text: { allCaps: true, fitInBox: true, minScaleX: 0.72 } },
          { id: 'phone-number', kind: 'text', sourceField: 'number', box: { x: 1320, y: 824, width: 460, height: 46 }, text: { fitInBox: true, minScaleX: 0.72 } },
        ],
      },
      actions: [{ actionType: 'playGraphic', label: 'Play' }, { actionType: 'stopGraphic', label: 'Stop' }, { actionType: 'resumeGraphic', label: 'Resume' }],
    },
    {
      id: 'static-image-main',
      name: 'Static image main',
      entityType: 'staticImage',
      kind: 'static',
      dataFileName: 'static-image-main.json',
      staticAsset: {
        assetPath: 'assets/static-image-main.png',
        assetType: 'image',
      },
      control: { templateName: 'STATIC_IMAGE_MAIN', play: '/aplay/static-image/play', stop: '/aplay/static-image/stop', resume: '/aplay/static-image/resume' },
      preview: {
        id: 'static-image-preview',
        designWidth: 1920,
        designHeight: 1080,
        elements: [
          { id: 'static-image', kind: 'image', sourceField: 'staticAsset', previewText: 'assets/static-image-main.png', box: { x: 1360, y: 72, width: 420, height: 236 } },
        ],
      },
      actions: [{ actionType: 'playGraphic', label: 'Play' }, { actionType: 'stopGraphic', label: 'Stop' }, { actionType: 'resumeGraphic', label: 'Resume' }],
    },
  ],
}

export const sampleGraphicFiles = Object.fromEntries(
  sampleSettings.graphics.map((graphic) => [`${graphic.id}.json`, serializeGraphicConfigExport(graphic)]),
)

export const graphicBindingsByEntityType = defaultGraphicBindingsByEntityType

export const sampleSourceFiles: Record<string, string> = {
  'C:\\APlay\\sources\\default-news.csv': sampleEditorialCsv,
}
