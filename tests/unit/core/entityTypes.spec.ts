import { describe, expect, it } from 'vitest'
import { supportedEntityTypes } from '@/core/entities/entityTypes'

describe('supportedEntityTypes', () => {
  it('matches the V1 entity vocabulary', () => {
    expect(supportedEntityTypes).toEqual([
      'title',
      'supertitle',
      'person',
      'location',
      'breakingNews',
      'waitingTitle',
      'waitingLocation',
      'phone',
    ])
  })
})
