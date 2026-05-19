# Work-Control Plans

`docs/plans/active-slices.yaml` is the canonical coordination spec for active, blocked, planned, and cleanup-ready repo slices.

It answers:

- Which work exists?
- Which branch and worktree own it?
- Which paths are in scope?
- Which paths must stay untouched?
- What can merge first?
- Which commands prove the slice is ready?

Behavior specs still live in dated docs, usually under `docs/analysis/`. Tests are the executable behavior contract. This file is only the coordination layer.

## Schema

`active-slices.yaml` is a YAML list. Every record must use this shape:

```yaml
- id: kebab-case-slice-id
  status: planned | in_progress | merged_to_main | blocked
  owner: person-or-agent-name-or-unassigned
  branch: proposed-or-existing-branch-name
  base: main
  worktree:
    path: /absolute/path/to/worktree-or-null
    state: present | missing | not_required
  merge_order: 10
  goal: one sentence
  write_scope:
    - path/or/module
  protected_paths:
    - paths that must not be changed
  verification:
    - focused test command
    - lint/typecheck command
    - full test command
  acceptance:
    - observable criterion
  non_goals:
    - adjacent work excluded from this slice
  notes:
    - important assumption or constraint
  next:
    - implementation | review | cleanup
```

## Worktree States

- `present`: `worktree.path` must appear in `git worktree list --porcelain` and must be checked out on the slice branch.
- `missing`: `worktree.path` is the expected future worktree path, but it must not currently exist in `git worktree list --porcelain`.
- `not_required`: `worktree.path` must be `null`; use this for cleanup records that are already merged to main.

`in_progress` slices must use `worktree.state: present`. If a branch exists without a dedicated worktree, mark it `blocked` until the worktree exists.

## Verification

Run:

```sh
npm run slices:check
```

The checker validates schema, branch existence, merged branch state, path safety, and worktree state. Cleanup branches that are already merged but still exist produce warnings instead of failures.
