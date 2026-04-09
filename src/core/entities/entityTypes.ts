export const supportedEntityTypes = [
  'title',
  'person',
  'location',
  'phone',
  'image',
] as const

export type SupportedEntityType = typeof supportedEntityTypes[number]
