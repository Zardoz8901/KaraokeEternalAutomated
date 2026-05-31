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

function readAuditedFile (file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8')
}

function readComponentCss (file: string): string {
  return readAuditedFile(`src/routes/Orchestrator/components/${file}`)
}

function readOrchestratorViewCss (): string {
  return readAuditedFile('src/routes/Orchestrator/views/OrchestratorView.css')
}

function cssBlock (source: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{(?<body>[\\s\\S]*?)\\n\\}`).exec(source)
  return match?.groups?.body ?? ''
}

function collectOrchestratorViewPropertyValues (): Map<string, string> {
  const values = new Map<string, string>()
  const source = readOrchestratorViewCss()

  for (const match of source.matchAll(/(--orch-[\w-]+)\s*:\s*([^;]+);/g)) {
    values.set(match[1], match[2].trim())
  }

  return values
}

function resolveTokenValue (token: string, values = collectOrchestratorViewPropertyValues()): string | null {
  const seen = new Set<string>()
  let current = token

  while (!seen.has(current)) {
    seen.add(current)
    const value = values.get(current)
    if (!value) {
      return null
    }

    const reference = /^var\(\s*(--orch-[\w-]+)\s*\)$/.exec(value)?.[1]
    if (!reference) {
      return value
    }
    current = reference
  }

  return null
}

function collectDefinedOrchProperties (): Set<string> {
  const defined = new Set<string>()

  for (const file of auditedFiles) {
    const source = readAuditedFile(file)
    for (const match of source.matchAll(/(--orch-[\w-]+)\s*:/g)) {
      defined.add(match[1])
    }
  }

  return defined
}

function collectUnresolvedOrchVarRefs (): string[] {
  const defined = collectDefinedOrchProperties()

  return auditedFiles.flatMap((file) => {
    const source = readAuditedFile(file)
    const unresolved: string[] = []

    for (const match of source.matchAll(/var\(\s*(--orch-[\w-]+)\s*([,)])/g)) {
      const [, token, closing] = match
      const hasFallback = closing === ','
      if (!hasFallback && !defined.has(token)) {
        unresolved.push(`${file}: ${token}`)
      }
    }

    return unresolved
  })
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

  it('keeps Orchestrator custom property references resolvable', () => {
    expect(collectUnresolvedOrchVarRefs()).toEqual([])
  })

  it('defines the Gate 3d spacing and focus-ring tokens', () => {
    const source = readOrchestratorViewCss()

    expect(source).toContain('--orch-space-2xs: 0.125rem;')
    expect(source).toContain('--orch-space-xs: 0.25rem;')
    expect(source).toContain('--orch-space-sm: 0.35rem;')
    expect(source).toContain('--orch-space-md: 0.5rem;')
    expect(source).toContain('--orch-space-lg: 0.625rem;')
    expect(source).toContain('--orch-space-xl: 0.75rem;')
    expect(source).toContain('--orch-space-2xl: 1rem;')
    expect(source).toContain('--orch-focus-ring-width: 2px;')
    expect(source).toContain('--orch-focus-ring-offset: 2px;')
    expect(source).toContain('--orch-focus-ring-inset-offset: -2px;')
    expect(source).toContain('--orch-focus-ring: var(--orch-focus-ring-width) solid var(--orch-focus);')
  })

  it('keeps signal role tokens distinct across camera, applied-player, and synced states', () => {
    const values = collectOrchestratorViewPropertyValues()

    expect(values.get('--orch-live')).toBe('var(--orch-cyan)')
    expect(values.get('--orch-applied')).toBe('var(--orch-violet)')
    expect(values.get('--orch-success')).toBe('var(--orch-green)')
    expect(resolveTokenValue('--orch-live', values)).toBe('#2aa198')
    expect(resolveTokenValue('--orch-applied', values)).toBe('#6c71c4')
    expect(resolveTokenValue('--orch-success', values)).toBe('#859900')
    expect(new Set([
      resolveTokenValue('--orch-live', values),
      resolveTokenValue('--orch-applied', values),
      resolveTokenValue('--orch-success', values),
    ])).toHaveLength(3)
  })

  it('routes Applied, Cam, and Synced colors through semantic role tokens', () => {
    const presetTree = readComponentCss('PresetTree.css')
    const statusStrip = readComponentCss('OrchestratorStatusStrip.css')

    expect(cssBlock(presetTree, '.badgeApplied')).toContain('var(--orch-applied)')
    expect(cssBlock(presetTree, '.badgeCam')).toContain('var(--orch-live)')
    expect(cssBlock(statusStrip, '.toneLive')).toContain('var(--orch-live)')
    expect(cssBlock(statusStrip, '.toneSuccess')).toContain('var(--orch-success)')
  })

  it('keeps PresetTree keyboard focus visible instead of suppressing outlines', () => {
    const source = readComponentCss('PresetTree.css')

    expect(source).not.toMatch(/\.folderHeader:focus-visible[\s\S]*?outline:\s*none/)
    expect(source).not.toMatch(/\.folderActionButton:focus-visible[\s\S]*?outline:\s*none/)
    expect(source).not.toMatch(/\.actionButton:focus-visible[\s\S]*?outline:\s*none/)
    expect(source).not.toMatch(/\.presetRow:focus-visible[\s\S]*?outline:\s*none/)
    expect(source).toContain('box-shadow: inset 0 0 0 var(--orch-focus-ring-width) var(--orch-focus)')
  })

  it('keeps ApiReference action buttons keyboard-focusable', () => {
    const source = readComponentCss('ApiReference.css')

    expect(source).toContain('.actionButton:focus-visible')
    expect(source).toContain('.actionButtonSecondary:focus-visible')
    expect(source).toContain('outline: var(--orch-focus-ring);')
  })

  it('honors reduced-motion for Orchestrator shell, CodeEditor controls, and PresetBrowser skeletons', () => {
    expect(readAuditedFile('src/routes/Orchestrator/views/OrchestratorView.css')).toContain('@media (prefers-reduced-motion: reduce)')
    expect(readComponentCss('CodeEditor.css')).toContain('@media (prefers-reduced-motion: reduce)')
    expect(readComponentCss('PresetBrowser.css')).toMatch(/\.skeletonFolder,[\s\S]*?\.skeletonItemShort[\s\S]*?animation:\s*none/)
  })

  it('documents hit-slop for the smallest Orchestrator controls', () => {
    expect(readComponentCss('StagePanel.css')).toContain('.bufferButton::before')
    expect(readComponentCss('CodeEditor.css')).toContain('.resendButton::before')
  })
})
