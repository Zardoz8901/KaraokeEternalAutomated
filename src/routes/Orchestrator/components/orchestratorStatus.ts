import type { OrchestratorCapabilities } from './orchestratorCapabilities'
import type { CameraRelayStatus } from './hydraPreviewUtils'

export type OrchestratorStatusTone = 'neutral' | 'primary' | 'live' | 'success' | 'warning' | 'danger'

export interface OrchestratorStatusItem {
  label: string
  tone: OrchestratorStatusTone
}

export interface OrchestratorStatusModel {
  authority: OrchestratorStatusItem
  broadcast: OrchestratorStatusItem
  camera: OrchestratorStatusItem
}

export interface OrchestratorStatusInput {
  capabilities: Pick<OrchestratorCapabilities, 'canUseOrchestrator' | 'canLiveCode' | 'canSendSavedPresetsByPolicy'>
  sendStatus: 'idle' | 'sending' | 'synced' | 'error'
  userHasEdited: boolean
  pendingRemoteCount: number
  cameraStatus: CameraRelayStatus
}

export function getOrchestratorStatusModel ({
  capabilities,
  sendStatus,
  userHasEdited,
  pendingRemoteCount,
  cameraStatus,
}: OrchestratorStatusInput): OrchestratorStatusModel {
  return {
    authority: getAuthorityStatus(capabilities),
    broadcast: getBroadcastStatus(sendStatus, userHasEdited, pendingRemoteCount),
    camera: getCameraStatus(cameraStatus),
  }
}

function getAuthorityStatus (
  capabilities: Pick<OrchestratorCapabilities, 'canUseOrchestrator' | 'canLiveCode' | 'canSendSavedPresetsByPolicy'>,
): OrchestratorStatusItem {
  if (!capabilities.canUseOrchestrator) {
    return { label: 'Policy blocked', tone: 'danger' }
  }

  if (capabilities.canLiveCode) {
    return { label: 'Host live coding', tone: 'primary' }
  }

  if (!capabilities.canSendSavedPresetsByPolicy) {
    return { label: 'Browse only', tone: 'neutral' }
  }

  return { label: 'Preset operator', tone: 'neutral' }
}

function getBroadcastStatus (
  sendStatus: OrchestratorStatusInput['sendStatus'],
  userHasEdited: boolean,
  pendingRemoteCount: number,
): OrchestratorStatusItem {
  if (pendingRemoteCount > 0) return { label: 'Remote update', tone: 'warning' }
  if (sendStatus === 'sending') return { label: 'Sending', tone: 'warning' }
  if (sendStatus === 'synced') return { label: 'Synced', tone: 'success' }
  if (sendStatus === 'error') return { label: 'Failed', tone: 'danger' }
  if (userHasEdited) return { label: 'Local edits', tone: 'warning' }
  return { label: 'Preview ready', tone: 'live' }
}

function getCameraStatus (cameraStatus: CameraRelayStatus): OrchestratorStatusItem {
  if (cameraStatus === 'connecting') return { label: 'Camera connecting', tone: 'warning' }
  if (cameraStatus === 'active') return { label: 'Camera live', tone: 'live' }
  if (cameraStatus === 'error') return { label: 'Camera error', tone: 'danger' }
  return { label: 'Camera idle', tone: 'neutral' }
}
