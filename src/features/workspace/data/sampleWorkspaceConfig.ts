import type { AppSettings } from '@/settings/models/appConfig'
import type { FieldBinding } from '@/adapters/publish-target/jsonDatasourcePublishTarget'

const defaultGraphicBindingsByEntityType: Record<string, FieldBinding[]> = {
  title: [{ sourceField: 'text', targetField: 'text', required: true }],
  supertitle: [{ sourceField: 'text', targetField: 'text', required: true }],
  person: [{ sourceField: 'name', targetField: 'name', required: true }, { sourceField: 'role', targetField: 'role' }],
  location: [{ sourceField: 'value', targetField: 'value', required: true }],
  breakingNews: [{ sourceField: 'value', targetField: 'value', required: true }],
  waitingTitle: [{ sourceField: 'value', targetField: 'value', required: true }],
  waitingLocation: [{ sourceField: 'value', targetField: 'value', required: true }],
  phone: [{ sourceField: 'label', targetField: 'label', required: true }, { sourceField: 'number', targetField: 'number', required: true }],
}

export const sampleSettings: AppSettings = {
  selectedProfileId: 'default-news',
  referenceImages: [],
  profiles: [
    {
      id: 'default-news',
      label: 'Default News',
      graphicConfigIds: [
        'title-main',
        'supertitle-main',
        'person-main',
        'location-main',
        'breaking-main',
        'waiting-title-main',
        'waiting-location-main',
        'phone-main',
      ],
    },
  ],
  graphics: [
    {
      id: 'title-main',
      entityType: 'title',
      dataFileName: 'title-main.json',
      datasourcePath: 'datasources/title-main.json',
      control: { play: '/aplay/title/play', stop: '/aplay/title/stop', resume: '/aplay/title/resume' },
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
      id: 'supertitle-main',
      entityType: 'supertitle',
      dataFileName: 'supertitle-main.json',
      datasourcePath: 'datasources/supertitle-main.json',
      control: { play: '/aplay/supertitle/play', stop: '/aplay/supertitle/stop', resume: '/aplay/supertitle/resume' },
      bindings: defaultGraphicBindingsByEntityType.supertitle,
      preview: {
        id: 'supertitle-preview',
        designWidth: 1920,
        designHeight: 1080,
        elements: [
          { id: 'supertitle-box', kind: 'box', sourceField: 'text', box: { x: 86, y: 620, width: 420, height: 74 } },
          { id: 'supertitle-text', kind: 'text', sourceField: 'text', box: { x: 118, y: 634, width: 360, height: 44 }, text: { allCaps: true, fitInBox: true, minScaleX: 0.75 } },
        ],
      },
      actions: [{ actionType: 'playGraphic', label: 'Play' }, { actionType: 'stopGraphic', label: 'Stop' }, { actionType: 'resumeGraphic', label: 'Resume' }],
    },
    {
      id: 'person-main',
      entityType: 'person',
      dataFileName: 'person-main.json',
      datasourcePath: 'datasources/person-main.json',
      control: { play: '/aplay/person/play', stop: '/aplay/person/stop', resume: '/aplay/person/resume' },
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
      entityType: 'location',
      dataFileName: 'location-main.json',
      datasourcePath: 'datasources/location-main.json',
      control: { play: '/aplay/location/play', stop: '/aplay/location/stop', resume: '/aplay/location/resume' },
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
      id: 'breaking-main',
      entityType: 'breakingNews',
      dataFileName: 'breaking-main.json',
      datasourcePath: 'datasources/breaking-main.json',
      control: { play: '/aplay/breaking/play', stop: '/aplay/breaking/stop', resume: '/aplay/breaking/resume' },
      bindings: defaultGraphicBindingsByEntityType.breakingNews,
      preview: {
        id: 'breaking-preview',
        designWidth: 1920,
        designHeight: 1080,
        elements: [
          { id: 'breaking-band', kind: 'box', sourceField: 'value', box: { x: 0, y: 936, width: 1920, height: 144 } },
          { id: 'breaking-line', kind: 'text', sourceField: 'value', box: { x: 128, y: 980, width: 1480, height: 54 }, text: { allCaps: true, fitInBox: true, minScaleX: 0.65 } },
        ],
      },
      actions: [{ actionType: 'playGraphic', label: 'Play' }, { actionType: 'stopGraphic', label: 'Stop' }, { actionType: 'resumeGraphic', label: 'Resume' }],
    },
    {
      id: 'waiting-title-main',
      entityType: 'waitingTitle',
      dataFileName: 'waiting-title-main.json',
      datasourcePath: 'datasources/waiting-title-main.json',
      control: { play: '/aplay/waiting-title/play', stop: '/aplay/waiting-title/stop', resume: '/aplay/waiting-title/resume' },
      bindings: defaultGraphicBindingsByEntityType.waitingTitle,
      preview: {
        id: 'waiting-title-preview',
        designWidth: 1920,
        designHeight: 1080,
        elements: [
          { id: 'waiting-title-box', kind: 'box', sourceField: 'value', box: { x: 86, y: 740, width: 980, height: 180 } },
          { id: 'waiting-title-text', kind: 'text', sourceField: 'value', box: { x: 126, y: 788, width: 900, height: 72 }, text: { fitInBox: true, minScaleX: 0.68 } },
        ],
      },
      actions: [{ actionType: 'playGraphic', label: 'Play' }, { actionType: 'stopGraphic', label: 'Stop' }, { actionType: 'resumeGraphic', label: 'Resume' }],
    },
    {
      id: 'waiting-location-main',
      entityType: 'waitingLocation',
      dataFileName: 'waiting-location-main.json',
      datasourcePath: 'datasources/waiting-location-main.json',
      control: { play: '/aplay/waiting-location/play', stop: '/aplay/waiting-location/stop', resume: '/aplay/waiting-location/resume' },
      bindings: defaultGraphicBindingsByEntityType.waitingLocation,
      preview: {
        id: 'waiting-location-preview',
        designWidth: 1920,
        designHeight: 1080,
        elements: [
          { id: 'waiting-location-box', kind: 'box', sourceField: 'value', box: { x: 86, y: 812, width: 460, height: 88 } },
          { id: 'waiting-location-text', kind: 'text', sourceField: 'value', box: { x: 126, y: 836, width: 380, height: 36 }, text: { allCaps: true, fitInBox: true, minScaleX: 0.7 } },
        ],
      },
      actions: [{ actionType: 'playGraphic', label: 'Play' }, { actionType: 'stopGraphic', label: 'Stop' }, { actionType: 'resumeGraphic', label: 'Resume' }],
    },
    {
      id: 'phone-main',
      entityType: 'phone',
      dataFileName: 'phone-main.json',
      datasourcePath: 'datasources/phone-main.json',
      control: { play: '/aplay/phone/play', stop: '/aplay/phone/stop', resume: '/aplay/phone/resume' },
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
  ],
}

export const sampleGraphicFiles = Object.fromEntries(
  sampleSettings.graphics.map((graphic) => [`${graphic.id}.json`, JSON.stringify(graphic)]),
)

export const graphicBindingsByEntityType = defaultGraphicBindingsByEntityType
