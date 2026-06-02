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
  const match = new RegExp(`(?:^|\\n)\\s*${escapedSelector}\\s*\\{(?<body>[\\s\\S]*?)\\n\\s*\\}`).exec(source)
  return match?.groups?.body ?? ''
}

function expectToneRecipe (source: string, selector: string): void {
  const block = cssBlock(source, selector)

  expect(block).toMatch(/var\(--orch-tone-(?:fill|emphasis-fill)\)/)
  expect(block).toContain('var(--orch-tone-border)')
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

function collectBareZIndexLiterals (files: string[]): string[] {
  return files.flatMap((file) => {
    const source = readAuditedFile(`src/routes/Orchestrator/${file}`)
    return source
      .split('\n')
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => /z-index:\s*\d/.test(line))
      .filter(({ line }) => !/^\s*--orch-z-[\w-]+:/.test(line))
      .map(({ line, lineNumber }) => `${file}:${lineNumber}: ${line.trim()}`)
  })
}

function expectMotionTokenized (source: string, selector: string, property: 'transition' | 'animation'): void {
  const block = cssBlock(source, selector)
  const declaration = new RegExp(`${property}:\\s*[^;]+;`).exec(block)?.[0] ?? ''

  expect(declaration).toContain('var(--orch-motion-')
  expect(declaration).not.toMatch(/\b0\.(?:05|15|18)s\b/)
}

