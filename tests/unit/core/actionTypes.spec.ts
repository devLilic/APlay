import { describe, expect, it } from 'vitest'
import { actionTypes } from '@/core/actions/actionTypes'

describe('actionTypes', () => {
  it('defines the fixed graphic control actions used by the application', () => {
    expect(Object.values(actionTypes)).toEqual([
      'playGraphic',
      'stopGraphic',
      'resumeGraphic',
    ])
  })
})
