import { describe, expect, it } from 'vitest'
import { supportedEntityTypes } from '@/core/entities/entityTypes'

describe('supportedEntityTypes', () => {
  it('matches the V1 entity vocabulary', () => {
    expect(supportedEntityTypes).toEqual([
      'title',
      'person',
      'location',
      'phone',
      'image',
    ])
  })

  it('supports the static "image" entity type', () => {
    expect(supportedEntityTypes).toContain('image')
  })
})
