import { describe, expect, it } from 'vitest'
import {
  collectPresetKeys,
  getPresetKey,
  getPresetPanelNotice,
  getPresetRowUx,
  getPresetToolbarUx,
} from './presetOperatorUx'
import type { OrchestratorCapabilities } from './orchestratorCapabilities'
import type { PresetLeaf, PresetTreeNode } from './presetTree'

const hostCapabilities: OrchestratorCapabilities = {
  isRoomOwner: true,
  isManager: true,
  canUseOrchestrator: true,
  canLiveCode: true,
  canSendGalleryPreset: true,
  canSendSavedPresetsByPolicy: true,
  canManageRoomVisualPolicy: true,
  partyPresetFolderId: null,
  isRestrictedToPartyPresetFolder: false,
  canSendPreset: () => true,
}

const operatorCapabilities: OrchestratorCapabilities = {
  ...hostCapabilities,
  isRoomOwner: false,
  isManager: false,
  canLiveCode: false,
  canSendGalleryPreset: false,
  canManageRoomVisualPolicy: false,
  canSendPreset: preset => !preset.isGallery && preset.presetId === 10,
}

const browseCapabilities: OrchestratorCapabilities = {
  ...operatorCapabilities,
  canSendSavedPresetsByPolicy: false,
  canSendPreset: () => false,
}

const restrictedCapabilities: OrchestratorCapabilities = {
  ...operatorCapabilities,
  partyPresetFolderId: 7,
  isRestrictedToPartyPresetFolder: true,
  canSendPreset: preset => !preset.isGallery && preset.presetId === 10 && preset.folderId === 7,
}

const savedPreset: PresetLeaf = {
  id: 'preset:10',
  presetId: 10,
  folderId: 7,
  name: 'Saved',
  code: 'osc(10).out()',
  isGallery: false,
  usesCamera: false,
}

const galleryPreset: PresetLeaf = {
  id: 'gallery:rainbow',
  name: 'rainbow',
  code: 'osc(10).out()',
  isGallery: true,
  usesCamera: false,
}

describe('presetOperatorUx', () => {
  it('uses deterministic stable keys for gallery and saved DB presets', () => {
    expect(getPresetKey(savedPreset)).toBe('preset:10')
    expect(getPresetKey(galleryPreset)).toBe('gallery:rainbow')
    expect(getPresetKey({ ...savedPreset, presetId: undefined, id: 'preset:missing' })).toBeNull()
  })

  it('collects scoped tree keys for cleanup of stale selected and loaded state', () => {
    const nodes: PresetTreeNode[] = [
      { id: 'gallery', name: 'Gallery', isGallery: true, children: [galleryPreset] },
      { id: 'folder:7', folderId: 7, name: 'Party', isGallery: false, children: [savedPreset] },
    ]

    expect([...collectPresetKeys(nodes)]).toEqual(['gallery:rainbow', 'preset:10'])
  })

  it('keeps host management controls available while hiding all non-host management controls', () => {
    expect(getPresetToolbarUx(hostCapabilities)).toEqual({
      showManagementToolbar: true,
      showNewFolder: true,
      showSavePreset: true,
    })
    expect(getPresetToolbarUx(operatorCapabilities)).toEqual({
      showManagementToolbar: false,
      showNewFolder: false,
      showSavePreset: false,
    })
  })

  it('makes non-host gallery presets preview-only', () => {
    expect(getPresetRowUx(galleryPreset, operatorCapabilities)).toMatchObject({
      presetKey: 'gallery:rainbow',
      showLoad: true,
      showSend: false,
      sendEnabled: false,
      showClone: false,
      showManagementActions: false,
      rowNotice: 'Gallery presets are preview-only.',
    })
  })

  it('allows non-host saved DB sends only when existing capabilities allow them', () => {
    expect(getPresetRowUx(savedPreset, operatorCapabilities)).toMatchObject({
      presetKey: 'preset:10',
      showSend: true,
      sendEnabled: true,
      sendDisabledReason: null,
      showManagementActions: false,
    })

    expect(getPresetRowUx(savedPreset, browseCapabilities)).toMatchObject({
      showSend: true,
      sendEnabled: false,
      sendDisabledReason: 'policy',
      sendDisabledMessage: 'Send disabled by room policy',
      rowNotice: null,
    })
  })

  it('uses row-specific copy for party-folder send restrictions', () => {
    expect(getPresetRowUx({ ...savedPreset, folderId: 8 }, restrictedCapabilities)).toMatchObject({
      showSend: true,
      sendEnabled: false,
      sendDisabledReason: 'party-folder',
      sendDisabledMessage: 'Not in party folder',
      rowNotice: 'Not in party folder',
    })
  })

  it('deduplicates broad policy notices from row-specific restriction notices', () => {
    expect(getPresetPanelNotice(browseCapabilities)).toEqual({
      kind: 'policy-blocked',
      message: 'Room policy blocks collaborator visual sends.',
    })
    expect(getPresetPanelNotice(restrictedCapabilities)).toEqual({
      kind: 'party-folder-restricted',
      message: 'Only presets in the party folder can be sent.',
    })
    expect(getPresetPanelNotice(hostCapabilities)).toBeNull()
  })
})
