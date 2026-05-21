import { describe, expect, it } from 'vitest'
import {
  getOrchestratorWorkspaceModel,
  getRemoteHydraSnapshot,
} from './orchestratorWorkspaceModel'

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

describe('orchestratorWorkspaceModel', () => {
  it('normalizes host workspace panels while preserving Code/API access', () => {
    const model = getOrchestratorWorkspaceModel({
      capabilities: hostCapabilities,
      activeDesktopPanel: 'api',
      activeMobileTab: 'code',
      innerWidth: 1440,
    })

    expect(model.shellModel.desktopLayout).toBe('hostSplit')
    expect(model.activeDesktopPanel).toBe('api')
    expect(model.activeMobilePanel).toBe('code')
    expect(model.canShowApiPanel).toBe(true)
    expect(model.canShowCodePanel).toBe(true)
    expect(model.isMobile).toBe(false)
    expect(model.previewSize).toEqual({ width: 420, height: 315 })
  })

  it('normalizes stale Code/API state out of operator workspace and expands Stage', () => {
    const model = getOrchestratorWorkspaceModel({
      capabilities: operatorCapabilities,
      activeDesktopPanel: 'api',
      activeMobileTab: 'code',
      innerWidth: 390,
    })

    expect(model.shellModel.workspaceMode).toBe('operator')
    expect(model.shellModel.desktopLayout).toBe('operatorStageExpanded')
    expect(model.activeDesktopPanel).toBe('presets')
    expect(model.activeMobilePanel).toBe('stage')
    expect(model.canShowApiPanel).toBe(false)
    expect(model.canShowCodePanel).toBe(false)
    expect(model.isMobile).toBe(true)
    expect(model.previewSize).toEqual({ width: 358, height: 269 })
  })

  it('selects player visualizer data after a direct hydra update has arrived', () => {
    const snapshot = getRemoteHydraSnapshot(
      {
        hasHydraUpdate: true,
        hydraCode: 'player-code',
        hydraPresetIndex: 4,
        mode: 'off',
        isEnabled: false,
        sensitivity: 0.75,
        allowCamera: true,
      },
      {
        hydraCode: 'status-code',
        hydraPresetIndex: 1,
        mode: 'hydra',
        isEnabled: true,
        sensitivity: 1.2,
        allowCamera: false,
      },
    )

    expect(snapshot.hasHydraUpdate).toBe(true)
    expect(snapshot.remoteHydraCode).toBe('player-code')
    expect(snapshot.remotePresetIndex).toBe(4)
    expect(snapshot.previewHydraState).toEqual({
      mode: 'off',
      isEnabled: false,
      sensitivity: 0.75,
      allowCamera: true,
    })
  })

  it('falls back to PLAYER_STATUS visualizer data before the first direct hydra update', () => {
    const snapshot = getRemoteHydraSnapshot(
      {
        hasHydraUpdate: false,
        hydraCode: 'player-code',
        hydraPresetIndex: 4,
      },
      {
        hydraCode: 'status-code',
        hydraPresetIndex: 1,
      },
    )

    expect(snapshot.hasHydraUpdate).toBe(false)
    expect(snapshot.remoteHydraCode).toBe('status-code')
    expect(snapshot.remotePresetIndex).toBe(1)
  })
})
