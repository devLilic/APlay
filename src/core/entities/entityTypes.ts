export const supportedEntityTypes = [
  'title',
  'supertitle',
  'person',
  'location',
  'breakingNews',
  'waitingTitle',
  'waitingLocation',
  'phone',
  'logo',
  'staticImage',
] as const

export type SupportedEntityType = typeof supportedEntityTypes[number]
