import type { OrchestratorCapabilities } from './orchestratorCapabilities'
import type { PresetLeaf, PresetTreeNode } from './presetTree'

export type PresetKey = `preset:${number}` | `gallery:${string}`
export type SendDisabledReason = 'policy' | 'party-folder'
export type PresetPanelNoticeKind = 'policy-blocked' | 'party-folder-restricted'

export interface PresetToolbarUx {
  showManagementToolbar: boolean
  showNewFolder: boolean
  showSavePreset: boolean
}

export interface PresetRowUx {
  presetKey: PresetKey | null
  showLoad: boolean
  showSend: boolean
  sendEnabled: boolean
  sendDisabledReason: SendDisabledReason | null
  sendDisabledMessage: string | null
  showClone: boolean
  showManagementActions: boolean
  rowNotice: string | null
}

export interface PresetPanelNotice {
  kind: PresetPanelNoticeKind
  message: string
}

function isPositiveInteger (value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export function getPresetKey (preset: PresetLeaf): PresetKey | null {
  if (preset.isGallery) {
    const galleryId = preset.id.startsWith('gallery:')
      ? preset.id.slice('gallery:'.length)
      : preset.id
    return galleryId.length > 0 ? `gallery:${galleryId}` : null
  }

  if (!isPositiveInteger(preset.presetId)) return null
  return `preset:${preset.presetId}`
}

export function collectPresetKeys (nodes: PresetTreeNode[]): Set<PresetKey> {
  const keys = new Set<PresetKey>()
  for (const node of nodes) {
    for (const preset of node.children) {
      const key = getPresetKey(preset)
      if (key !== null) keys.add(key)
    }
  }
  return keys
}

export function getPresetToolbarUx (capabilities: Pick<OrchestratorCapabilities, 'isManager'>): PresetToolbarUx {
  return {
    showManagementToolbar: capabilities.isManager,
    showNewFolder: capabilities.isManager,
    showSavePreset: capabilities.isManager,
  }
}

export function getPresetPanelNotice (
  capabilities: Pick<OrchestratorCapabilities, 'isManager' | 'canSendSavedPresetsByPolicy' | 'isRestrictedToPartyPresetFolder'>,
): PresetPanelNotice | null {
  if (capabilities.isManager) return null

  if (!capabilities.canSendSavedPresetsByPolicy) {
    return {
      kind: 'policy-blocked',
      message: 'Room policy blocks collaborator visual sends.',
    }
  }

  if (capabilities.isRestrictedToPartyPresetFolder) {
    return {
      kind: 'party-folder-restricted',
      message: 'Only presets in the party folder can be sent.',
    }
  }

  return null
}

export function getPresetRowUx (
  preset: PresetLeaf,
  capabilities: Pick<
    OrchestratorCapabilities,
    'isManager' | 'canSendSavedPresetsByPolicy' | 'isRestrictedToPartyPresetFolder' | 'partyPresetFolderId' | 'canSendPreset'
  >,
): PresetRowUx {
  const presetKey = getPresetKey(preset)

  if (capabilities.isManager) {
    const canSend = capabilities.canSendPreset(preset)
    return {
      presetKey,
      showLoad: true,
      showSend: canSend,
      sendEnabled: canSend,
      sendDisabledReason: null,
      sendDisabledMessage: null,
      showClone: preset.isGallery,
      showManagementActions: true,
      rowNotice: null,
    }
  }

  if (preset.isGallery) {
    return {
      presetKey,
      showLoad: true,
      showSend: false,
      sendEnabled: false,
      sendDisabledReason: null,
      sendDisabledMessage: null,
      showClone: false,
      showManagementActions: false,
      rowNotice: 'Gallery presets are preview-only.',
    }
  }

  if (presetKey === null) {
    return {
      presetKey,
      showLoad: true,
      showSend: false,
      sendEnabled: false,
      sendDisabledReason: null,
      sendDisabledMessage: null,
      showClone: false,
      showManagementActions: false,
      rowNotice: null,
    }
  }

  if (!capabilities.canSendSavedPresetsByPolicy) {
    return {
      presetKey,
      showLoad: true,
      showSend: true,
      sendEnabled: false,
      sendDisabledReason: 'policy',
      sendDisabledMessage: 'Send disabled by room policy',
      showClone: false,
      showManagementActions: false,
      rowNotice: null,
    }
  }

  if (
    capabilities.isRestrictedToPartyPresetFolder
    && preset.folderId !== capabilities.partyPresetFolderId
  ) {
    return {
      presetKey,
      showLoad: true,
      showSend: true,
      sendEnabled: false,
      sendDisabledReason: 'party-folder',
      sendDisabledMessage: 'Not in party folder',
      showClone: false,
      showManagementActions: false,
      rowNotice: 'Not in party folder',
    }
  }

  const canSend = capabilities.canSendPreset(preset)
  return {
    presetKey,
    showLoad: true,
    showSend: canSend,
    sendEnabled: canSend,
    sendDisabledReason: null,
    sendDisabledMessage: null,
    showClone: false,
    showManagementActions: false,
    rowNotice: null,
  }
}
