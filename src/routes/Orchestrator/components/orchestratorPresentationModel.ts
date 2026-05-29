export type OrchestratorPreviewTruth
  = 'off'
    | 'local'
    | 'waitingForPlayerMedia'
    | 'usingPlayerMp4'
    | 'externalVideoSource'

export type OrchestratorAudioTruth = 'none' | 'simulated' | 'playerReactive'

export type OrchestratorPlayerOutputTruth = 'noPlayer' | 'playerPresentNotMirrored'

export interface OrchestratorPresentationInput {
  isHydraActive: boolean
  hasInitVideo: boolean
  hasPlayerMediaClock: boolean
  hasPlayerMediaVideoElement: boolean
  isPlayerPresent: boolean
  hasFftData: boolean
  hasSimulatedAudioSource: boolean
}

export interface OrchestratorPresentationModel {
  preview: OrchestratorPreviewTruth
  audio: OrchestratorAudioTruth
  playerOutput: OrchestratorPlayerOutputTruth
  primaryLabel: string
  secondaryLabels: string[]
}

export const LOCAL_PREVIEW_LABEL = 'Local Preview'
export const APPLIED_ON_PLAYER_LABEL = 'Applied on Player'
export const BROADCAST_READY_LABEL = 'Broadcast ready'
export const FORBIDDEN_PREVIEW_TERMS = ['Live', 'Player Output', 'Now Playing', 'On Display'] as const

export function getOrchestratorPresentationModel ({
  isHydraActive,
  hasInitVideo,
  hasPlayerMediaClock,
  hasPlayerMediaVideoElement,
  isPlayerPresent,
  hasFftData,
  hasSimulatedAudioSource,
}: OrchestratorPresentationInput): OrchestratorPresentationModel {
  const preview = getPreviewTruth({
    isHydraActive,
    hasInitVideo,
    hasPlayerMediaClock,
    hasPlayerMediaVideoElement,
  })
  const audio = getAudioTruth({
    isHydraActive,
    isPlayerPresent,
    hasFftData,
    hasSimulatedAudioSource,
  })
  const playerOutput = isPlayerPresent ? 'playerPresentNotMirrored' : 'noPlayer'
  const secondaryLabels = getSecondaryLabels(preview, audio)

  return {
    preview,
    audio,
    playerOutput,
    primaryLabel: LOCAL_PREVIEW_LABEL,
    secondaryLabels,
  }
}

function getPreviewTruth ({
  isHydraActive,
  hasInitVideo,
  hasPlayerMediaClock,
  hasPlayerMediaVideoElement,
}: Pick<OrchestratorPresentationInput, 'isHydraActive' | 'hasInitVideo' | 'hasPlayerMediaClock' | 'hasPlayerMediaVideoElement'>): OrchestratorPreviewTruth {
  if (!isHydraActive) return 'off'
  if (hasInitVideo && hasPlayerMediaClock && !hasPlayerMediaVideoElement) return 'waitingForPlayerMedia'
  if (hasInitVideo && hasPlayerMediaClock && hasPlayerMediaVideoElement) return 'usingPlayerMp4'
  if (hasInitVideo && !hasPlayerMediaClock) return 'externalVideoSource'
  return 'local'
}

function getAudioTruth ({
  isHydraActive,
  isPlayerPresent,
  hasFftData,
  hasSimulatedAudioSource,
}: Pick<OrchestratorPresentationInput, 'isHydraActive' | 'isPlayerPresent' | 'hasFftData' | 'hasSimulatedAudioSource'>): OrchestratorAudioTruth {
  if (!isHydraActive) return 'none'
  if (isPlayerPresent && hasFftData) return 'playerReactive'
  if (hasSimulatedAudioSource) return 'simulated'
  return 'none'
}

function getSecondaryLabels (
  preview: OrchestratorPreviewTruth,
  audio: OrchestratorAudioTruth,
): string[] {
  const labels: string[] = []

  if (preview === 'off') {
    labels.push('Visualizer off')
  } else if (preview === 'waitingForPlayerMedia') {
    labels.push('Waiting for Player media')
  } else if (preview === 'usingPlayerMp4') {
    labels.push('Preview using Player MP4')
  } else if (preview === 'externalVideoSource') {
    labels.push('Preview uses preset video source')
  }

  if (audio === 'playerReactive') {
    labels.push('Player audio reactive')
  } else if (audio === 'simulated') {
    labels.push('Simulated audio')
  }

  return labels
}
