export const contentSourceFormats = ['csv', 'json'] as const

export type ContentSourceFormat = typeof contentSourceFormats[number]

export interface ContentSourceAdapterDescriptor {
  id: string
  format: ContentSourceFormat
  description: string
}
