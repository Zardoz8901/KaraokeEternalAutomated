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
