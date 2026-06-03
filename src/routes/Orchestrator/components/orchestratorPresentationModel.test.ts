import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  APPLIED_ON_PLAYER_LABEL,
  BROADCAST_READY_LABEL,
  CAM_BADGE_LABEL,
  FORBIDDEN_PREVIEW_TERMS,
  GALLERY_BADGE_LABEL,
  getOrchestratorPresentationModel,
  LOADED_IN_PREVIEW_BADGE_LABEL,
  LOCAL_PREVIEW_LABEL,
  SELECTED_BADGE_LABEL,
  START_BADGE_LABEL,
  type OrchestratorPreviewTruth,
} from './orchestratorPresentationModel'
import * as presentationModel from './orchestratorPresentationModel'

const baseInput = {
  isHydraActive: true,
  hasInitVideo: false,
  hasPlayerMediaClock: false,
  hasPlayerMediaVideoElement: false,
  isPlayerPresent: false,
  hasFftData: false,
  hasSimulatedAudioSource: true,
}

const expectedPreviewStatusClassKey = {
  off: 'statusOff',
  local: 'statusLocal',
  waitingForPlayerMedia: 'statusWaitingForPlayerMedia',
  usingPlayerMp4: 'statusUsingPlayerMp4',
  externalVideoSource: 'statusExternalVideoSource',
} satisfies Record<OrchestratorPreviewTruth, string>

describe('getOrchestratorPresentationModel', () => {
  it('exports shared label constants for cross-surface vocabulary', () => {
    expect(LOCAL_PREVIEW_LABEL).toBe('Local Preview')
    expect(APPLIED_ON_PLAYER_LABEL).toBe('Applied on Player')
    expect(BROADCAST_READY_LABEL).toBe('Broadcast ready')
    expect(SELECTED_BADGE_LABEL).toBe('Selected')
    expect(LOADED_IN_PREVIEW_BADGE_LABEL).toBe('Loaded in preview')
    expect(START_BADGE_LABEL).toBe('Start')
    expect(CAM_BADGE_LABEL).toBe('Cam')
    expect(GALLERY_BADGE_LABEL).toBe('Gallery')
  })

  it('drops the Gallery entry from the collapsed badge glyph and legend maps (phase-17)', () => {
    // The Gallery badge is retired; the word survives only in the preset row accessible name.
    expect(GALLERY_BADGE_LABEL in presentationModel.PRESET_STATE_GLYPHS).toBe(false)
    expect(presentationModel.PRESET_STATE_LEGEND.some(entry => entry.label === GALLERY_BADGE_LABEL)).toBe(false)
    expect(Object.keys(presentationModel.PRESET_STATE_GLYPHS)).toHaveLength(5)
    expect(presentationModel.PRESET_STATE_LEGEND).toHaveLength(5)
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

  it('exports a class key for every preview truth', () => {
    const exported = presentationModel as typeof presentationModel & {
      PREVIEW_STATUS_CLASS_KEY?: Record<OrchestratorPreviewTruth, string>
    }

    expect(exported.PREVIEW_STATUS_CLASS_KEY).toEqual(expectedPreviewStatusClassKey)
  })

  it('defines a CSS selector for every preview truth class key', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src/routes/Orchestrator/components/HydraPreview.css'),
      'utf8',
    )

    for (const classKey of Object.values(expectedPreviewStatusClassKey)) {
      expect(css).toMatch(new RegExp(`\\.${classKey}\\b`))
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
