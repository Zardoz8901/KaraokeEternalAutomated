# Orchestrator Stage Strip + Preview Status Reconciliation - 2026-05-30

## Context

Gate 3a-i documented the Orchestrator operator/host journey and the cross-surface status-ownership table. The table assigns one owner for each status label: Stage strip pills own authority/broadcast/camera truth, `OrchestratorView` owns the actionable remote-update banner, `HydraPreview` owns Local Preview/source/audio truth, and Preset rows own row badges.

The Player Live decision is accepted as Option B: a future periodic Player Output snapshot. This slice reserves that boundary only; it does not implement snapshot capture, transport, truth states, labels, or UI.

## Decision

- Add `orchestratorStatusOwnership.test.ts` as the executable form of the Gate 3a-i ownership table.
- Source Stage labels from `getOrchestratorStatusModel()` and preview labels from `getOrchestratorPresentationModel()` rather than duplicating runtime logic.
- Treat Preset row badges, panel notices, and the remote banner as documented surface constants because Gate 3b does not own PresetTree/PresetBrowser runtime code.
- Lock the Remote-update split:
  - Stage strip broadcast pill: compact status only, `Remote update`.
  - OrchestratorView banner: action surface, `Remote update available (xN)` with Apply/Dismiss.
- Lock the preview overlay as an open column container that can later host a sibling Player Output snapshot slot, while keeping current `playerOutput` truth states limited to `noPlayer | playerPresentNotMirrored`.

## Consequences

- Audit found no runtime deviation from the Gate 3a-i table. This slice is intentionally test-heavy.
- No Player Output snapshot label, state, capture, transport, authz, or rendering surface was added.
- `Host live coding` and `Camera live` remain legitimate authority/camera truths; forbidden-term checks stay scoped to broadcast, preview, and badge labels.
- A comment in `orchestratorPresentationModel.ts` documents that the `OrchestratorPlayerOutputTruth` union must not grow until the future snapshot runtime slice exists.

## ARCH

- Files touched:
  - `docs/plans/active-slices.yaml`: slice registration and lifecycle.
  - `docs/analysis/orchestrator_stage_strip_reconciliation_2026_05_30.md`: this ADR.
  - `docs/analysis/current_state_2026_03_05.md`: completed-work row.
  - `src/routes/Orchestrator/components/orchestratorStatusOwnership.test.ts`: cross-surface ownership contract.
  - `src/routes/Orchestrator/components/OrchestratorStatusStrip.test.tsx`: action-free pill lock.
  - `src/routes/Orchestrator/components/HydraPreview.test.tsx`: reserved-slot/layout and playerOutput boundary lock.
  - `src/routes/Orchestrator/views/OrchestratorView.test.tsx`: remote banner action ownership lock.
  - `src/routes/Orchestrator/components/orchestratorPresentationModel.ts`: comment documenting the reserved snapshot boundary.
- Dependency chain:
  - `getOrchestratorStatusModel()` -> `OrchestratorStatusStrip` -> Stage header status pills.
  - `getOrchestratorPresentationModel()` -> `HydraPreview` -> preview overlay labels.
  - `useOrchestratorWorkspace()` -> `OrchestratorView` -> remote-update banner and Stage status strip composition.
- Invariant overlap:
  - No Safety, Runtime, Security, auth, relay, proxy, server, socket, shared, Player, route guard, or preset CRUD invariant changes.
- Known Issue overlap:
  - No open Known Issue overlap.

## RISKS

- Test overreach: medium likelihood / medium impact / mitigated by deriving Stage and Preview labels from real producers and keeping Preset/browser constants documented-only for out-of-scope surfaces.
- Remote-update ambiguity: low likelihood / medium impact / mitigated by explicit tests proving the pill is action-free and Apply/Dismiss live only in the banner.
- Premature Player Output implementation: low likelihood / high impact / mitigated by the `playerOutput` union boundary assertion and forbidden preview/output labels.

Blast radius: Orchestrator component tests and one presentation-model comment. Runtime behavior is unchanged.

## PLAN

1. Register Gate 3b in `active-slices.yaml`.
2. Mark the slice in progress in a dedicated worktree.
3. Add ownership, strip, banner, and preview reserved-slot tests.
4. Reconcile minimally only if tests expose a real table deviation.
5. Document this ADR and update current state.

Rollback after merge: `git revert <phase-11-merge-sha>`.

## TESTS

- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorStatusOwnership.test.ts src/routes/Orchestrator/components/orchestratorStatus.test.ts src/routes/Orchestrator/components/orchestratorPresentationModel.test.ts`
- PASS: `npm test -- src/routes/Orchestrator/components/OrchestratorStatusStrip.test.tsx src/routes/Orchestrator/components/HydraPreview.test.tsx src/routes/Orchestrator/views/OrchestratorView.test.tsx`
- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`
- PASS: `npm run slices:check`
- PASS: `npm run typecheck`
- PASS: `npm run lint`

Vitest gaps: none expected; all Gate 3b test files resolve under `npm test`.

## QUESTIONS

- None. The Gate 3a-i table and Option B snapshot decision were sufficient.
