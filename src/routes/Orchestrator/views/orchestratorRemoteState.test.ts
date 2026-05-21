import { describe, expect, it } from 'vitest'
import { getPresetByIndex } from '../components/hydraPresets'
import {
  applyPendingRemote,
  applyPresetIndexRemoteUpdate,
  dismissPendingRemote,
  syncRemoteBeforeEdit,
  trackPendingRemoteUpdate,
  type OrchestratorRemoteState,
} from './orchestratorRemoteState'

function makeState (overrides: Partial<OrchestratorRemoteState> = {}): OrchestratorRemoteState {
  return {
    localCode: 'local-code',
    debouncedCode: 'local-code',
    userHasEdited: false,
    pendingRemoteCode: null,
    pendingRemoteCount: 0,
    prevRemoteCode: undefined,
    prevPresetIndex: undefined,
    ...overrides,
  }
}

describe('orchestratorRemoteState', () => {
  it('syncs non-empty remote code into local and debounced code before the user edits', () => {
    const state = syncRemoteBeforeEdit(makeState(), 'remote-code')

    expect(state.localCode).toBe('remote-code')
    expect(state.debouncedCode).toBe('remote-code')
    expect(state.userHasEdited).toBe(false)
  })

  it('does not pre-edit sync after the user has local edits', () => {
    const edited = makeState({ userHasEdited: true })

    expect(syncRemoteBeforeEdit(edited, 'remote-code')).toBe(edited)
  })

  it('replaces pending remote code and increments the banner count for each new remote edit', () => {
    const first = trackPendingRemoteUpdate(makeState({ userHasEdited: true }), 'remote-v1')
    const second = trackPendingRemoteUpdate(first, 'remote-v2')

    expect(first.pendingRemoteCode).toBe('remote-v1')
    expect(first.pendingRemoteCount).toBe(1)
    expect(second.pendingRemoteCode).toBe('remote-v2')
    expect(second.pendingRemoteCount).toBe(2)
  })

  it('does not count the same remote code twice', () => {
    const first = trackPendingRemoteUpdate(makeState({ userHasEdited: true }), 'remote-v1')

    expect(trackPendingRemoteUpdate(first, 'remote-v1')).toBe(first)
  })

  it('applies pending remote code and clears the pending banner without discarding edit ownership', () => {
    const state = makeState({
      userHasEdited: true,
      pendingRemoteCode: 'remote-v2',
      pendingRemoteCount: 2,
    })

    expect(applyPendingRemote(state)).toEqual({
      ...state,
      localCode: 'remote-v2',
      debouncedCode: 'remote-v2',
      pendingRemoteCode: null,
      pendingRemoteCount: 0,
    })
  })

  it('dismisses pending remote code without changing local code', () => {
    const state = makeState({
      localCode: 'edited-local',
      debouncedCode: 'edited-local',
      userHasEdited: true,
      pendingRemoteCode: 'remote-v2',
      pendingRemoteCount: 2,
    })

    expect(dismissPendingRemote(state)).toEqual({
      ...state,
      pendingRemoteCode: null,
      pendingRemoteCount: 0,
    })
  })

  it('auto-applies a genuine gallery preset index change after local edits', () => {
    const code = getPresetByIndex(3)
    const state = makeState({
      localCode: 'edited-local',
      debouncedCode: 'edited-local',
      userHasEdited: true,
      pendingRemoteCode: 'remote-v2',
      pendingRemoteCount: 2,
      prevPresetIndex: 1,
    })

    expect(applyPresetIndexRemoteUpdate(state, {
      remotePresetIndex: 3,
      remoteHydraCode: code,
    })).toEqual({
      ...state,
      localCode: code,
      userHasEdited: false,
      pendingRemoteCode: null,
      pendingRemoteCount: 0,
      prevPresetIndex: 3,
    })
  })

  it('records preset index movement without applying spoofed or out-of-range remote code', () => {
    const state = makeState({
      localCode: 'edited-local',
      debouncedCode: 'edited-local',
      userHasEdited: true,
      prevPresetIndex: 1,
    })

    expect(applyPresetIndexRemoteUpdate(state, {
      remotePresetIndex: 9999,
      remoteHydraCode: 'spoofed-code',
    })).toEqual({
      ...state,
      prevPresetIndex: 9999,
    })
  })

  it('does not auto-apply the initial preset index observation', () => {
    const code = getPresetByIndex(3)
    const state = makeState({ userHasEdited: true })

    expect(applyPresetIndexRemoteUpdate(state, {
      remotePresetIndex: 3,
      remoteHydraCode: code,
    })).toEqual({
      ...state,
      prevPresetIndex: 3,
    })
  })
})
