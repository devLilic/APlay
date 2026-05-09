import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function readPreviewCanvasSource() {
  return readFileSync(
    resolve(process.cwd(), 'src/features/preview/components/PreviewCanvas.tsx'),
    'utf8',
  )
}

describe('PreviewCanvas image source resolution', () => {
  it('does not fall back to a raw local filesystem path when image decoding fails', () => {
    const source = readPreviewCanvasSource()

    expect(source).toContain('return await window.settingsApi.readReferenceImage(normalizedSource) ?? undefined')
    expect(source).not.toContain('readReferenceImage?.(normalizedSource) ?? normalizedSource')
  })
})
