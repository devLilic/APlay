export const aplayColors = {
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
} as const

export const aplayStateColors = {
  selected: aplayColors.action.selected,
  multiSelected: aplayColors.accent.cyan,
  active: aplayColors.action.success,
  warning: aplayColors.action.warning,
  invalid: aplayColors.action.danger,
  disabled: aplayColors.text.disabled,
} as const

// When an item could match multiple statuses, the stronger operational state
// owns the card treatment and the remaining states should be shown as badges.
export const aplayStatePriority = [
  'active',
  'invalid',
  'warning',
  'multiSelected',
  'selected',
  'disabled',
] as const

export type APlayStateName = keyof typeof aplayStateColors

export const controlClassNames = {
  focusRing: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-app',
  panel: 'rounded-xl border border-border bg-panel shadow-panel',
  card: 'rounded-lg border border-border bg-card',
  mutedCard: 'rounded-lg border border-border-muted bg-surface-muted',
  pageTitle: 'text-2xl font-semibold tracking-tight text-text-primary',
  panelTitle: 'text-lg font-semibold tracking-tight text-text-primary',
  sectionTitle: 'text-sm font-semibold text-text-primary',
  itemLabel: 'text-sm font-medium leading-5 text-text-primary',
  helperText: 'text-sm leading-6 text-text-secondary',
  textTitle: 'text-lg font-semibold tracking-tight text-text-primary',
  textBody: 'text-sm text-text-secondary',
  textMeta: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary',
  emptyState: 'rounded-xl border border-dashed border-border bg-surface-muted px-4 py-4 text-sm text-text-secondary',
  itemRow: 'rounded-xl border border-border bg-card',
} as const

export type ControlButtonTone = 'neutral' | 'accent' | 'selected' | 'success' | 'warning' | 'danger'
export type ControlButtonVariant = 'solid' | 'outline' | 'ghost'

const buttonToneClassNames: Record<ControlButtonTone, Record<ControlButtonVariant, string>> = {
  neutral: {
    solid: 'border-border-strong bg-card text-text-primary hover:border-border-focus hover:bg-surface-raised',
    outline: 'border-border bg-transparent text-text-primary hover:border-border-focus hover:bg-white/5',
    ghost: 'border-transparent bg-transparent text-text-secondary hover:text-text-primary hover:bg-white/5',
  },
  accent: {
    solid: 'border-accent bg-accent text-slate-950 hover:bg-cyan-300',
    outline: 'border-accent/70 bg-accent/10 text-accent hover:border-accent hover:bg-accent/15',
    ghost: 'border-transparent bg-transparent text-accent hover:bg-accent/10',
  },
  selected: {
    solid: 'border-state-selected bg-state-selected text-white hover:bg-blue-500',
    outline: 'border-state-selected/70 bg-state-selected/10 text-blue-300 hover:border-state-selected hover:bg-state-selected/15',
    ghost: 'border-transparent bg-transparent text-blue-300 hover:bg-state-selected/10',
  },
  success: {
    solid: 'border-state-active bg-state-active text-slate-950 hover:bg-emerald-400',
    outline: 'border-state-active/70 bg-state-active/10 text-emerald-300 hover:border-state-active hover:bg-state-active/15',
    ghost: 'border-transparent bg-transparent text-emerald-300 hover:bg-state-active/10',
  },
  warning: {
    solid: 'border-state-warning bg-state-warning text-slate-950 hover:bg-amber-400',
    outline: 'border-state-warning/70 bg-state-warning/10 text-amber-300 hover:border-state-warning hover:bg-state-warning/15',
    ghost: 'border-transparent bg-transparent text-amber-300 hover:bg-state-warning/10',
  },
  danger: {
    solid: 'border-state-danger bg-state-danger text-white hover:bg-red-500',
    outline: 'border-state-danger/70 bg-state-danger/10 text-red-300 hover:border-state-danger hover:bg-state-danger/15',
    ghost: 'border-transparent bg-transparent text-red-300 hover:bg-state-danger/10',
  },
}

export function getControlButtonClassName(options?: {
  tone?: ControlButtonTone
  variant?: ControlButtonVariant
  fullWidth?: boolean
}): string {
  const tone = options?.tone ?? 'neutral'
  const variant = options?.variant ?? 'outline'
  const width = options?.fullWidth ? 'w-full justify-center' : ''

  return [
    'ap-control-button inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:border-border-muted disabled:bg-transparent disabled:text-text-disabled disabled:hover:bg-transparent',
    controlClassNames.focusRing,
    width,
    buttonToneClassNames[tone][variant],
  ].filter(Boolean).join(' ')
}

export function getStateBadgeClassName(
  state: APlayStateName,
): string {
  const stateClassNames: Record<APlayStateName, string> = {
    selected: 'border-state-selected/40 bg-state-selected/10 text-blue-300',
    multiSelected: 'border-state-multi/40 bg-state-multi/10 text-cyan-300',
    active: 'border-state-active/40 bg-state-active/10 text-emerald-300',
    warning: 'border-state-warning/40 bg-state-warning/10 text-amber-300',
    invalid: 'border-state-danger/40 bg-state-danger/10 text-red-300',
    disabled: 'border-border bg-surface-muted text-text-disabled',
  }

  return [
    'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
    stateClassNames[state],
  ].join(' ')
}

export function resolveItemPrimaryState(states: Partial<Record<APlayStateName, boolean>>): APlayStateName | undefined {
  return aplayStatePriority.find((state) => states[state])
}

export function getSelectableItemClassName(options?: {
  selected?: boolean
  multiSelected?: boolean
  active?: boolean
  warning?: boolean
  invalid?: boolean
  disabled?: boolean
  interactive?: boolean
}): string {
  const primaryState = resolveItemPrimaryState({
    active: options?.active,
    invalid: options?.invalid,
    warning: options?.warning,
    multiSelected: options?.multiSelected,
    selected: options?.selected,
    disabled: options?.disabled,
  })

  const stateClassNames: Record<'default' | APlayStateName, string> = {
    default: 'border-border bg-card text-text-secondary',
    selected: 'border-state-selected bg-state-selected/10 text-text-primary',
    multiSelected: 'border-state-multi bg-state-multi/10 text-text-primary',
    active: 'border-state-active bg-state-active/12 text-text-primary',
    warning: 'border-state-warning bg-state-warning/10 text-text-primary',
    invalid: 'border-state-danger bg-state-danger/10 text-text-primary',
    disabled: 'border-border-muted bg-surface-muted text-text-disabled',
  }

  return [
    'rounded-xl border transition-colors',
    options?.interactive === false ? '' : controlClassNames.focusRing,
    options?.interactive === false || options?.disabled
      ? ''
      : 'hover:border-border-focus hover:bg-surface-raised hover:text-text-primary',
    stateClassNames[primaryState ?? 'default'],
  ].filter(Boolean).join(' ')
}
