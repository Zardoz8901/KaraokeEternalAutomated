import { resolveRoomAccessPrefs } from 'shared/roomAccess'
import type { IRoomPrefs } from 'shared/types'
import type { PresetLeaf } from './presetTree'

export interface OrchestratorUserContext {
  userId?: number | null
  roomId?: number | null
  ownRoomId?: number | null
  isAdmin?: boolean
  isGuest?: boolean
}

export interface PresetSendCandidate {
  presetId?: number
  folderId?: number
  isGallery: boolean
}

export interface OrchestratorCapabilities {
  isRoomOwner: boolean
  isManager: boolean
  canUseOrchestrator: boolean
  canLiveCode: boolean
  canSendGalleryPreset: boolean
  canSendSavedPresetsByPolicy: boolean
  canManageRoomVisualPolicy: boolean
  partyPresetFolderId: number | null
  isRestrictedToPartyPresetFolder: boolean
  canSendPreset: (preset: PresetSendCandidate) => boolean
}

function isPositiveInteger (value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export function getOrchestratorCapabilities (
  user: OrchestratorUserContext,
  roomPrefs?: Partial<IRoomPrefs> | null,
): OrchestratorCapabilities {
  const accessPrefs = resolveRoomAccessPrefs(roomPrefs)
  const isRoomOwner = typeof user.roomId === 'number'
    && typeof user.ownRoomId === 'number'
    && user.roomId === user.ownRoomId
  const isManager = user.isAdmin === true || isRoomOwner
  const canSendSavedPresetsByPolicy = isManager
    || (accessPrefs.allowGuestOrchestrator && accessPrefs.allowRoomCollaboratorsToSendVisualizer)

  const canSendPreset = (preset: PresetSendCandidate): boolean => {
    if (preset.isGallery) return isManager
    if (!isPositiveInteger(preset.presetId)) return false
    if (isManager) return true
    if (!canSendSavedPresetsByPolicy) return false
    if (accessPrefs.restrictCollaboratorsToPartyPresetFolder) {
      return preset.folderId === accessPrefs.partyPresetFolderId
    }
    return true
  }

  return {
    isRoomOwner,
    isManager,
    canUseOrchestrator: isManager || accessPrefs.allowGuestOrchestrator,
    canLiveCode: isManager,
    canSendGalleryPreset: isManager,
    canSendSavedPresetsByPolicy,
    canManageRoomVisualPolicy: isRoomOwner,
    partyPresetFolderId: accessPrefs.partyPresetFolderId,
    isRestrictedToPartyPresetFolder: accessPrefs.restrictCollaboratorsToPartyPresetFolder,
    canSendPreset,
  }
}

export function canSendHydraInput (
  input: PresetLeaf | string,
  capabilities: OrchestratorCapabilities,
): boolean {
  if (typeof input === 'string') return capabilities.canLiveCode
  return capabilities.canSendPreset(input)
}
