# Orchestrator Status Truth Vocabulary - 2026-05-29

## Context

Phase 8 introduced `orchestratorPresentationModel.ts` as the Stage/Preview presentation-truth helper and wired it into `HydraPreview`. Two remaining Orchestrator status surfaces still carried vocabulary outside that shared model:

- `orchestratorStatus.ts` used `Preview ready` with `tone: 'live'` for the idle broadcast slot.
- `PresetTree.tsx` rendered a free `Applied on Player` badge literal.

This slice unifies those terms without changing server/socket contracts, Player rendering, PresetTree behavior, OrchestratorStatusStrip component behavior, camera relay vocabulary, or authority vocabulary.

## Decision

- `orchestratorPresentationModel.ts` exports canonical label constants for `Local Preview`, `Applied on Player`, and `Broadcast ready`.
- The broadcast idle state now uses `Broadcast ready` with neutral tone. `Preview` remains reserved for the local preview surface, and cyan/live tone remains reserved for real live/connection signals such as camera.
- `PresetTree` imports `APPLIED_ON_PLAYER_LABEL` for the applied badge. The `isApplied` logic is unchanged.
- Forbidden-term checks are intentionally case-sensitive and target the exact capitalized token `Live`, plus `Player Output`, `Now Playing`, and `On Display`.
- The legitimate lowercase connection/role truths `Camera live` and `Host live coding` remain unchanged and are outside this slice.
- Sibling PresetTree badge literals (`Selected`, `Loaded in preview`, `Start`, `Cam`) are intentionally deferred. Only `Applied on Player` is promoted because the architecture docs assign that cross-surface term to preset rows.

## Consequences

- The Orchestrator status strip no longer calls an idle broadcast state a preview state.
- The idle broadcast slot no longer uses the cyan live tone.
- The cross-surface `Applied on Player` term now has a single exported source.
- This is still a partial vocabulary migration. Later slices may promote additional PresetTree badge labels or broaden the presentation model, but this slice deliberately avoids a status-strip rewrite.

## ARCH

- Files touched:
  - `docs/plans/active-slices.yaml`: slice lifecycle.
  - `docs/analysis/orchestrator_status_truth_vocabulary_2026_05_29.md`: this ADR and verification record.
  - `docs/analysis/current_state_2026_03_05.md`: completed-work row.
  - `src/routes/Orchestrator/components/orchestratorPresentationModel.ts`: shared label constants.
  - `src/routes/Orchestrator/components/orchestratorPresentationModel.test.ts`: constants and forbidden-term coverage.
  - `src/routes/Orchestrator/components/orchestratorStatus.ts`: broadcast idle label/tone.
  - `src/routes/Orchestrator/components/orchestratorStatus.test.ts`: broadcast label/tone assertions.
  - `src/routes/Orchestrator/components/PresetTree.tsx`: applied badge constant.
  - `src/routes/Orchestrator/components/PresetTree.test.tsx`: applied badge constant assertion.
  - `src/routes/Orchestrator/components/OrchestratorStatusStrip.test.tsx`: camera live tone guard.
- Dependency chain:
  - Presentation model constants -> `orchestratorStatus.ts` broadcast status -> `OrchestratorStatusStrip`.
  - Presentation model constants -> `PresetTree.tsx` applied badge -> Orchestrator Presets surface.
- Invariant overlap:
  - No safety, runtime relay, or security invariant changes.
- Known Issue overlap:
  - No open Known Issue overlap.

## RISKS

- Label drift: medium likelihood / medium impact / mitigated by exported constants and tests.
- Overbroad Live guard: medium likelihood / medium impact / mitigated by case-sensitive checks scoped to owned labels and explicit carve-outs for `Camera live` and `Host live coding`.
- Accidental tone bleed from broadcast to camera: low likelihood / medium impact / mitigated by `OrchestratorStatusStrip` test coverage for camera `toneLive`.

Blast radius: `/orchestrator` status-strip idle broadcast label/tone and PresetTree applied badge copy only.

## PLAN

1. Mark the slice in progress.
2. RED: add failing tests for shared constants, broadcast idle copy/tone, Applied-on-Player constant use, and camera live tone preservation.
3. GREEN: export constants and replace the two runtime literals/tone.
4. REFACTOR: record this ADR, current-state row, and final verification.

Rollback after merge: `git revert <phase-9-merge-or-feature-sha>`.

## TESTS

- PASS: RED suite failed before production edits for missing constants, old broadcast copy/tone, and non-constant applied badge expectations.
- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorPresentationModel.test.ts src/routes/Orchestrator/components/orchestratorStatus.test.ts src/routes/Orchestrator/components/PresetTree.test.tsx src/routes/Orchestrator/components/OrchestratorStatusStrip.test.tsx`
- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`
- PASS: `npm run slices:check` - warnings only for pre-existing stale merged cleanup branches.
- PASS: `npm run typecheck`
- PASS: `npm run lint`

Vitest gaps: none expected; all targeted component/model tests run under `npm test`.

## QUESTIONS

- None. Locked decisions were sufficient.
