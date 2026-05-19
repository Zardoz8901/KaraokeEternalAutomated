import { describe, expect, it } from 'vitest'
import { validateSlices } from './check-active-slices.mjs'

const baseContext = {
  branches: new Set([
    'main',
    'origin/main',
    'refactor/redux-modernization',
    'origin/refactor/redux-modernization',
    'style',
    'origin/style',
  ]),
  mergedBranches: new Set(['style']),
  repoRoot: '/repo',
  worktrees: [
    { path: '/worktrees/redux-modernization', branch: 'refactor/redux-modernization' },
  ],
}

const validSlice = {
  id: 'redux-modernization',
  status: 'in_progress',
  owner: 'agent',
  branch: 'refactor/redux-modernization',
  base: 'main',
  worktree: {
    path: '/worktrees/redux-modernization',
    state: 'present',
  },
  merge_order: 10,
  goal: 'Modernize Redux-facing orchestrator code.',
  write_scope: [
    'src/routes/Orchestrator/',
    'src/routes/Player/components/Player/PlayerVisualizer/',
  ],
  protected_paths: [
    'server/',
  ],
  verification: [
    'npm test -- src/routes/Orchestrator/components/ApiReference.test.tsx',
    'npm run typecheck',
  ],
  acceptance: [
    'Focused tests pass.',
  ],
  non_goals: [
    'Do not change server socket contracts.',
  ],
  notes: [
    'Touches a high-risk visualizer file.',
  ],
  next: [
    'review',
  ],
}

describe('validateSlices', () => {
  it('accepts a valid in-progress slice with a matching worktree', () => {
    const result = validateSlices([validSlice], baseContext)

    expect(result.errors).toEqual([])
  })

  it('rejects duplicate slice ids', () => {
    const result = validateSlices([validSlice, { ...validSlice }], baseContext)

    expect(result.errors).toContain('duplicate id "redux-modernization"')
  })

  it('rejects invalid statuses', () => {
    const result = validateSlices([{ ...validSlice, status: 'active' }], baseContext)

    expect(result.errors).toContain('redux-modernization: status must be one of planned, in_progress, merged_to_main, blocked')
  })

  it('rejects write scopes outside the repo', () => {
    const result = validateSlices([
      { ...validSlice, write_scope: ['../outside'] },
    ], baseContext)

    expect(result.errors).toContain('redux-modernization: write_scope entry "../outside" must be repo-relative and stay inside the repo')
  })

  it('rejects in-progress branches that are already merged to main', () => {
    const result = validateSlices([
      {
        ...validSlice,
        id: 'style-cleanup',
        branch: 'style',
        worktree: { path: '/worktrees/style', state: 'missing' },
      },
    ], baseContext)

    expect(result.errors).toContain('style-cleanup: in_progress branch "style" is already contained in main')
  })

  it('rejects an in-progress slice without a present matching worktree', () => {
    const result = validateSlices([
      { ...validSlice, worktree: { path: '/worktrees/redux-modernization', state: 'missing' } },
    ], baseContext)

    expect(result.errors).toContain('redux-modernization: in_progress slices must have worktree.state set to present')
  })

  it('warns instead of failing when a merged cleanup branch still exists', () => {
    const result = validateSlices([
      {
        ...validSlice,
        id: 'style-cleanup',
        status: 'merged_to_main',
        branch: 'style',
        worktree: { path: null, state: 'not_required' },
        write_scope: [],
        protected_paths: [],
        merge_order: 900,
        verification: ['git merge-base --is-ancestor style main'],
        acceptance: ['Branch is deleted after cleanup.'],
        non_goals: ['No code changes.'],
        next: ['cleanup'],
      },
    ], baseContext)

    expect(result.errors).toEqual([])
    expect(result.warnings).toContain('style-cleanup: merged_to_main branch "style" still exists and can be cleaned up')
  })

  it('accepts merged cleanup records for remote-only branches', () => {
    const result = validateSlices([
      {
        ...validSlice,
        id: 'remote-cleanup',
        status: 'merged_to_main',
        branch: 'remote-only',
        worktree: { path: null, state: 'not_required' },
        write_scope: [],
        protected_paths: [],
        merge_order: 901,
        verification: ['git merge-base --is-ancestor origin/remote-only main'],
        acceptance: ['Remote branch is deleted after cleanup.'],
        non_goals: ['No code changes.'],
        next: ['cleanup'],
      },
    ], {
      ...baseContext,
      branches: new Set(['main', 'origin/main', 'origin/remote-only']),
      mergedBranches: new Set(['remote-only']),
      worktrees: [],
    })

    expect(result.errors).toEqual([])
    expect(result.warnings).toContain('remote-cleanup: merged_to_main branch "remote-only" still exists and can be cleaned up')
  })
})
