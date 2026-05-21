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
