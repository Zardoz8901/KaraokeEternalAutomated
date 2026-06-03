# Orchestrator Camera Binding Relabel

## Context

The Stage camera source-binding chip rendered `Source Live`. That wording leaked the reserved `Live` token into a local/source-binding surface and was not covered by the status-ownership forbidden-term guard. The separate Stage strip `Camera live` pill remains the relay-connection owner and is intentionally preserved.

This is a Standard TDD slice. It does not touch camera relay runtime, WebRTC hooks, server/socket handling, Player rendering, Redux, color tokens, or the camera pipeline level/class mapping.

## Decision

- Replace the camera source-binding labels with source-binding language:
  - `live` -> `Source bound`
  - `partial` -> `Source binding partial`
  - `off` -> `Source: no camera`
- Remove the old `label` field from `CameraPipelineState` so `Live` is no longer a source literal in the binding state.
- Add `role="status"` and `aria-live="polite"` to the Stage camera-binding wrapper.
- Use an accessible name that matches the binding label and appends `Missing: ...` detail for partial binding.
- Extend `orchestratorStatusOwnership.test.ts` so the camera-binding surface participates in the forbidden-term guard and remains lexically separate from the `Camera live` connection surface.

## Consequences

- The Stage binding chip no longer claims `Live`, `Player Output`, `Now Playing`, or `On Display`.
- The strip's `Camera live` connection wording remains the only allowed live carve-out for camera connection state.
- Assistive tech now receives the binding status and partial missing-detail state without adding a second camera-relay runtime path.
- Rollback: `git revert HEAD` for this local slice commit.

## TDD Notes

- RED: extending the ownership guard failed on `Source Live` containing `Live`, and the lexical test failed because `Source bound` was not present.
- GREEN: the formatter now maps the `level` union directly to the three ratified binding strings; StagePanel exposes the binding chip as a polite status region.

## Verification

- `npm test -- src/routes/Orchestrator/components/hydraPreviewUtils.test.ts src/routes/Orchestrator/components/StagePanel.test.tsx src/routes/Orchestrator/components/orchestratorStatusOwnership.test.ts src/routes/Orchestrator/components/orchestratorPresentationModel.test.ts src/routes/Orchestrator/components/orchestratorStatus.test.ts` - passed
- `npm test` - passed, 114 files / 1316 tests
- `npm run typecheck` - passed
- `npm run lint` - passed
- `npm run slices:check` - passed, 1 record
