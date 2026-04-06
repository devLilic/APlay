export const actionTypes = {
  playGraphic: 'playGraphic',
  stopGraphic: 'stopGraphic',
  resumeGraphic: 'resumeGraphic',
} as const

export type ActionType = typeof actionTypes[keyof typeof actionTypes]
