import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// i18n-readiness guard (visual-language §4.10). Owner stance 2026-06-06: English-only, defer
// extraction. We do NOT translate today, but the layout must not HARD-BLOCK future i18n — labels
// can be ~1.5x longer (translation / long room/preset names) and must clamp gracefully via a
// flexible max-width + ellipsis, never a fixed px width that clips at a pixel assumption.
// (The complementary "accessible name contains the full label" check is covered by existing
// PresetTree/StagePanel render tests.)

const ORCHESTRATOR_CSS = [
  'src/routes/Orchestrator/views/OrchestratorView.css',
  'src/routes/Orchestrator/components/StagePanel.css',
  'src/routes/Orchestrator/components/OrchestratorStatusStrip.css',
  'src/routes/Orchestrator/components/CodeEditor.css',
  'src/routes/Orchestrator/components/PresetBrowser.css',
  'src/routes/Orchestrator/components/PresetPicker.css',
  'src/routes/Orchestrator/components/PresetTree.css',
  'src/routes/Orchestrator/components/ApiReference.css',
  'src/routes/Orchestrator/components/HydraPreview.css',
]

function read (relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

// Bodies of every rule that uses `text-overflow: ellipsis`, by walking out to the enclosing braces.
function ellipsisRuleBodies (css: string): string[] {
  const bodies: string[] = []
  for (const match of css.matchAll(/text-overflow:\s*ellipsis/g)) {
    const open = css.lastIndexOf('{', match.index)
    const close = css.indexOf('}', match.index)
    if (open !== -1 && close !== -1) bodies.push(css.slice(open + 1, close))
  }
  return bodies
}

describe('Orchestrator i18n readiness (§4.10)', () => {
  it('clamps elided text with a flexible max-width, never a fixed px width', () => {
    // A fixed `width: Npx` on an ellipsis rule clips translated/long labels at a pixel assumption.
    // The lookbehind excludes max-width/min-width (the sanctioned flexible clamps) and width: 100%/auto.
    const FIXED_PX_WIDTH = /(?<![-\w])width:\s*\d+px/
    const offenders: string[] = []

    for (const file of ORCHESTRATOR_CSS) {
      for (const body of ellipsisRuleBodies(read(file))) {
        const hit = FIXED_PX_WIDTH.exec(body)
        if (hit) offenders.push(`${file}: ellipsis rule pins ${hit[0]}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('keeps the cited StatusStrip status text on the documented max-width + ellipsis pattern', () => {
    const strip = read('src/routes/Orchestrator/components/OrchestratorStatusStrip.css')
    const bodies = ellipsisRuleBodies(strip)

    expect(bodies.length).toBeGreaterThan(0)
    // At least one elided status rule uses a rem-based max-width (the §4.10 exemplar: 13rem/15rem/11rem).
    expect(bodies.some(body => /max-width:\s*[\d.]+rem/.test(body))).toBe(true)
  })
})
