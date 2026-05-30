import { describe, expect, it } from 'vitest'
import { getOrchestratorStatusModel } from './orchestratorStatus'
import {
  APPLIED_ON_PLAYER_LABEL,
  FORBIDDEN_PREVIEW_TERMS,
  getOrchestratorPresentationModel,
} from './orchestratorPresentationModel'

const hostCapabilities = {
  canUseOrchestrator: true,
  canLiveCode: true,
  canSendSavedPresetsByPolicy: true,
}

const operatorCapabilities = {
  canUseOrchestrator: true,
  canLiveCode: false,
  canSendSavedPresetsByPolicy: true,
}

const browseCapabilities = {
  canUseOrchestrator: true,
  canLiveCode: false,
  canSendSavedPresetsByPolicy: false,
}

const blockedCapabilities = {
  canUseOrchestrator: false,
  canLiveCode: false,
  canSendSavedPresetsByPolicy: false,
}

const basePresentationInput = {
  isHydraActive: true,
  hasInitVideo: false,
  hasPlayerMediaClock: false,
  hasPlayerMediaVideoElement: false,
  isPlayerPresent: false,
  hasFftData: false,
  hasSimulatedAudioSource: true,
}

function unique (labels: string[]): string[] {
  return Array.from(new Set(labels)).sort()
}

function getStageAuthorityLabels (): string[] {
  return unique([
    hostCapabilities,
    operatorCapabilities,
    browseCapabilities,
    blockedCapabilities,
  ].map(capabilities => getOrchestratorStatusModel({
    capabilities,
    sendStatus: 'idle',
    userHasEdited: false,
    pendingRemoteCount: 0,
    cameraStatus: 'idle',
  }).authority.label))
}

function getStageBroadcastLabels (): string[] {
  return unique([
    getOrchestratorStatusModel({
      capabilities: hostCapabilities,
      sendStatus: 'sending',
      userHasEdited: false,
      pendingRemoteCount: 0,
      cameraStatus: 'idle',
    }).broadcast.label,
    getOrchestratorStatusModel({
      capabilities: hostCapabilities,
      sendStatus: 'synced',
      userHasEdited: false,
      pendingRemoteCount: 0,
      cameraStatus: 'idle',
    }).broadcast.label,
    getOrchestratorStatusModel({
      capabilities: hostCapabilities,
      sendStatus: 'error',
      userHasEdited: false,
      pendingRemoteCount: 0,
      cameraStatus: 'idle',
    }).broadcast.label,
    getOrchestratorStatusModel({
      capabilities: hostCapabilities,
      sendStatus: 'idle',
      userHasEdited: true,
      pendingRemoteCount: 0,
      cameraStatus: 'idle',
    }).broadcast.label,
    getOrchestratorStatusModel({
      capabilities: hostCapabilities,
      sendStatus: 'idle',
      userHasEdited: false,
      pendingRemoteCount: 2,
      cameraStatus: 'idle',
    }).broadcast.label,
    getOrchestratorStatusModel({
      capabilities: hostCapabilities,
      sendStatus: 'idle',
      userHasEdited: false,
      pendingRemoteCount: 0,
      cameraStatus: 'idle',
    }).broadcast.label,
  ])
}

function getStageCameraLabels (): string[] {
  return unique((['idle', 'connecting', 'active', 'error'] as const).map(cameraStatus => getOrchestratorStatusModel({
    capabilities: hostCapabilities,
    sendStatus: 'idle',
    userHasEdited: false,
    pendingRemoteCount: 0,
    cameraStatus,
  }).camera.label))
}

function getPreviewLabels (): string[] {
  const models = [
    getOrchestratorPresentationModel({ ...basePresentationInput, isHydraActive: false, hasSimulatedAudioSource: false }),
    getOrchestratorPresentationModel(basePresentationInput),
    getOrchestratorPresentationModel({ ...basePresentationInput, hasInitVideo: true, hasPlayerMediaClock: true }),
    getOrchestratorPresentationModel({ ...basePresentationInput, hasInitVideo: true, hasPlayerMediaClock: true, hasPlayerMediaVideoElement: true }),
    getOrchestratorPresentationModel({ ...basePresentationInput, hasInitVideo: true }),
    getOrchestratorPresentationModel({ ...basePresentationInput, isPlayerPresent: true, hasFftData: true }),
  ]

  return unique(models.flatMap(model => [model.primaryLabel, ...model.secondaryLabels]))
}

const surfaceLabels = {
  stageAuthority: getStageAuthorityLabels,
  stageBroadcast: getStageBroadcastLabels,
  stageCamera: getStageCameraLabels,
  previewOverlay: getPreviewLabels,
  presetRowBadges: () => unique([
    'Selected',
    'Loaded in preview',
    'Start',
    'Cam',
    'Gallery',
    APPLIED_ON_PLAYER_LABEL,
  ]),
  remoteBanner: () => unique(['Remote update available']),
  presetBrowserNotice: () => unique([
    'preset-policy',
    'party-folder',
    'empty-state',
  ]),
} as const

describe('Orchestrator status ownership', () => {
  it('keeps status labels owned by one surface only', () => {
    const ownersByLabel = new Map<string, string[]>()

    for (const [surface, getLabels] of Object.entries(surfaceLabels)) {
      for (const label of getLabels()) {
        ownersByLabel.set(label, [...(ownersByLabel.get(label) ?? []), surface])
      }
    }

    const duplicatedOwners = Array.from(ownersByLabel.entries())
      .filter(([, owners]) => owners.length > 1)

    expect(duplicatedOwners).toEqual([])
  })

  it('keeps preview, broadcast, and badge labels free of forbidden output/live claims', () => {
    const guardedLabels = [
      ...surfaceLabels.stageBroadcast(),
      ...surfaceLabels.previewOverlay(),
      ...surfaceLabels.presetRowBadges(),
    ]

    for (const label of guardedLabels) {
      for (const term of FORBIDDEN_PREVIEW_TERMS) {
        expect(label).not.toContain(term)
      }
    }
  })

  it('documents the allowed live wording carve-out for authority and camera truths', () => {
    expect(surfaceLabels.stageAuthority()).toContain('Host live coding')
    expect(surfaceLabels.stageCamera()).toContain('Camera live')
  })
})
