export interface PreviewSize {
  width: number
  height: number
}

interface FitPreviewOptions {
  dpr?: number
  minW?: number
}

export const NARROW_BREAKPOINT = 980
const PREVIEW_MIN = 240
const PREVIEW_PADDING = 32
const PREVIEW_RATIO = 0.75
const PREVIEW_MAX_DESKTOP = 420
const PREVIEW_MAX_DPR = 2

export function shouldShowRefPanelToggle (innerWidth: number): boolean {
  return innerWidth < NARROW_BREAKPOINT
}

export function getPreviewSize (innerWidth: number): PreviewSize {
  if (innerWidth < NARROW_BREAKPOINT) {
    const width = Math.max(PREVIEW_MIN, innerWidth - PREVIEW_PADDING)
    return {
      width,
      height: Math.round(width * PREVIEW_RATIO),
    }
  }

  return {
    width: PREVIEW_MAX_DESKTOP,
    height: Math.round(PREVIEW_MAX_DESKTOP * PREVIEW_RATIO),
  }
}

function positiveFiniteDimension (value: number | undefined, floor: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return floor
  }
  return Math.max(floor, Math.round(value))
}

function safeDevicePixelRatio (dpr: number | undefined): number {
  if (typeof dpr !== 'number' || !Number.isFinite(dpr) || dpr <= 0) {
    return 1
  }
  return Math.min(Math.max(dpr, 1), PREVIEW_MAX_DPR)
}

export function fitPreviewToFrame (
  frameW: number | undefined,
  frameH: number | undefined,
  opts: FitPreviewOptions = {},
): PreviewSize {
  const cssWidth = positiveFiniteDimension(frameW, opts.minW ?? PREVIEW_MIN)
  const cssHeight = positiveFiniteDimension(frameH, 1)
  const dpr = safeDevicePixelRatio(opts.dpr)

  return {
    width: Math.max(1, Math.round(cssWidth * dpr)),
    height: Math.max(1, Math.round(cssHeight * dpr)),
  }
}
