import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const auditedFiles = [
  'src/routes/Orchestrator/views/OrchestratorView.css',
  'src/routes/Orchestrator/components/StagePanel.css',
  'src/routes/Orchestrator/components/HydraPreview.css',
  'src/routes/Orchestrator/components/OrchestratorStatusStrip.css',
  'src/routes/Orchestrator/components/CodeEditor.css',
  'src/routes/Orchestrator/components/CodeEditor.tsx',
  'src/routes/Orchestrator/components/hydraHighlightStyle.ts',
  'src/routes/Orchestrator/components/PresetBrowser.css',
  'src/routes/Orchestrator/components/PresetPicker.css',
  'src/routes/Orchestrator/components/PresetTree.css',
  'src/routes/Orchestrator/components/ApiReference.css',
]

function stripAllowedTokenBlock (source: string): string {
  return source.replace(
    /\/\* ORCH_SOLARIZED_TOKENS_START \*\/[\s\S]*?\/\* ORCH_SOLARIZED_TOKENS_END \*\//g,
    '',
  )
}

describe('Orchestrator color audit', () => {
  it('keeps hard-coded color literals inside the Solarized token block only', () => {
    const violations = auditedFiles.flatMap((file) => {
      const absolute = path.join(process.cwd(), file)
      const source = stripAllowedTokenBlock(fs.readFileSync(absolute, 'utf8'))
      const matches = source.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []
      return matches.map(match => `${file}: ${match}`)
    })

    expect(violations).toEqual([])
  })
})
