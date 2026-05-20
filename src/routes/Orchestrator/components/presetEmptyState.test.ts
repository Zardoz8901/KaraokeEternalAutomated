import { describe, expect, it } from 'vitest'
import { getPresetPanelState } from './presetEmptyState'

describe('getPresetPanelState', () => {
  it('returns no state when the current preset list is visible and send policy allows actions', () => {
    expect(getPresetPanelState({
      query: '',
      visibleTreeCount: 1,
      scopedPresetCount: 2,
      isRestrictedToPartyPresetFolder: false,
      partyPresetFolderId: null,
      canSendSavedPresetsByPolicy: true,
    })).toBeNull()
  })

  it('shows policy copy even when browse-only users can see presets', () => {
    const state = getPresetPanelState({
      query: '',
      visibleTreeCount: 1,
      scopedPresetCount: 2,
      isRestrictedToPartyPresetFolder: false,
      partyPresetFolderId: null,
      canSendSavedPresetsByPolicy: false,
    })

    expect(state?.kind).toBe('policy-blocked')
    expect(state?.message).toBe('Room policy blocks collaborator visual sends.')
  })

  it('distinguishes search misses from empty rooms', () => {
    const state = getPresetPanelState({
      query: 'laser',
      visibleTreeCount: 0,
      scopedPresetCount: 2,
      isRestrictedToPartyPresetFolder: false,
      partyPresetFolderId: null,
      canSendSavedPresetsByPolicy: true,
    })

    expect(state?.kind).toBe('search-empty')
    expect(state?.message).toBe('No visuals match your search.')
  })

  it('distinguishes an empty party preset folder from a fully empty room', () => {
    const state = getPresetPanelState({
      query: '',
      visibleTreeCount: 0,
      scopedPresetCount: 0,
      isRestrictedToPartyPresetFolder: true,
      partyPresetFolderId: 7,
      canSendSavedPresetsByPolicy: true,
    })

    expect(state?.kind).toBe('restricted-folder-empty')
    expect(state?.message).toBe('Party preset folder has no saved visuals.')
  })

  it('labels rooms with no saved visuals', () => {
    const state = getPresetPanelState({
      query: '',
      visibleTreeCount: 0,
      scopedPresetCount: 0,
      isRestrictedToPartyPresetFolder: false,
      partyPresetFolderId: null,
      canSendSavedPresetsByPolicy: true,
    })

    expect(state?.kind).toBe('room-empty')
    expect(state?.message).toBe('No saved visuals available for this room.')
  })
})
