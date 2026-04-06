import type {
  ContentSourceAdapter,
  ContentSourceInput,
  ContentSourceLoadResult,
} from './contracts'
import { editorialDocumentSchema } from '@/core/schemas/editorialSchemas'

export function parseJsonEditorialDocument(
  content: string,
): Omit<ContentSourceLoadResult, 'source'> {
  const parsedContent = content.trim().length === 0 ? { blocks: [] } : JSON.parse(content) as unknown

  return {
    document: editorialDocumentSchema.parse(parsedContent),
    diagnostics: [],
  }
}

export function createJsonEditorialSourceAdapter(): ContentSourceAdapter {
  return {
    id: 'json-editorial',
    format: 'json',
    load(source: ContentSourceInput): ContentSourceLoadResult {
      const parsed = parseJsonEditorialDocument(source.content)

      return {
        ...parsed,
        source,
      }
    },
  }
}
