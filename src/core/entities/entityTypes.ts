export const supportedEntityTypes = [
  'title',
  'person',
  'location',
  'phone',
  'staticImage',
] as const

export type SupportedEntityType = typeof supportedEntityTypes[number]
