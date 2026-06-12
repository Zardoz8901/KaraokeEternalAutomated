export const ORCHESTRATOR_REF_PANEL_MIN_WIDTH = 240
export const ORCHESTRATOR_REF_PANEL_MAX_WIDTH = 520
export const ORCHESTRATOR_REF_PANEL_DEFAULT_WIDTH = 280
export const ORCHESTRATOR_REF_PANEL_STORAGE_KEY = 'orchestratorRefPanelWidth'

export interface PointerRefPanelWidthInput {
  containerLeft: number
  pointerClientX: number
}

export function clampRefPanelWidth (width: number): number {
  if (!Number.isFinite(width)) return ORCHESTRATOR_REF_PANEL_DEFAULT_WIDTH
  return Math.min(
    ORCHESTRATOR_REF_PANEL_MAX_WIDTH,
    Math.max(ORCHESTRATOR_REF_PANEL_MIN_WIDTH, width),
  )
}

export function getStoredRefPanelWidth (storedValue: string | null | undefined): number {
  if (!storedValue) return ORCHESTRATOR_REF_PANEL_DEFAULT_WIDTH
  const width = Number(storedValue)
  if (!Number.isFinite(width)) return ORCHESTRATOR_REF_PANEL_DEFAULT_WIDTH
  return clampRefPanelWidth(width)
}

export function getPointerRefPanelWidth ({
  containerLeft,
  pointerClientX,
}: PointerRefPanelWidthInput): number {
  return clampRefPanelWidth(pointerClientX - containerLeft)
}

export function serializeRefPanelWidth (width: number): string {
  return String(clampRefPanelWidth(width))
}

// G2 / HiG #16 — Stage/Code splitter. The code dock is operator-resizable between a
// 12rem floor and half the viewport (Stage >= Code invariant); null means "no operator
// preference", which leaves the CSS 30dvh default in charge.
export const ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT = 192 // 12rem at the 16px shell root
export const ORCHESTRATOR_CODE_DOCK_MAX_VIEWPORT_FRACTION = 0.5
export const ORCHESTRATOR_CODE_DOCK_DEFAULT_VIEWPORT_FRACTION = 0.3 // mirrors the CSS 30dvh default
export const ORCHESTRATOR_CODE_DOCK_STORAGE_KEY = 'orchestratorCodeDockHeight'
export const ORCHESTRATOR_RESIZE_KEYBOARD_STEP = 16

export interface PointerCodeDockHeightInput {
  containerBottom: number
  pointerClientY: number
  viewportHeight: number
}

export function getCodeDockMaxHeight (viewportHeight: number): number {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT
  return Math.max(
    ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT,
    Math.round(viewportHeight * ORCHESTRATOR_CODE_DOCK_MAX_VIEWPORT_FRACTION),
  )
}

export function clampCodeDockHeight (height: number, viewportHeight: number): number {
  if (!Number.isFinite(height)) return ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT
  return Math.min(
    getCodeDockMaxHeight(viewportHeight),
    Math.max(ORCHESTRATOR_CODE_DOCK_MIN_HEIGHT, Math.round(height)),
  )
}

export function getStoredCodeDockHeight (storedValue: string | null | undefined, viewportHeight: number): number | null {
  if (!storedValue) return null
  const height = Number(storedValue)
  if (!Number.isFinite(height)) return null
  return clampCodeDockHeight(height, viewportHeight)
}

export function getPointerCodeDockHeight ({
  containerBottom,
  pointerClientY,
  viewportHeight,
}: PointerCodeDockHeightInput): number {
  return clampCodeDockHeight(containerBottom - pointerClientY, viewportHeight)
}

export function stepCodeDockHeight (current: number, direction: 1 | -1, viewportHeight: number): number {
  return clampCodeDockHeight(current + direction * ORCHESTRATOR_RESIZE_KEYBOARD_STEP, viewportHeight)
}

export function stepRefPanelWidth (current: number, direction: 1 | -1): number {
  return clampRefPanelWidth(current + direction * ORCHESTRATOR_RESIZE_KEYBOARD_STEP)
}
