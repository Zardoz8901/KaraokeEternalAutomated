import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const viewSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'OrchestratorView.tsx'),
  'utf8',
)

describe('OrchestratorView architecture boundary', () => {
  it('delegates runtime wiring and decision helpers to useOrchestratorWorkspace', () => {
    const forbiddenImports = [
      'store/hooks',
      'store/reducers',
      'shared/actionTypes',
      'routes/Player/modules/playerVisualizer',
      'routes/Player/modules/player',
      'lib/webrtc/useCameraSender',
      'store/modules/rooms',
      './orchestratorViewHelpers',
      './orchestratorShellModel',
      './orchestratorLayout',
      '../components/orchestratorStatus',
      '../components/orchestratorCapabilities',
      '../components/hydraSketchBook',
    ]

    for (const specifier of forbiddenImports) {
      expect(viewSource).not.toContain(`from '${specifier}'`)
      expect(viewSource).not.toContain(`from "${specifier}"`)
    }

    expect(viewSource).toContain('from \'./useOrchestratorWorkspace\'')
  })

  it('keeps OrchestratorView responsible for composing the primary panels', () => {
    for (const component of [
      '<StagePanel',
      '<CodeEditor',
      '<PresetBrowser',
      '<ApiReference',
      '<OrchestratorStatusStrip',
    ]) {
      expect(viewSource).toContain(component)
    }
  })
})
