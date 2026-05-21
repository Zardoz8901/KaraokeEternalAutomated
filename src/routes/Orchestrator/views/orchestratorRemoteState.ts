import {
  getPendingRemote,
  shouldAutoApplyPreset,
} from './orchestratorViewHelpers'

export interface OrchestratorRemoteState {
  localCode: string
  debouncedCode: string
  userHasEdited: boolean
  pendingRemoteCode: string | null
  pendingRemoteCount: number
  prevRemoteCode: string | undefined
  prevPresetIndex: number | undefined
}

export interface PresetIndexRemoteUpdate {
  remotePresetIndex: number | undefined
  remoteHydraCode: string | null | undefined
}

export function syncRemoteBeforeEdit (
  state: OrchestratorRemoteState,
  remoteHydraCode: string | null | undefined,
): OrchestratorRemoteState {
  if (state.userHasEdited) return state
  if (!remoteHydraCode || remoteHydraCode.trim() === '') return state
  if (remoteHydraCode === state.localCode) return state

  return {
    ...state,
    localCode: remoteHydraCode,
    debouncedCode: remoteHydraCode,
  }
}

export function trackPendingRemoteUpdate (
  state: OrchestratorRemoteState,
  remoteHydraCode: string | null | undefined,
): OrchestratorRemoteState {
  if (remoteHydraCode === state.prevRemoteCode) return state

  const nextState = {
    ...state,
    prevRemoteCode: remoteHydraCode,
  }

  if (!state.userHasEdited) return nextState

  const pending = getPendingRemote(remoteHydraCode ?? null, state.localCode, state.userHasEdited)
  if (pending === null) return nextState

  return {
    ...nextState,
    pendingRemoteCode: pending,
    pendingRemoteCount: state.pendingRemoteCount + 1,
  }
}

export function applyPendingRemote (state: OrchestratorRemoteState): OrchestratorRemoteState {
  if (!state.pendingRemoteCode) {
    return {
      ...state,
      pendingRemoteCode: null,
      pendingRemoteCount: 0,
    }
  }

  return {
    ...state,
    localCode: state.pendingRemoteCode,
    debouncedCode: state.pendingRemoteCode,
    pendingRemoteCode: null,
    pendingRemoteCount: 0,
  }
}

export function dismissPendingRemote (state: OrchestratorRemoteState): OrchestratorRemoteState {
  return {
    ...state,
    pendingRemoteCode: null,
    pendingRemoteCount: 0,
  }
}

export function applyPresetIndexRemoteUpdate (
  state: OrchestratorRemoteState,
  update: PresetIndexRemoteUpdate,
): OrchestratorRemoteState {
  const prevPresetIndex = state.prevPresetIndex
  const nextState = {
    ...state,
    prevPresetIndex: update.remotePresetIndex,
  }

  if (!shouldAutoApplyPreset(
    prevPresetIndex,
    update.remotePresetIndex,
    state.userHasEdited,
    update.remoteHydraCode,
  )) {
    return nextState
  }

  return {
    ...nextState,
    localCode: update.remoteHydraCode!,
    userHasEdited: false,
    pendingRemoteCode: null,
    pendingRemoteCount: 0,
  }
}
