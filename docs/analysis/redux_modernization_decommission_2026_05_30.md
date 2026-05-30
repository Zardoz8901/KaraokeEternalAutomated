# ADR: Decommission refactor/redux-modernization — 2026-05-30

> Slice: `redux-modernization-decommission` (merge_order 175). Gate-3-implementation prerequisite.

## Context

`refactor/redux-modernization` (goal: modernize Orchestrator API/editor/reference flows) has been a **blocked** slice that every recent Orchestrator phase had to "serialize ahead of," because its `write_scope` claims the entire Orchestrator code surface (`src/routes/Orchestrator/components/`, `views/`, and `src/routes/Player/components/Player/PlayerVisualizer/`). The Gate 3 UX implementation slices need that exact surface, and `slices:check` does **not** enforce write-scope disjointness, so the collision is process-enforced only — a real, recurring drag.

Branch state (verified 2026-05-30):
- **187 commits behind main, 2 ahead.** Not an ancestor of main.
- Tip = `0478af4780e35faafb8caa6bda466b998970d845` (local == `origin/refactor/redux-modernization`).

## Salvage analysis (its 2 unique commits)

1. **`0478af47` "Revamp Orchestrator API lab and hydrate Hydra metadata docs"** — **already shipped on main** as the identically-titled `087e3e83`. All touched files (`ApiReference.tsx`, `CodeEditor.tsx`, `codeEditorUtils.ts`, `hydraCompletions.ts`, `hydraReference.ts`, …) exist on main, which is 187 commits further evolved. **No unique value.**
2. **`f0614609` "Fix orchestrator send ack for unchanged code"** — added a pure helper `isSendAckSatisfied(lastSentCode, remoteCode)` (Feb 2026). **Superseded on main**: `orchestratorViewHelpers.ts` retains `normalizeCodeForAck`, and main's dedicated `orchestratorSendState.ts` (emerged from the Phase 7A applied-runtime-truth work, May 2026) already normalizes `lastSentCode` and `remoteCode` and compares them — the same unchanged-code ack case, evolved. **No unique value.**

**Conclusion: nothing to salvage.** Both unique commits are duplicated or superseded on main.

## Decision

Retire `refactor/redux-modernization`:
- Removed its record from `docs/plans/active-slices.yaml` (no "decommissioned" status exists in the validator's enum; a blocked record with a deleted branch would error, so the record is removed and the decision recorded here + in `current_state`).
- Deleted the local and origin branches.

## Consequences

- The recurring "serialize ahead of redux-modernization" constraint on Orchestrator slices is **no longer live**. Gate 3 implementation slices (phase-11..15) can claim the Orchestrator write scope cleanly.
- No product code changed.

## Recovery

The branch tip `0478af47` is preserved in this ADR. If ever needed, recover via local reflog (`git branch refactor/redux-modernization 0478af47`) before gc, or from any existing clone. Both unique commits are already represented on main, so recovery should not be necessary.
