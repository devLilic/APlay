import type { ActionType } from '@/core/actions/actionTypes'

export interface GraphicOutputAdapterDescriptor {
  id: string
  protocol: 'osc'
  supportedActionTypes: ActionType[]
}
