import { describe, expect, it } from 'vitest'
import { getOrchestratorShellModel, normalizeDesktopPanel, normalizeMobileTab } from './orchestratorShellModel'

describe('orchestratorShellModel', () => {
  it('keeps the host workspace split across Presets/API, Stage, and Code', () => {
    const model = getOrchestratorShellModel({
      canUseOrchestrator: true,
      canLiveCode: true,
      canSendSavedPresetsByPolicy: true,
    })

    expect(model.workspaceMode).toBe('host')
    expect(model.desktopLayout).toBe('hostSplit')
    expect(model.visibleDesktopPanels).toEqual(['presets', 'api'])
    expect(model.visibleMobileTabs).toEqual(['stage', 'code', 'ref'])
    expect(model.statusAuthorityLabel).toBe('Host live coding')
    expect(model.canExitToLibrary).toBe(true)
  })

  it('expands Stage and removes Code/API for preset operators', () => {
    const model = getOrchestratorShellModel({
      canUseOrchestrator: true,
      canLiveCode: false,
      canSendSavedPresetsByPolicy: true,
    })

    expect(model.workspaceMode).toBe('operator')
    expect(model.desktopLayout).toBe('operatorStageExpanded')
    expect(model.visibleDesktopPanels).toEqual(['presets'])
    expect(model.visibleMobileTabs).toEqual(['stage', 'ref'])
    expect(model.statusAuthorityLabel).toBe('Preset operator')
  })

  it('distinguishes browse-only users from preset operators', () => {
    const model = getOrchestratorShellModel({
      canUseOrchestrator: true,
      canLiveCode: false,
      canSendSavedPresetsByPolicy: false,
    })

    expect(model.workspaceMode).toBe('browse')
    expect(model.desktopLayout).toBe('operatorStageExpanded')
    expect(model.visibleDesktopPanels).toEqual(['presets'])
    expect(model.visibleMobileTabs).toEqual(['stage', 'ref'])
    expect(model.statusAuthorityLabel).toBe('Browse only')
  })

  it('normalizes stale panel state when capability changes hide a surface', () => {
    const model = getOrchestratorShellModel({
      canUseOrchestrator: true,
      canLiveCode: false,
      canSendSavedPresetsByPolicy: true,
    })

    expect(normalizeDesktopPanel('api', model)).toBe('presets')
    expect(normalizeMobileTab('code', model)).toBe('stage')
  })

  it('keeps blocked state explicit for defensive render paths', () => {
    const model = getOrchestratorShellModel({
      canUseOrchestrator: false,
      canLiveCode: false,
      canSendSavedPresetsByPolicy: false,
    })

    expect(model.workspaceMode).toBe('blocked')
    expect(model.statusAuthorityLabel).toBe('Policy blocked')
    expect(model.visibleDesktopPanels).toEqual(['presets'])
    expect(model.visibleMobileTabs).toEqual(['stage', 'ref'])
  })
})
