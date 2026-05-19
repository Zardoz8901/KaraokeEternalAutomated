#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const VALID_STATUSES = new Set(['planned', 'in_progress', 'merged_to_main', 'blocked'])
const VALID_WORKTREE_STATES = new Set(['present', 'missing', 'not_required'])
const VALID_NEXT = new Set(['implementation', 'review', 'cleanup'])
const REQUIRED_FIELDS = [
  'id',
  'status',
  'owner',
  'branch',
  'base',
  'worktree',
  'merge_order',
  'goal',
  'write_scope',
  'protected_paths',
  'verification',
  'acceptance',
  'non_goals',
  'notes',
  'next',
]

const DEFAULT_FILE = 'docs/plans/active-slices.yaml'

export function validateSlices (slices, context) {
  const errors = []
  const warnings = []
  const ids = new Set()
  const activeBranches = new Map()

  if (!Array.isArray(slices)) {
    return {
      errors: ['active-slices.yaml must contain a YAML list of slice records'],
      warnings,
    }
  }

  slices.forEach((slice, index) => {
    const label = getSliceLabel(slice, index)

    if (!slice || typeof slice !== 'object' || Array.isArray(slice)) {
      errors.push(`slice at index ${index}: record must be a mapping`)
      return
    }

    for (const field of REQUIRED_FIELDS) {
      if (!Object.hasOwn(slice, field)) {
        errors.push(`${label}: missing required field "${field}"`)
      }
    }

    if (typeof slice.id === 'string') {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slice.id)) {
        errors.push(`${label}: id must be kebab-case`)
      }
      if (ids.has(slice.id)) {
        errors.push(`duplicate id "${slice.id}"`)
      }
      ids.add(slice.id)
    } else {
      errors.push(`${label}: id must be a string`)
    }

    if (!VALID_STATUSES.has(slice.status)) {
      errors.push(`${label}: status must be one of ${Array.from(VALID_STATUSES).join(', ')}`)
    }

    validateString(slice.owner, `${label}: owner`, errors)
    validateString(slice.branch, `${label}: branch`, errors)
    validateString(slice.base, `${label}: base`, errors)
    validateString(slice.goal, `${label}: goal`, errors)

    if (!Number.isInteger(slice.merge_order) || slice.merge_order < 0) {
      errors.push(`${label}: merge_order must be a non-negative integer`)
    }

    validateStringArray(slice.write_scope, `${label}: write_scope`, errors)
    validateStringArray(slice.protected_paths, `${label}: protected_paths`, errors)
    validateStringArray(slice.verification, `${label}: verification`, errors)
    validateStringArray(slice.acceptance, `${label}: acceptance`, errors)
    validateStringArray(slice.non_goals, `${label}: non_goals`, errors)
    validateStringArray(slice.notes, `${label}: notes`, errors)
    validateStringArray(slice.next, `${label}: next`, errors)

    if (Array.isArray(slice.next)) {
      for (const next of slice.next) {
        if (!VALID_NEXT.has(next)) {
          errors.push(`${label}: next entry "${next}" must be one of ${Array.from(VALID_NEXT).join(', ')}`)
        }
      }
    }

    if (Array.isArray(slice.write_scope)) {
      for (const entry of slice.write_scope) {
        validateRepoRelativePath(entry, `${label}: write_scope`, errors)
      }
    }

    if (Array.isArray(slice.protected_paths)) {
      for (const entry of slice.protected_paths) {
        validateRepoRelativePath(entry, `${label}: protected_paths`, errors)
      }
    }

    validateWorktree(slice, label, context, errors)
    validateBranchState(slice, label, context, errors, warnings, activeBranches)
  })

  return { errors, warnings }
}

export function readSlicesFile (filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  return YAML.parse(source)
}

export function getGitContext (repoRoot) {
  return {
    branches: listBranches(repoRoot),
    mergedBranches: listMergedBranches(repoRoot),
    repoRoot,
    worktrees: listWorktrees(repoRoot),
  }
}

function validateWorktree (slice, label, context, errors) {
  if (!slice.worktree || typeof slice.worktree !== 'object' || Array.isArray(slice.worktree)) {
    errors.push(`${label}: worktree must be a mapping with path and state`)
    return
  }

  const { path: worktreePath, state } = slice.worktree

  if (!VALID_WORKTREE_STATES.has(state)) {
    errors.push(`${label}: worktree.state must be one of ${Array.from(VALID_WORKTREE_STATES).join(', ')}`)
  }

  if (state === 'not_required') {
    if (worktreePath !== null) {
      errors.push(`${label}: worktree.path must be null when worktree.state is not_required`)
    }
  } else if (typeof worktreePath !== 'string' || worktreePath.trim() === '') {
    errors.push(`${label}: worktree.path must be a non-empty string when worktree.state is ${state}`)
  }

  if (slice.status === 'in_progress' && state !== 'present') {
    errors.push(`${label}: in_progress slices must have worktree.state set to present`)
  }

  if (slice.status === 'merged_to_main' && state !== 'not_required') {
    errors.push(`${label}: merged_to_main slices must have worktree.state set to not_required`)
  }

  if (typeof worktreePath !== 'string' || worktreePath.trim() === '') return

  const expectedPath = normalizeAbsolutePath(worktreePath)
  const matchingPath = context.worktrees.find(worktree => normalizeAbsolutePath(worktree.path) === expectedPath)
  const matchingBranch = context.worktrees.find(worktree => worktree.branch === slice.branch)

  if (state === 'present') {
    if (!matchingPath) {
      errors.push(`${label}: worktree.path "${worktreePath}" is not present in git worktree list`)
    } else if (matchingPath.branch !== slice.branch) {
      errors.push(`${label}: worktree.path "${worktreePath}" is checked out on "${matchingPath.branch}", not "${slice.branch}"`)
    }
  }

  if (state === 'missing') {
    if (matchingPath) {
      errors.push(`${label}: worktree.state is missing but path "${worktreePath}" is present`)
    }
    if (matchingBranch) {
      errors.push(`${label}: worktree.state is missing but branch "${slice.branch}" is checked out at "${matchingBranch.path}"`)
    }
  }
}

