import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('PresetBrowser modal styling contract', () => {
  it('applies the scoped Orchestrator modal class to every modal', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/routes/Orchestrator/components/PresetBrowser.tsx'), 'utf8')
    const modalCount = source.match(/<Modal\b/g)?.length ?? 0
    const scopedModalCount = source.match(/<Modal[\s\S]*?className=\{styles\.orchestratorModal\}/g)?.length ?? 0

    expect(modalCount).toBe(5)
    expect(scopedModalCount).toBe(modalCount)
  })
})

describe('Preset operator visual contract', () => {
  it('keeps named row actions and mobile touch targets in the PresetTree CSS contract', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/routes/Orchestrator/components/PresetTree.css'), 'utf8')

    expect(source).toContain('min-height: 3.25rem')
    expect(source).toContain('min-height: 4rem')
    expect(source).toContain('min-width: 2.25rem')
    expect(source).toContain('min-width: 2.75rem')
    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
    // G0 flat register: Send is neutral-until-state — default-action strength comes from
    // --orch-text-strong/--orch-border-strong, never a resting blue tint.
    expect(source).toContain('--orch-text-strong')
    expect(source).toContain('--orch-border-strong')
    expect(source).toContain('--orch-warning')
  })

  it('keeps the non-host Presets panel from reserving hidden toolbar space', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/routes/Orchestrator/components/PresetBrowser.tsx'), 'utf8')

    expect(source).toContain('toolbarUx.showManagementToolbar &&')
  })
})
