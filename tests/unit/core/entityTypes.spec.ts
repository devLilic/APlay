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
      'logo',
      'staticImage',
    ])
  })

  it('supports the static "logo" entity type', () => {
    expect(supportedEntityTypes).toContain('logo')
  })

  it('supports the static "staticImage" entity type', () => {
    expect(supportedEntityTypes).toContain('staticImage')
  })
})
