# Orchestrator Preset Row + Notice Alignment - 2026-05-30

## Context

Gate 3b locked the cross-surface status ownership table for Stage strip and Preview surfaces, but its ownership test still used hardcoded placeholder sets for three Gate 3c surfaces:

- PresetTree row badges (`Selected`, `Loaded in preview`, `Start`, `Cam`, `Gallery`)
- OrchestratorView remote-update banner base copy (`Remote update available`)
- PresetBrowser panel notices / empty states

That meant PresetTree, PresetBrowser, or banner copy could drift without the ownership test catching it.

## Decision

- Promote PresetTree row badge text to shared constants in `orchestratorPresentationModel.ts`, beside `APPLIED_ON_PLAYER_LABEL`.
- Add `REMOTE_UPDATE_BANNER_LABEL` to the same vocabulary module and use it from `OrchestratorView`.
- Keep PresetBrowser notice ownership in the existing producers:
  - `getPresetPanelNotice()` in `presetOperatorUx.ts`
  - `getPresetPanelState()` in `presetEmptyState.ts`
- Export `ROOM_EMPTY_PRESET_PANEL_MESSAGE` from `presetEmptyState.ts` and use it for the PresetBrowser fallback so the empty-room copy is not duplicated inline.
- Convert `orchestratorStatusOwnership.test.ts` to derive PresetTree badge labels from constants, remote banner copy from `REMOTE_UPDATE_BANNER_LABEL`, and PresetBrowser notice copy by calling the real notice/empty-state producers.

## Consequences

- No runtime logic changed. PresetTree gates, PresetBrowser state selection, and remote-banner behavior are unchanged.
- The ownership test now catches drift in the PresetTree/banner/notice surfaces instead of relying on local hardcoded strings.
- The PresetTree badge constants live in the existing Orchestrator vocabulary home, but Gate 3d spacing/focus work and Player Output snapshot work remain out of scope.

## ARCH

- Files touched:
  - `docs/plans/active-slices.yaml`: slice registration/lifecycle and closeout cleanup.
  - `docs/analysis/orchestrator_preset_row_notice_alignment_2026_05_30.md`: this ADR.
  - `docs/analysis/current_state_2026_03_05.md`: completed-work row.
  - `src/routes/Orchestrator/components/orchestratorPresentationModel.ts`: badge and banner label constants.
  - `src/routes/Orchestrator/components/orchestratorPresentationModel.test.ts`: exported vocabulary assertions.
  - `src/routes/Orchestrator/components/orchestratorStatusOwnership.test.ts`: derived ownership sets.
  - `src/routes/Orchestrator/components/PresetTree.tsx`: badge literals sourced from constants.
  - `src/routes/Orchestrator/components/PresetTree.test.tsx`: row-badge constant assertions.
  - `src/routes/Orchestrator/components/PresetBrowser.tsx`: empty fallback sourced from `presetEmptyState`.
  - `src/routes/Orchestrator/components/PresetBrowser.test.tsx`: notice producer assertions and no inline fallback duplication.
  - `src/routes/Orchestrator/components/presetEmptyState.ts`: empty-room message constant.
  - `src/routes/Orchestrator/components/presetEmptyState.test.ts`: constant assertion.
  - `src/routes/Orchestrator/views/OrchestratorView.tsx`: banner base string sourced from constant.
  - `src/routes/Orchestrator/views/OrchestratorView.test.tsx`: banner constant assertion.
- Dependency chain:
  - PresetTree -> vocabulary constants -> ownership test.
  - PresetBrowser -> `getPresetPanelNotice()` / `getPresetPanelState()` -> ownership test.
  - OrchestratorView -> `REMOTE_UPDATE_BANNER_LABEL` -> ownership test.
- Invariant overlap:
  - No Safety, Runtime, Security, auth, relay, proxy, server, socket, shared, Player, package, Nix, workflow, or e2e changes.
- Known Issue overlap:
  - No open Known Issue overlap.

## RISKS

- Copy drift remains possible in out-of-scope surfaces: low likelihood / medium impact / mitigated by deriving Gate 3c surfaces from real producers/constants.
- Behavior accidentally changes while moving literals: low likelihood / medium impact / mitigated by focused component/helper tests and no conditional logic changes.
- Ownership test becomes hollow: medium likelihood / medium impact / mitigated by the mutation proof below.

Blast radius: Orchestrator PresetTree row text, PresetBrowser notice text sourcing, OrchestratorView remote-banner base string, and tests. Rendered strings remain the same.

## PLAN

1. Register Gate 3c and mark the dedicated worktree in progress.
2. RED: add tests expecting badge/banner/empty-state constants and derived ownership sets.
3. GREEN: add constants and swap literals without changing logic.
4. Prove ownership derivation with a mutation check.
5. Document this ADR, update current state, merge, then prune completed Gate 3b/Gate 3c records and merged branches for a zero-warning slice plane.

Rollback after merge: `git revert <phase-12-merge-sha>`.

## TESTS

- PASS: RED suite failed before production edits because badge/banner/empty-state constants were undefined and PresetBrowser still carried the inline empty-state fallback.
- PASS mutation proof: changed `START_BADGE_LABEL` to `Synced`, ran `npm test -- src/routes/Orchestrator/components/orchestratorStatusOwnership.test.ts`, and the test failed with `Synced` owned by both `stageBroadcast` and `presetRowBadges`; reverted the mutation and reran the test green.
- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorStatusOwnership.test.ts src/routes/Orchestrator/components/PresetTree.test.tsx src/routes/Orchestrator/components/PresetBrowser.test.tsx src/routes/Orchestrator/components/presetOperatorUx.test.ts src/routes/Orchestrator/components/presetEmptyState.test.ts src/routes/Orchestrator/views/OrchestratorView.test.tsx`
- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`
- PASS: `npm run slices:check` - only the pre-existing Gate 3b cleanup warning remained before final closeout.
- PASS: `npm run typecheck`
- PASS: `npm run lint`

Vitest gaps: none expected; all Gate 3c test files resolve under `npm test`.

## QUESTIONS

- None.
