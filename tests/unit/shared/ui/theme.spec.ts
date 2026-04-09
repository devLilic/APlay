import { describe, expect, it } from 'vitest'
import {
  aplayColors,
  aplayStateColors,
  aplayStatePriority,
  controlClassNames,
  getControlButtonClassName,
  getSelectableItemClassName,
  getStateBadgeClassName,
  resolveItemPrimaryState,
} from '@/shared/ui/theme'

describe('ui theme foundation', () => {
  it('exposes the official APlay palette tokens', () => {
    expect(aplayColors).toEqual({
      surface: {
        app: '#0B0F14',
        panel: '#111827',
        card: '#1F2937',
      },
      text: {
        primary: '#F9FAFB',
        secondary: '#9CA3AF',
        disabled: '#4B5563',
      },
      accent: {
        cyan: '#22D3EE',
      },
      action: {
        selected: '#3B82F6',
        success: '#22C55E',
        danger: '#EF4444',
        warning: '#F59E0B',
      },
    })

    expect(aplayStateColors).toEqual({
      selected: '#3B82F6',
      multiSelected: '#22D3EE',
      active: '#22C55E',
      warning: '#F59E0B',
      invalid: '#EF4444',
      disabled: '#4B5563',
    })
  })

  it('builds accessible button class sets for operator controls', () => {
    expect(getControlButtonClassName({ tone: 'selected', variant: 'solid', fullWidth: true })).toContain('min-h-11')
    expect(getControlButtonClassName({ tone: 'selected', variant: 'solid', fullWidth: true })).toContain('bg-state-selected')
    expect(getControlButtonClassName({ tone: 'selected', variant: 'solid', fullWidth: true })).toContain('w-full')
    expect(getControlButtonClassName({ tone: 'selected', variant: 'solid', fullWidth: true })).toContain('focus-visible:ring-accent')
  })

  it('maps state badges to the broadcast status colors', () => {
    expect(getStateBadgeClassName('multiSelected')).toContain('bg-state-multi/10')
    expect(getStateBadgeClassName('active')).toContain('text-emerald-300')
    expect(getStateBadgeClassName('invalid')).toContain('border-state-danger/40')
  })

  it('defines state priority so stronger statuses win the shared card treatment', () => {
    expect(aplayStatePriority).toEqual([
      'active',
      'invalid',
      'warning',
      'multiSelected',
      'selected',
      'disabled',
    ])

    expect(resolveItemPrimaryState({ selected: true, multiSelected: true })).toBe('multiSelected')
    expect(resolveItemPrimaryState({ active: true, selected: true, multiSelected: true })).toBe('active')
    expect(resolveItemPrimaryState({ invalid: true, selected: true })).toBe('invalid')
  })

  it('builds reusable selectable item classes for dark operator surfaces', () => {
    expect(getSelectableItemClassName({ selected: true })).toContain('border-state-selected')
    expect(getSelectableItemClassName({ multiSelected: true, selected: true })).toContain('border-state-multi')
    expect(getSelectableItemClassName({ invalid: true, interactive: true })).toContain('bg-state-danger/10')
    expect(getSelectableItemClassName({ disabled: true })).toContain('text-text-disabled')
    expect(getSelectableItemClassName({ selected: true })).toContain('focus-visible:ring-accent')
  })

  it('defines reusable typography and layout pattern tokens', () => {
    expect(controlClassNames.pageTitle).toContain('text-2xl')
    expect(controlClassNames.panelTitle).toContain('text-lg')
    expect(controlClassNames.sectionTitle).toContain('text-sm')
    expect(controlClassNames.helperText).toContain('text-text-secondary')
    expect(controlClassNames.emptyState).toContain('border-dashed')
    expect(controlClassNames.itemRow).toContain('bg-card')
  })
})
