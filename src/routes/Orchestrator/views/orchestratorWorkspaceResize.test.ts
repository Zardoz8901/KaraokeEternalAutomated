import { describe, expect, it } from 'vitest'
import {
  ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT,
  ORCHESTRATOR_REF_PANEL_DEFAULT_WIDTH,
  ORCHESTRATOR_RESIZE_KEYBOARD_STEP,
  clampCodeDockHeight,
  clampRefPanelWidth,
  getCodeDockMaxHeight,
  getPointerCodeDockHeight,
  getPointerRefPanelWidth,
  getStoredCodeDockHeight,
  getStoredRefPanelWidth,
  serializeRefPanelWidth,
  stepCodeDockHeight,
  stepRefPanelWidth,
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

describe('orchestrator code-dock splitter (G2 / HiG #16)', () => {
  it('caps the code dock at half the viewport — Stage always keeps at least an equal share', () => {
    expect(getCodeDockMaxHeight(1000)).toBe(500)
    expect(getCodeDockMaxHeight(300)).toBe(ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT)
    expect(getCodeDockMaxHeight(Number.NaN)).toBe(ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT)
  })

  it('clamps heights into [12rem, 50% viewport]', () => {
    expect(clampCodeDockHeight(100, 1000)).toBe(ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT)
    expect(clampCodeDockHeight(320, 1000)).toBe(320)
    expect(clampCodeDockHeight(900, 1000)).toBe(500)
    expect(clampCodeDockHeight(Number.NaN, 1000)).toBe(ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT)
  })

  it('treats missing or junk storage as null (CSS 30dvh default), clamping real values', () => {
    expect(getStoredCodeDockHeight(null, 1000)).toBeNull()
    expect(getStoredCodeDockHeight('junk', 1000)).toBeNull()
    expect(getStoredCodeDockHeight('320', 1000)).toBe(320)
    expect(getStoredCodeDockHeight('9000', 1000)).toBe(500)
  })

  it('derives the dock height from the pointer relative to the container bottom', () => {
    expect(getPointerCodeDockHeight({ containerBottom: 1000, pointerClientY: 700, viewportHeight: 1000 })).toBe(300)
    expect(getPointerCodeDockHeight({ containerBottom: 1000, pointerClientY: 950, viewportHeight: 1000 })).toBe(ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT)
    expect(getPointerCodeDockHeight({ containerBottom: 1000, pointerClientY: 100, viewportHeight: 1000 })).toBe(500)
  })

  it('steps by the keyboard increment within bounds (APG window-splitter arrows)', () => {
    expect(stepCodeDockHeight(300, 1, 1000)).toBe(300 + ORCHESTRATOR_RESIZE_KEYBOARD_STEP)
    expect(stepCodeDockHeight(300, -1, 1000)).toBe(300 - ORCHESTRATOR_RESIZE_KEYBOARD_STEP)
    expect(stepCodeDockHeight(498, 1, 1000)).toBe(500)
    expect(stepCodeDockHeight(ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT, -1, 1000)).toBe(ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT)
  })

  it('steps the rail width by the same increment within its range', () => {
    expect(stepRefPanelWidth(280, 1)).toBe(280 + ORCHESTRATOR_RESIZE_KEYBOARD_STEP)
    expect(stepRefPanelWidth(280, -1)).toBe(280 - ORCHESTRATOR_RESIZE_KEYBOARD_STEP)
    expect(stepRefPanelWidth(516, 1)).toBe(520)
    expect(stepRefPanelWidth(244, -1)).toBe(240)
  })
})
