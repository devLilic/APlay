import { describe, expect, it } from 'vitest'
import { graphicConfigManifests, showProfiles } from '@/settings/config-storage/manifests'
import { supportedEntityTypes } from '@/core/entities/entityTypes'

describe('settings config storage scaffolding', () => {
  it('provides a show profile manifest covering the supported entity types', () => {
    expect(showProfiles).toHaveLength(1)
    expect(showProfiles[0]?.supportedEntityTypes).toEqual([...supportedEntityTypes])
  })

  it('provides separate graphic config manifests per supported entity type', () => {
    expect(graphicConfigManifests).toHaveLength(supportedEntityTypes.length)
    expect(graphicConfigManifests.map((manifest) => manifest.entityType)).toEqual([
      ...supportedEntityTypes,
    ])
  })
})
