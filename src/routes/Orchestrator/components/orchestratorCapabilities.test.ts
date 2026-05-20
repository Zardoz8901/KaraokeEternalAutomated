import { describe, expect, it } from 'vitest'
import { canSendHydraInput, getOrchestratorCapabilities } from './orchestratorCapabilities'
import type { PresetLeaf } from './presetTree'

const owner = {
  userId: 1,
  roomId: 10,
  ownRoomId: 10,
  isAdmin: false,
  isGuest: false,
}

const collaborator = {
  userId: 2,
  roomId: 10,
  ownRoomId: 20,
  isAdmin: false,
  isGuest: false,
}

const savedPreset: PresetLeaf = {
  id: 'preset:5',
  presetId: 5,
  folderId: 7,
  name: 'saved',
  code: 'osc(10).out()',
  isGallery: false,
  usesCamera: false,
}

const galleryPreset: PresetLeaf = {
  id: 'gallery:demo',
  name: 'demo',
  code: 'osc(10).out()',
  isGallery: true,
  usesCamera: false,
}

describe('orchestratorCapabilities', () => {
  it('allows room owners to live-code and send gallery presets', () => {
    const capabilities = getOrchestratorCapabilities(owner, null)

    expect(capabilities.canUseOrchestrator).toBe(true)
    expect(capabilities.canLiveCode).toBe(true)
    expect(capabilities.canSendGalleryPreset).toBe(true)
    expect(capabilities.canManageRoomVisualPolicy).toBe(true)
    expect(capabilities.canSendPreset(galleryPreset)).toBe(true)
    expect(canSendHydraInput('osc(10).out()', capabilities)).toBe(true)
  })

  it('lets collaborators send saved DB presets only when both room policies allow it', () => {
    const allowed = getOrchestratorCapabilities(collaborator, {
      allowGuestOrchestrator: true,
      allowRoomCollaboratorsToSendVisualizer: true,
    })
    const blockedByOrchestrator = getOrchestratorCapabilities(collaborator, {
      allowGuestOrchestrator: false,
      allowRoomCollaboratorsToSendVisualizer: true,
    })
    const blockedBySendPolicy = getOrchestratorCapabilities(collaborator, {
      allowGuestOrchestrator: true,
      allowRoomCollaboratorsToSendVisualizer: false,
    })

    expect(allowed.canUseOrchestrator).toBe(true)
    expect(allowed.canLiveCode).toBe(false)
    expect(allowed.canSendPreset(savedPreset)).toBe(true)
    expect(blockedByOrchestrator.canSendPreset(savedPreset)).toBe(false)
    expect(blockedBySendPolicy.canSendPreset(savedPreset)).toBe(false)
  })

  it('blocks collaborator raw code, gallery presets, and non-DB preset sends', () => {
    const capabilities = getOrchestratorCapabilities(collaborator, {
      allowGuestOrchestrator: true,
      allowRoomCollaboratorsToSendVisualizer: true,
    })
    const missingDbId: PresetLeaf = {
      id: 'preset:missing',
      folderId: 7,
      name: 'missing',
      code: 'osc(10).out()',
      isGallery: false,
      usesCamera: false,
    }

    expect(capabilities.canSendPreset(galleryPreset)).toBe(false)
    expect(capabilities.canSendPreset(missingDbId)).toBe(false)
    expect(canSendHydraInput('osc(10).out()', capabilities)).toBe(false)
  })

  it('keeps collaborator sends inside the configured party preset folder when restricted', () => {
    const capabilities = getOrchestratorCapabilities(collaborator, {
      allowGuestOrchestrator: true,
      allowRoomCollaboratorsToSendVisualizer: true,
      restrictCollaboratorsToPartyPresetFolder: true,
      partyPresetFolderId: 7,
    })

    expect(capabilities.canSendPreset(savedPreset)).toBe(true)
    expect(capabilities.canSendPreset({ ...savedPreset, folderId: 8 })).toBe(false)
  })
})