function validateBranchState (slice, label, context, errors, warnings, activeBranches) {
  if (typeof slice.branch !== 'string' || typeof slice.base !== 'string') return

  const branchExists = context.branches.has(slice.branch) || context.branches.has(`origin/${slice.branch}`)
  const baseExists = context.branches.has(slice.base) || context.branches.has(`origin/${slice.base}`)
  const branchMerged = context.mergedBranches.has(slice.branch)
  const isActive = slice.status === 'planned' || slice.status === 'in_progress' || slice.status === 'blocked'

  if (!baseExists) {
    errors.push(`${label}: base branch "${slice.base}" does not exist locally or under origin`)
  }

  if (slice.status !== 'planned' && !branchExists) {
    errors.push(`${label}: branch "${slice.branch}" does not exist locally or under origin`)
  }

  if (isActive) {
    if (activeBranches.has(slice.branch)) {
      errors.push(`${label}: active branch "${slice.branch}" is already used by "${activeBranches.get(slice.branch)}"`)
    } else {
      activeBranches.set(slice.branch, slice.id)
    }
  }

  if (slice.status === 'in_progress' && branchMerged) {
    errors.push(`${label}: in_progress branch "${slice.branch}" is already contained in main`)
  }

  if (slice.status === 'merged_to_main') {
    if (!branchMerged) {
      errors.push(`${label}: merged_to_main branch "${slice.branch}" is not contained in main`)
    } else if (branchExists) {
      warnings.push(`${label}: merged_to_main branch "${slice.branch}" still exists and can be cleaned up`)
    }
  }

  if (slice.status === 'in_progress' && (!Array.isArray(slice.verification) || slice.verification.length === 0)) {
    errors.push(`${label}: in_progress slices must list at least one focused verification command`)
  }
}

function validateString (value, label, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${label} must be a non-empty string`)
  }
}

function validateStringArray (value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`)
    return
  }

  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      errors.push(`${label} entries must be non-empty strings`)
      return
    }
  }
}

function validateRepoRelativePath (entry, label, errors) {
  if (typeof entry !== 'string') return
  if (path.isAbsolute(entry)) {
    errors.push(`${label} entry "${entry}" must be repo-relative and stay inside the repo`)
    return
  }

  const normalized = path.posix.normalize(entry.replaceAll('\\', '/'))
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    errors.push(`${label} entry "${entry}" must be repo-relative and stay inside the repo`)
  }
}

function getSliceLabel (slice, index) {
  return slice && typeof slice.id === 'string' ? slice.id : `slice at index ${index}`
}

function listBranches (repoRoot) {
  const output = git(repoRoot, ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin'])
  return new Set(output.split('\n').filter(Boolean).filter(branch => branch !== 'origin/HEAD'))
}

function listMergedBranches (repoRoot) {
  const branches = listBranches(repoRoot)
  const merged = new Set()

  for (const branch of branches) {
    if (branch === 'main' || branch === 'origin/main') continue
    const shortBranch = branch.replace(/^origin\//, '')
    if (shortBranch === 'HEAD' || merged.has(shortBranch)) continue

    try {
      git(repoRoot, ['merge-base', '--is-ancestor', branch, 'main'])
      merged.add(shortBranch)
    } catch {
      // Non-ancestor exits non-zero; that is expected for unmerged branches.
    }
  }

  return merged
}

function listWorktrees (repoRoot) {
  const output = git(repoRoot, ['worktree', 'list', '--porcelain'])
  const worktrees = []
  let current = null

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) worktrees.push(current)
      current = { path: line.slice('worktree '.length), branch: null }
      continue
    }

    if (current && line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '')
    }
  }

  if (current) worktrees.push(current)
  return worktrees.filter(worktree => worktree.branch)
}

function normalizeAbsolutePath (value) {
  return path.resolve(value)
}

function git (repoRoot, args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function main () {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const filePath = path.resolve(repoRoot, process.argv[2] || DEFAULT_FILE)
  const slices = readSlicesFile(filePath)
  const result = validateSlices(slices, getGitContext(repoRoot))

  for (const warning of result.warnings) {
    console.warn(`WARN: ${warning}`)
  }

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`ERROR: ${error}`)
    }
    process.exitCode = 1
    return
  }

  console.log(`active slices ok: ${slices.length} record${slices.length === 1 ? '' : 's'}`)
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  main()
}
