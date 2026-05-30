# Control-Plane Cleanup — 2026-05-30

> Gate 1 of the Orchestrator UI/UX roadmap. Slice: `control-plane-merged-branch-cleanup` (merge_order 160).

## Context

After Phases 2–10 merged, the control plane carried a large hygiene backlog:
11 stale worktrees, 18 merged local branches, and 17 `merged_to_main` slice
records — surfacing as ~17 `WARN` lines from `npm run slices:check` (which still
exited 0; warnings are non-fatal). The 11 stale worktrees were the real risk: an
agent could resume work in the wrong tree. This slice clears the backlog to a
clean control plane before the bigger Orchestrator UI push (Gates 2–3).

## Decision

Clean now via **record-pruning** (the user-selected variant), leaving
`refactor/redux-modernization` entirely untouched (its decommission is the
separate `redux-modernization-decommission` slice). Executed directly on `main`
as control-plane bookkeeping (no separate chore branch).

## Actions taken (in order)

1. `git worktree remove` ×11 (all verified clean, no `--force`), then `git worktree prune`.
2. `git branch -d` ×18 merged branches (merge-safe `-d`; it refuses `redux-modernization`, which is 2 ahead / 182 behind main and not an ancestor). The 18 included the recordless `chore-work-control-slices` and the two tracking branches `rollback/2026-02-12` and `style`.
3. Pruned the 17 `merged_to_main` records from `active-slices.yaml`, leaving 4 records: `redux-modernization` (blocked) + the 3 planned slices (this one, `orchestrator-player-live-decision`, `redux-modernization-decommission`).

**Origin branches were intentionally left intact.** `slices:check` computes
`branchExists` as local-OR-origin, but only for records that exist — pruning the
records yields zero WARNs without deleting origin branches. All commits remain on
`origin/main` regardless (every deleted branch was an ancestor of main).

## Before / After

| | Before | After |
|---|---|---|
| Worktrees | 12 (main + 11 stale) | 1 (main) |
| Local branches | 20 (main + redux + 18 merged) | 2 (main + redux) |
| `active-slices.yaml` records | 21 | 4 |
| `slices:check` | exit 0, ~17 WARN | exit 0, **0 WARN** |

## Consequences / Recovery

- Reversible: deleted branches are reflog-recoverable, and all 18 are ancestors
  of `origin/main`, so their commits are preserved.
- Origin still carries the old merged branches; they are invisible to
  `slices:check` (no record) and can be pruned later with `git push origin --delete`
  + `git fetch --prune` if a fully-clean remote is wanted.
- `refactor/redux-modernization` (local + origin + its blocked record) is untouched.

## Rollback

`git revert <this-commit-sha>` restores the pruned records; deleted local
branches can be restored from reflog (`git branch <name> <sha>`).
