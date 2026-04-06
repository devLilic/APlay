import { describe, expect, it } from 'vitest'
import { contentSourceAdapterSchema, type ContentSourceInput } from '@/adapters/content-source/contracts'

describe('ContentSourceAdapter contract', () => {
  it('defines a source adapter interface shape that returns a parsed document and diagnostics', () => {
    const adapter = contentSourceAdapterSchema.parse({
      id: 'csv-editorial',
      format: 'csv',
      load(source: ContentSourceInput) {
        return {
          document: {
            blocks: [],
          },
          diagnostics: [],
          source,
        }
      },
    })

    const result = adapter.load({
      fileName: 'rundown.csv',
      content: '',
    })

    expect(adapter.id).toBe('csv-editorial')
    expect(adapter.format).toBe('csv')
    expect(result).toEqual({
      document: {
        blocks: [],
      },
      diagnostics: [],
      source: {
        fileName: 'rundown.csv',
        content: '',
      },
    })
  })

  it('rejects adapters without a load function', () => {
    expect(() =>
      contentSourceAdapterSchema.parse({
        id: 'csv-editorial',
        format: 'csv',
      }),
    ).toThrow('load')
  })
})
