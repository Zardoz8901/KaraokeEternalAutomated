import type { PresetTreeNode } from './presetTree'

export type PresetPanelStateKind = 'policy-blocked' | 'search-empty' | 'restricted-folder-empty' | 'room-empty'

export interface PresetPanelState {
  kind: PresetPanelStateKind
  message: string
}

export interface PresetPanelStateInput {
  query: string
  visibleTreeCount: number
  scopedPresetCount: number
  isRestrictedToPartyPresetFolder: boolean
  partyPresetFolderId: number | null
  canSendSavedPresetsByPolicy: boolean
}

export const ROOM_EMPTY_PRESET_PANEL_MESSAGE = 'No saved visuals available for this room.'

export function countPresetLeaves (nodes: PresetTreeNode[]): number {
  return nodes.reduce((sum, node) => sum + node.children.length, 0)
}

export function getPresetPanelState ({
  query,
  visibleTreeCount,
  scopedPresetCount,
  isRestrictedToPartyPresetFolder,
  partyPresetFolderId,
  canSendSavedPresetsByPolicy,
}: PresetPanelStateInput): PresetPanelState | null {
  if (visibleTreeCount === 0) {
    if (query.trim().length > 0) {
      return { kind: 'search-empty', message: 'No visuals match your search.' }
    }

    if (isRestrictedToPartyPresetFolder && partyPresetFolderId !== null && scopedPresetCount === 0) {
      return { kind: 'restricted-folder-empty', message: 'Party preset folder has no saved visuals.' }
    }

    return { kind: 'room-empty', message: ROOM_EMPTY_PRESET_PANEL_MESSAGE }
  }

  if (!canSendSavedPresetsByPolicy) {
    return { kind: 'policy-blocked', message: 'Room policy blocks collaborator visual sends.' }
  }

  return null
}