function collectRawHueRefsInStateClasses (): string[] {
  const selectorsByFile: Array<[string, string[]]> = [
    ['OrchestratorStatusStrip.css', ['.tonePrimary', '.toneLive', '.toneSuccess', '.toneWarning', '.toneDanger']],
    ['PresetTree.css', ['.badgeStart', '.badgeLoaded', '.badgeApplied', '.badgeCam', '.sendAckSending', '.sendAckSynced', '.sendAckError']],
    ['CodeEditor.css', ['.sendStatusOk', '.sendStatusError']],
    ['StagePanel.css', ['.cameraPipelineLive', '.cameraPipelinePartial', '.bufferButtonActive']],
    ['HydraPreview.css', ['.statusWaitingForPlayerMedia', '.statusUsingPlayerMp4', '.statusExternalVideoSource']],
    ['PresetPicker.css', ['.toggle', '.random', '.actionPrimary']],
  ]

  return selectorsByFile.flatMap(([file, selectors]) => {
    const source = readComponentCss(file)
    return selectors.flatMap((selector) => {
      const block = cssBlock(source, selector)
      const matches = block.match(/var\(--orch-(?:cyan|blue|green|yellow|red|violet|magenta)\)/g) ?? []
      return matches.map(match => `${file} ${selector}: ${match}`)
    })
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

  it('defines the semantic role, tone, motion, and z-layer tokens exactly', () => {
    const values = collectOrchestratorViewPropertyValues()

    expect(values.get('--orch-loaded')).toBe('var(--orch-primary)')
    expect(values.get('--orch-selected')).toBe('var(--orch-warning)')
    expect(values.get('--orch-synced')).toBe('var(--orch-live)')
    expect(values.get('--orch-reference')).toBe('var(--orch-muted)')
    expect(values.get('--orch-tone-fill')).toBe('14%')
    expect(values.get('--orch-tone-emphasis-fill')).toBe('22%')
    expect(values.get('--orch-tone-border')).toBe('55%')
    expect(values.get('--orch-motion-fast')).toBe('120ms')
    expect(values.get('--orch-motion-base')).toBe('180ms')
    expect(values.get('--orch-motion-slow')).toBe('250ms')
    expect(values.get('--orch-ease-standard')).toBe('cubic-bezier(0.4, 0, 0.2, 1)')
    expect(values.get('--orch-z-dock')).toBe('10')
    expect(values.get('--orch-z-resize')).toBe('11')
    expect(values.get('--orch-z-picker')).toBe('20')
    expect(values.get('--orch-z-scrim')).toBe('90')
    expect(values.get('--orch-z-sheet')).toBe('95')
    expect(values.get('--orch-z-toolbar')).toBe('100')
    expect(values.get('--orch-z-banner')).toBe('110')
    expect(values.get('--orch-z-modal')).toBe('120')
    expect(values.has('--orch-z-shell')).toBe(false)
  })

  it('keeps state role hues distinct while allowing synced to alias live cyan', () => {
    const values = collectOrchestratorViewPropertyValues()
    const resolved = [
      resolveTokenValue('--orch-applied', values),
      resolveTokenValue('--orch-loaded', values),
      resolveTokenValue('--orch-selected', values),
      resolveTokenValue('--orch-synced', values),
      resolveTokenValue('--orch-success', values),
      resolveTokenValue('--orch-danger', values),
    ]

    expect(new Set(resolved)).toHaveLength(6)
    expect(resolveTokenValue('--orch-synced', values)).toBe(resolveTokenValue('--orch-live', values))
  })

  it('routes status, badge, and preview state classes through the shared tone recipe', () => {
    const statusStrip = readComponentCss('OrchestratorStatusStrip.css')
    const presetTree = readComponentCss('PresetTree.css')
    const codeEditor = readComponentCss('CodeEditor.css')
    const stagePanel = readComponentCss('StagePanel.css')
    const hydraPreview = readComponentCss('HydraPreview.css')

    for (const selector of ['.tonePrimary', '.toneLive', '.toneSuccess', '.toneWarning', '.toneDanger']) {
      expectToneRecipe(statusStrip, selector)
    }
    for (const selector of ['.badgeStart', '.badgeLoaded', '.badgeApplied', '.badgeCam']) {
      expectToneRecipe(presetTree, selector)
    }
    for (const selector of ['.sendStatusOk', '.sendStatusError']) {
      expectToneRecipe(codeEditor, selector)
    }
    for (const selector of ['.cameraPipelineLive', '.cameraPipelinePartial', '.bufferButtonActive']) {
      expectToneRecipe(stagePanel, selector)
    }
    for (const selector of ['.statusWaitingForPlayerMedia', '.statusUsingPlayerMp4', '.statusExternalVideoSource']) {
      expectToneRecipe(hydraPreview, selector)
    }
  })

  it('keeps emphasis fill alarm-only', () => {
    const statusStrip = readComponentCss('OrchestratorStatusStrip.css')
    const presetTree = readComponentCss('PresetTree.css')
    const codeEditor = readComponentCss('CodeEditor.css')

    expect(cssBlock(statusStrip, '.toneDanger')).toContain('var(--orch-tone-emphasis-fill)')
    expect(cssBlock(codeEditor, '.sendStatusError')).toContain('var(--orch-tone-emphasis-fill)')
    expect(cssBlock(presetTree, '.sendAckError')).toContain('var(--orch-tone-emphasis-fill)')
    expect(presetTree).toMatch(/@keyframes sendAckConfirm[\s\S]*?from[\s\S]*?var\(--orch-tone-emphasis-fill\)/)

    for (const block of [
      cssBlock(statusStrip, '.tonePrimary'),
      cssBlock(statusStrip, '.toneLive'),
      cssBlock(statusStrip, '.toneSuccess'),
      cssBlock(statusStrip, '.toneWarning'),
      cssBlock(presetTree, '.badgeApplied'),
      cssBlock(presetTree, '.badgeLoaded'),
      cssBlock(presetTree, '.badgeCam'),
      cssBlock(codeEditor, '.sendStatusOk'),
    ]) {
      expect(block).not.toContain('var(--orch-tone-emphasis-fill)')
    }
  })

  it('uses readable flat text color for violet and red tinted states', () => {
    const presetTree = readComponentCss('PresetTree.css')
    const hydraPreview = readComponentCss('HydraPreview.css')
    const statusStrip = readComponentCss('OrchestratorStatusStrip.css')
    const codeEditor = readComponentCss('CodeEditor.css')

    expect(cssBlock(presetTree, '.badgeApplied')).toContain('color: var(--orch-text)')
    expect(cssBlock(hydraPreview, '.statusExternalVideoSource')).toContain('--orch-preview-color: var(--orch-text)')
    expect(cssBlock(statusStrip, '.toneDanger')).toContain('--orch-status-color: var(--orch-text)')
    expect(cssBlock(codeEditor, '.sendStatusError')).toContain('color: var(--orch-text)')
    expect(cssBlock(presetTree, '.sendAckError')).toContain('color: var(--orch-text)')
    // Full composited color-mix WCAG remains an e2e / OQ-8.1 checklist item.
  })

  it('migrates scoped z-index literals to the z-layer scale', () => {
    expect(collectBareZIndexLiterals([
      'views/OrchestratorView.css',
      'components/HydraPreview.css',
      'components/PresetPicker.css',
    ])).toEqual([])
  })

  it('keeps the z-layer scale ordered from dock to modal', () => {
    const values = collectOrchestratorViewPropertyValues()
    const z = (token: string) => Number(resolveTokenValue(token, values))

    expect(z('--orch-z-dock')).toBeLessThan(z('--orch-z-resize'))
    expect(z('--orch-z-resize')).toBeLessThan(z('--orch-z-picker'))
    expect(z('--orch-z-scrim')).toBeLessThan(z('--orch-z-sheet'))
    expect(z('--orch-z-sheet')).toBeLessThan(z('--orch-z-toolbar'))
    expect(z('--orch-z-toolbar')).toBeLessThan(z('--orch-z-banner'))
    expect(z('--orch-z-banner')).toBeLessThan(z('--orch-z-modal'))
  })

  it('routes key Orchestrator motion through motion tokens', () => {
    const orchestratorView = readOrchestratorViewCss()
    const codeEditor = readComponentCss('CodeEditor.css')

    expectMotionTokenized(orchestratorView, '.tab', 'transition')
    expectMotionTokenized(orchestratorView, '.refPanelOpen', 'animation')
    expectMotionTokenized(codeEditor, '.editButton', 'transition')
  })

  it('keeps the PresetTree send-ack confirmation beat one-shot and non-reflowing', () => {
    const source = readComponentCss('PresetTree.css')
    const synced = cssBlock(source, '.sendAckSynced')

    expect(synced).toMatch(/animation:\s*sendAckConfirm[\s\S]*?var\(--orch-motion-fast\)[\s\S]*?\b1\b/)
    expect(synced).not.toMatch(/font-weight|transform|box-shadow/)
    expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.sendAckSynced[\s\S]*?animation:\s*none/)
  })

  it('keeps raw hue references in state classes under the recorded migration ceiling', () => {
    // D8.5 is warn-then-enforce: remaining PresetPicker and non-state tints are deferred.
    // Routed classes in this slice should trend this count down, not back up.
    expect(collectRawHueRefsInStateClasses().length).toBeLessThanOrEqual(28)
  })

  it('adds a shell-scoped blanket reduced-motion guard', () => {
    const source = readOrchestratorViewCss()

    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
    expect(source).toContain('.container *')
  })
})
