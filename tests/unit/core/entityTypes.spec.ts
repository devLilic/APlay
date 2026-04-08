import { describe, expect, it } from 'vitest'
import { supportedEntityTypes } from '@/core/entities/entityTypes'

describe('supportedEntityTypes', () => {
  it('matches the V1 entity vocabulary', () => {
    expect(supportedEntityTypes).toEqual([
      'title',
      'person',
      'location',
      'phone',
      'staticImage',
    ])
  })

  it('supports the static "staticImage" entity type', () => {
    expect(supportedEntityTypes).toContain('staticImage')
  })
})
