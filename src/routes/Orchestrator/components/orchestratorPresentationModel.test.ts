import { describe, expect, it } from 'vitest'
import {
  APPLIED_ON_PLAYER_LABEL,
  BROADCAST_READY_LABEL,
  FORBIDDEN_PREVIEW_TERMS,
  getOrchestratorPresentationModel,
  LOCAL_PREVIEW_LABEL,
} from './orchestratorPresentationModel'

const baseInput = {
  isHydraActive: true,
  hasInitVideo: false,
  hasPlayerMediaClock: false,
  hasPlayerMediaVideoElement: false,
  isPlayerPresent: false,
  hasFftData: false,
  hasSimulatedAudioSource: true,
}

describe('getOrchestratorPresentationModel', () => {
  it('exports shared label constants for cross-surface vocabulary', () => {
    expect(LOCAL_PREVIEW_LABEL).toBe('Local Preview')
    expect(APPLIED_ON_PLAYER_LABEL).toBe('Applied on Player')
    expect(BROADCAST_READY_LABEL).toBe('Broadcast ready')
  })

  it('keeps shared preview, applied, and broadcast labels free of forbidden preview terms', () => {
    const labels = [
      LOCAL_PREVIEW_LABEL,
      APPLIED_ON_PLAYER_LABEL,
      BROADCAST_READY_LABEL,
    ]

    for (const label of labels) {
      for (const term of FORBIDDEN_PREVIEW_TERMS) {
        expect(label).not.toContain(term)
      }
    }
  })

  it('labels inactive visualizer preview without audio or player output', () => {
    const model = getOrchestratorPresentationModel({
      ...baseInput,
      isHydraActive: false,
      hasSimulatedAudioSource: false,
    })

    expect(model.preview).toBe('off')
    expect(model.audio).toBe('none')
    expect(model.playerOutput).toBe('noPlayer')
    expect(model.primaryLabel).toBe(LOCAL_PREVIEW_LABEL)
    expect(model.secondaryLabels).toEqual(['Visualizer off'])
  })

  it('labels ordinary local preview with simulated audio', () => {
    const model = getOrchestratorPresentationModel(baseInput)

    expect(model.preview).toBe('local')
    expect(model.audio).toBe('simulated')
    expect(model.playerOutput).toBe('noPlayer')
    expect(model.secondaryLabels).toEqual(['Simulated audio'])
  })

  it('labels player audio data without using forbidden live copy', () => {
    const model = getOrchestratorPresentationModel({
      ...baseInput,
      isPlayerPresent: true,
      hasFftData: true,
    })

    expect(model.audio).toBe('playerReactive')
    expect(model.playerOutput).toBe('playerPresentNotMirrored')
    expect(model.secondaryLabels).toContain('Player audio reactive')
  })

  it('waits for player media when initVideo needs the current MP4 provider', () => {
    const model = getOrchestratorPresentationModel({
      ...baseInput,
      hasInitVideo: true,
      hasPlayerMediaClock: true,
      hasPlayerMediaVideoElement: false,
    })

    expect(model.preview).toBe('waitingForPlayerMedia')
    expect(model.secondaryLabels).toEqual(['Waiting for Player media', 'Simulated audio'])
  })

  it('labels Player MP4 source use when the provider is present', () => {
    const model = getOrchestratorPresentationModel({
      ...baseInput,
      hasInitVideo: true,
      hasPlayerMediaClock: true,
      hasPlayerMediaVideoElement: true,
    })

    expect(model.preview).toBe('usingPlayerMp4')
    expect(model.secondaryLabels).toEqual(['Preview using Player MP4', 'Simulated audio'])
  })

  it('uses safe preset video-source copy when no Player MP4 binding is available', () => {
    const model = getOrchestratorPresentationModel({
      ...baseInput,
      hasInitVideo: true,
      hasPlayerMediaClock: false,
      hasPlayerMediaVideoElement: false,
    })

    expect(model.preview).toBe('externalVideoSource')
    expect(model.secondaryLabels).toEqual(['Preview uses preset video source', 'Simulated audio'])
  })

  it('keeps forbidden terms out of preview labels', () => {
    const states = [
      getOrchestratorPresentationModel({ ...baseInput, isHydraActive: false, hasSimulatedAudioSource: false }),
      getOrchestratorPresentationModel(baseInput),
      getOrchestratorPresentationModel({ ...baseInput, hasInitVideo: true, hasPlayerMediaClock: true }),
      getOrchestratorPresentationModel({ ...baseInput, hasInitVideo: true, hasPlayerMediaClock: true, hasPlayerMediaVideoElement: true }),
      getOrchestratorPresentationModel({ ...baseInput, hasInitVideo: true }),
      getOrchestratorPresentationModel({ ...baseInput, isPlayerPresent: true, hasFftData: true }),
    ]

    for (const model of states) {
      const copy = [model.primaryLabel, ...model.secondaryLabels].join(' ')
      for (const term of FORBIDDEN_PREVIEW_TERMS) {
        expect(copy).not.toContain(term)
      }
    }
  })
})
