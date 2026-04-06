export const supportedEntityTypes = [
  'title',
  'supertitle',
  'person',
  'location',
  'breakingNews',
  'waitingTitle',
  'waitingLocation',
  'phone',
] as const

export type SupportedEntityType = typeof supportedEntityTypes[number]
