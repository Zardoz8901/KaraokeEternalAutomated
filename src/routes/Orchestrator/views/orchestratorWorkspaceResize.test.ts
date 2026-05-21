import { describe, expect, it } from 'vitest'
import {
  ORCHESTRATOR_REF_PANEL_DEFAULT_WIDTH,
  clampRefPanelWidth,
  getPointerRefPanelWidth,
  getStoredRefPanelWidth,
  serializeRefPanelWidth,
} from './orchestratorWorkspaceResize'

describe('orchestratorWorkspaceResize', () => {
  it('uses the default ref-panel width when storage has no finite value', () => {
    expect(getStoredRefPanelWidth(null)).toBe(ORCHESTRATOR_REF_PANEL_DEFAULT_WIDTH)
    expect(getStoredRefPanelWidth('not-a-number')).toBe(ORCHESTRATOR_REF_PANEL_DEFAULT_WIDTH)
  })

  it('clamps stored width to the supported desktop range', () => {
    expect(getStoredRefPanelWidth('120')).toBe(240)
    expect(getStoredRefPanelWidth('720')).toBe(520)
    expect(getStoredRefPanelWidth('360')).toBe(360)
  })

  it('clamps pointer drag width relative to the container left edge', () => {
    expect(getPointerRefPanelWidth({ containerLeft: 100, pointerClientX: 250 })).toBe(240)
    expect(getPointerRefPanelWidth({ containerLeft: 100, pointerClientX: 500 })).toBe(400)
    expect(getPointerRefPanelWidth({ containerLeft: 100, pointerClientX: 760 })).toBe(520)
  })

  it('serializes clamped width for localStorage persistence', () => {
    expect(serializeRefPanelWidth(900)).toBe('520')
    expect(serializeRefPanelWidth(300)).toBe('300')
  })

  it('keeps clampRefPanelWidth available for direct layout calculations', () => {
    expect(clampRefPanelWidth(100)).toBe(240)
    expect(clampRefPanelWidth(280)).toBe(280)
    expect(clampRefPanelWidth(900)).toBe(520)
  })
})
