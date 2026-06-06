import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Shared empty/error/loading treatment audit (visual-language §4.6 empty-state, §4.9 error-copy).
// Pure fs-read so it runs under standalone vitest AND the project config (no alias/jsdom deps).
// This file deliberately does NOT touch orchestratorColorAudit.test.ts so the empty-error-states
// slice stays parallelizable against the breakpoints-lockstep slice (which owns the audit test).
// Copy-string correctness is owned by presetEmptyState.test.ts; this file asserts only the
// container treatment (token-driven sizing + a11y live-region roles), never the literal strings.

function read (relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

const PRESET_BROWSER_CSS = 'src/routes/Orchestrator/components/PresetBrowser.css'
const PRESET_BROWSER_TSX = 'src/routes/Orchestrator/components/PresetBrowser.tsx'
const API_REFERENCE_CSS = 'src/routes/Orchestrator/components/ApiReference.css'
const API_REFERENCE_TSX = 'src/routes/Orchestrator/components/ApiReference.tsx'

// First-capture of a brace block for the given (possibly multi-member, multi-line) selector head.
function ruleBody (css: string, selectorSource: string): string {
  return new RegExp(`${selectorSource}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`).exec(css)?.[1] ?? ''
}

describe('Orchestrator empty/error/loading treatment', () => {
  // ── §4.6: token-driven sizing (semantic --orch-text-meta, not the raw --text-xs rung) ──
  it('routes the PresetBrowser empty/error/loading group through --orch-text-meta (not raw --text-xs)', () => {
    const css = read(PRESET_BROWSER_CSS)
    // Scope to the grouped rule ONLY: .toolbarHint and .searchClear legitimately keep --text-xs.
    const grouped = ruleBody(css, '\\.loading,\\s*\\.error,\\s*\\.empty,\\s*\\.policyNotice')

    expect(grouped).not.toBe('')
    expect(grouped).toMatch(/font-size:\s*var\(--orch-text-meta\)/)
    expect(grouped).not.toMatch(/font-size:\s*var\(--text-xs\)/)
    // Idle color stays muted; do not conflate the bare .empty with the bordered .policyNotice (§4.6).
    expect(grouped).toMatch(/color:\s*var\(--orch-muted\)/)
  })

  it('keeps the PresetBrowser error label on the danger role token', () => {
    const css = read(PRESET_BROWSER_CSS)
    // Standalone .error override block (first-match skips the grouped selector, which ends in a comma).
    const errorBlock = ruleBody(css, '(?:^|\\n)\\s*\\.error')
    expect(errorBlock).toMatch(/color:\s*var\(--orch-danger\)/)
  })

  it('keeps the ApiReference empty-state on the --orch-text-meta token', () => {
    const css = read(API_REFERENCE_CSS)
    const block = ruleBody(css, '\\.emptyState')
    expect(block).toMatch(/font-size:\s*var\(--orch-text-meta\)/)
  })

  // ── §4.6 status-line / §4.9 never-silent: live-region roles on the notices ──
  it('marks the PresetBrowser error region as an assertive alert', () => {
    const src = read(PRESET_BROWSER_TSX)
    expect(src).toMatch(/className=\{styles\.error\}[^>]*role=['"]alert['"]/)
  })

  it('marks the PresetBrowser empty and policy notices as polite status regions', () => {
    const src = read(PRESET_BROWSER_TSX)
    expect(src).toMatch(/className=\{styles\.empty\}[^>]*role=['"]status['"]/)
    expect(src).toMatch(/className=\{styles\.empty\}[^>]*aria-live=['"]polite['"]/)
    expect(src).toMatch(/className=\{styles\.policyNotice\}[^>]*role=['"]status['"]/)
    expect(src).toMatch(/className=\{styles\.policyNotice\}[^>]*aria-live=['"]polite['"]/)
  })

  it('keeps exactly loading + empty + policy as the three polite status regions (loading unchanged)', () => {
    const src = read(PRESET_BROWSER_TSX)
    expect((src.match(/role=['"]status['"]/g) ?? []).length).toBe(3)
    expect((src.match(/aria-live=['"]polite['"]/g) ?? []).length).toBe(3)
  })

  it('keeps the PresetBrowser empty copy sourced from presetEmptyState (no inline literal)', () => {
    const src = read(PRESET_BROWSER_TSX)
    // §4.6 lock: the empty notice renders the sourced message, never a hard-coded string.
    expect(src).toMatch(/className=\{styles\.empty\}[^>]*>\{presetPanelState\?\.message\s*\?\?\s*ROOM_EMPTY_PRESET_PANEL_MESSAGE\}/)
  })

  it('marks the ApiReference empty-state as a polite status region', () => {
    const src = read(API_REFERENCE_TSX)
    expect(src).toMatch(/className=\{styles\.emptyState\}[^>]*role=['"]status['"]/)
    expect(src).toMatch(/className=\{styles\.emptyState\}[^>]*aria-live=['"]polite['"]/)
  })
})
