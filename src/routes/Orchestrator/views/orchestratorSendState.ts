import { normalizeCodeForAck } from './orchestratorViewHelpers'

export type OrchestratorSendStatus = 'idle' | 'sending' | 'synced' | 'error'

export interface SendHydraPayload {
  code: string
  hydraPresetName?: string
  hydraPresetId?: number | null
  hydraPresetFolderId?: number | null
  hydraPresetSource?: 'gallery' | 'folder'
}

export interface OrchestratorSendState {
  status: OrchestratorSendStatus
  lastSentCode: string | null
}

export const INITIAL_ORCHESTRATOR_SEND_STATE: OrchestratorSendState = {
  status: 'idle',
  lastSentCode: null,
}

export function startHydraSend (
  _state: OrchestratorSendState,
  payload: SendHydraPayload,
): OrchestratorSendState {
  return {
    status: 'sending',
    lastSentCode: normalizeCodeForAck(payload.code),
  }
}

export function rejectHydraSend (): OrchestratorSendState {
  return {
    status: 'error',
    lastSentCode: null,
  }
}

export function acknowledgeHydraRemote (
  state: OrchestratorSendState,
  remoteCode: string | null | undefined,
): OrchestratorSendState {
  if (state.status !== 'sending') return state
  if (!state.lastSentCode) return state

  const normalizedRemote = normalizeCodeForAck(remoteCode)
  if (!normalizedRemote || normalizedRemote !== state.lastSentCode) return state

  return {
    status: 'synced',
    lastSentCode: null,
  }
}

export function expireHydraSend (state: OrchestratorSendState): OrchestratorSendState {
  if (state.status !== 'sending') return state
  return {
    ...state,
    status: 'error',
  }
}

export function resetSyncedHydraSend (state: OrchestratorSendState): OrchestratorSendState {
  if (state.status !== 'synced') return state
  return INITIAL_ORCHESTRATOR_SEND_STATE
}

export function clearHydraSendAfterEdit (state: OrchestratorSendState): OrchestratorSendState {
  if (state.status !== 'synced' && state.status !== 'error') return state
  return INITIAL_ORCHESTRATOR_SEND_STATE
}
