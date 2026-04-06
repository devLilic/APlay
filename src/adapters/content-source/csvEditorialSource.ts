import type {
  ContentSourceAdapter,
  ContentSourceInput,
  ContentSourceLoadResult,
} from './contracts'
import type { CsvParseOptions } from './csv/types'
import { parseCsvEditorialDocument as parseCsvEditorialDocumentContent } from './csv/parseCsvEditorialDocument'

export function parseCsvEditorialDocument(
  content: string,
  options?: CsvParseOptions,
): Omit<ContentSourceLoadResult, 'source'> {
  return parseCsvEditorialDocumentContent(content, options)
}

export function createCsvEditorialSourceAdapter(
  options?: CsvParseOptions,
): ContentSourceAdapter {
  return {
    id: 'csv-editorial',
    format: 'csv',
    load(source: ContentSourceInput): ContentSourceLoadResult {
      const parsed = parseCsvEditorialDocumentContent(source.content, {
        ...options,
        schema: source.schema ?? options?.schema,
      })
      return {
        ...parsed,
        source,
      }
    },
  }
}
