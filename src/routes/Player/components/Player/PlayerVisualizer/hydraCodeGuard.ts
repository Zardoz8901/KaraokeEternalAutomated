import { getSkipRegions, type SkipRegion } from '../../../../../lib/skipRegions'

/**
 * Fatal patterns: property access on Math.random (which returns a number)
 * followed by a dereference that will crash every tick.
 *
 * The regex matches:  Math.random  .identifier  followed by [ or ( or .
 * This catches:  Math.random.afft[2], Math.random.foo(), Math.random.x.y
 * But NOT:       Math.random() * 20  (parens immediately after "random")
 */
const FATAL_PATTERNS: Array<{ regex: RegExp, description: string }> = [
  {
    regex: /Math\.random\s*\.\s*[a-zA-Z_$]\w*\s*[.[(]/g,
    description: 'Property dereference on Math.random (returns number, not object)',
  },
]

function isInsideSkipRegion (pos: number, regions: SkipRegion[]): boolean {
  for (const r of regions) {
    if (pos >= r.start && pos < r.end) return true
    if (r.start > pos) break // regions are sorted by start
  }
  return false
}

/**
 * Detect fatal code patterns that will crash every Hydra tick.
 * Returns a description of the first fatal pattern found (outside comments/strings),
 * or null if the code is safe.
 *
 * Uses getSkipRegions() to ignore matches inside comments, strings, and template literals.
 */
export function detectFatalPatterns (code: string): string | null {
  if (!code || code.trim().length === 0) return null

  const { regions } = getSkipRegions(code)

  for (const { regex, description } of FATAL_PATTERNS) {
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(code)) !== null) {
      if (!isInsideSkipRegion(match.index, regions)) {
        return description
      }
    }
  }

  return null
}
