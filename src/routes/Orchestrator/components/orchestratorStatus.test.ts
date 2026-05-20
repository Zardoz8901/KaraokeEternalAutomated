import { describe, expect, it } from 'vitest'
import { getOrchestratorStatusModel } from './orchestratorStatus'

const hostCapabilities = {
  canUseOrchestrator: true,
  canLiveCode: true,
}

const operatorCapabilities = {
  canUseOrchestrator: true,
  canLiveCode: false,
}

const blockedCapabilities = {
  canUseOrchestrator: false,
  canLiveCode: false,
}

describe('getOrchestratorStatusModel', () => {
  it('labels host live-coding authority', () => {
    const model = getOrchestratorStatusModel({
      capabilities: hostCapabilities,
      sendStatus: 'idle',
      userHasEdited: false,
      pendingRemoteCount: 0,
      cameraStatus: 'idle',
    })

    expect(model.authority.label).toBe('Host live coding')
    expect(model.authority.tone).toBe('primary')
  })

  it('labels preset operator authority', () => {
    const model = getOrchestratorStatusModel({
      capabilities: operatorCapabilities,
      sendStatus: 'idle',
      userHasEdited: false,
      pendingRemoteCount: 0,
      cameraStatus: 'idle',
    })

    expect(model.authority.label).toBe('Preset operator')
    expect(model.authority.tone).toBe('neutral')
  })

  it('labels blocked room policy', () => {
    const model = getOrchestratorStatusModel({
      capabilities: blockedCapabilities,
      sendStatus: 'idle',
      userHasEdited: false,
      pendingRemoteCount: 0,
      cameraStatus: 'idle',
    })

    expect(model.authority.label).toBe('Policy blocked')
    expect(model.authority.tone).toBe('danger')
  })

  it.each([
    ['sending', false, 0, 'Sending'],
    ['synced', false, 0, 'Synced'],
    ['error', false, 0, 'Failed'],
    ['idle', true, 0, 'Local edits'],
    ['idle', false, 2, 'Remote update'],
    ['idle', false, 0, 'Preview ready'],
  ] as const)('derives broadcast label for %s/%s/%s', (sendStatus, userHasEdited, pendingRemoteCount, expected) => {
    const model = getOrchestratorStatusModel({
      capabilities: hostCapabilities,
      sendStatus,
      userHasEdited,
      pendingRemoteCount,
      cameraStatus: 'idle',
    })

    expect(model.broadcast.label).toBe(expected)
  })

  it.each([
    ['idle', 'Camera idle'],
    ['connecting', 'Camera connecting'],
    ['active', 'Camera live'],
    ['error', 'Camera error'],
  ] as const)('derives camera label for %s', (cameraStatus, expected) => {
    const model = getOrchestratorStatusModel({
      capabilities: hostCapabilities,
      sendStatus: 'idle',
      userHasEdited: false,
      pendingRemoteCount: 0,
      cameraStatus,
    })

    expect(model.camera.label).toBe(expected)
  })
})
