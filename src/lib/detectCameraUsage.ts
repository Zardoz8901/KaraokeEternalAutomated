/**
 * Detect camera/external source usage in Hydra code.
 * Shared utility — imports only from lib/skipRegions.
 * No cross-route imports (no Player/Orchestrator deps).
 */
import { getSkipRegions, type SkipRegion } from 'lib/skipRegions'

export interface SourceInitInfo {
  hasInitCam: boolean
  hasExplicitInit: boolean
}

export interface CameraUsageResult {
  /** Which external sources (s0–s3) are referenced via src() */
  sources: string[]
  /** Whether any sN.initCam() call is present (requires app camera permission) */
  hasInitCam: boolean
  /** Whether any sN.initVideo/initImage/initScreen call is present (self-initializing, no permission needed) */
  hasExplicitSource: boolean
  /** Per-source init info: only sources that have at least one init call */
  sourceInitMap: Record<string, SourceInitInfo>
}

function isInSkipRegion (pos: number, regions: readonly SkipRegion[]): boolean {
  return regions.some(r => pos >= r.start && pos < r.end)
}

const SRC_PATTERN = /\bsrc\s*\(\s*(s[0-3])\s*\)/g
const INIT_CAM_PATTERN = /\b(s[0-3])\.initCam\s*\(/g
const INIT_SOURCE_PATTERN = /\b(s[0-3])\.(initVideo|initImage|initScreen)\s*\(/g

function ensureSourceEntry (map: Record<string, SourceInitInfo>, src: string): SourceInitInfo {
  if (!map[src]) {
    map[src] = { hasInitCam: false, hasExplicitInit: false }
  }
  return map[src]
}

export function detectCameraUsage (code: string): CameraUsageResult {
  const { regions } = getSkipRegions(code)
  const sourceSet = new Set<string>()
  const sourceInitMap: Record<string, SourceInitInfo> = {}

  // Find src(sN) references outside skip regions
  let m: RegExpExecArray | null
  const srcRe = new RegExp(SRC_PATTERN.source, 'g')
  while ((m = srcRe.exec(code)) !== null) {
    if (!isInSkipRegion(m.index, regions)) {
      sourceSet.add(m[1])
    }
  }

  // Find sN.initCam() calls outside skip regions
  const camRe = new RegExp(INIT_CAM_PATTERN.source, 'g')
  while ((m = camRe.exec(code)) !== null) {
    if (!isInSkipRegion(m.index, regions)) {
      ensureSourceEntry(sourceInitMap, m[1]).hasInitCam = true
    }
  }

  // Find sN.initVideo/initImage/initScreen() calls outside skip regions
  const sourceRe = new RegExp(INIT_SOURCE_PATTERN.source, 'g')
  while ((m = sourceRe.exec(code)) !== null) {
    if (!isInSkipRegion(m.index, regions)) {
      ensureSourceEntry(sourceInitMap, m[1]).hasExplicitInit = true
    }
  }

  const sources = Array.from(sourceSet).sort()
  const hasInitCam = Object.values(sourceInitMap).some(v => v.hasInitCam)
  const hasExplicitSource = Object.values(sourceInitMap).some(v => v.hasExplicitInit)

  return { sources, hasInitCam, hasExplicitSource, sourceInitMap }
}
