# Orchestrator Operator Feedback + Camera Ownership ADR - 2026-05-31

## Context

The early-HiG red-team kept the dense preset-row shape and Stage-header status strip, but found two D2 closeout debts:

- a non-host Operator could click a preset-row `Send` control and only see `Sending` / `Synced` / `Failed` in the Stage strip, which may be spatially distant or on another mobile tab;
- the Stage strip owned `Camera live` as relay connection truth, while `StagePanel` also rendered `Camera Live` for Hydra camera-source binding.

The status-ownership contract requires each label to have one owning surface. The strip should keep broadcast text, while row-local feedback should acknowledge the specific row action without duplicating those labels.

## Decision

- Expose the existing Orchestrator send status with the preset key used by `handleSendPreset`. This is a read-through of the current send path, not a new send pathway.
- Render row-local send acknowledgement as glyph-only feedback in the fixed-height PresetTree badge lane:
  - `sending` -> rotating glyph using `--orch-warning`;
  - `synced` -> check glyph using `--orch-success`;
  - `error` -> cross glyph using `--orch-danger`.
- Keep `Synced` and `Failed` text owned by the Stage strip. The row glyph has a static accessible label/title and does not create another live region.
- Add a mobile Presets-tab dot for pending/failed preset-row sends, parallel to the existing Code-tab dot.
- Relabel the StagePanel camera-source-binding block as `Source ...`, leaving `Camera live` as the strip's sole camera connection wording.
- Extend `orchestratorStatusOwnership.test.ts` so the camera-source-binding labels are part of the one-owner audit.

## Consequences

- Operator send feedback is now visible at the row that initiated the action without violating one-owner text rules.
- Mobile operators get a Presets-tab-level pending/error cue for preset sends.
- `Camera live` now means relay connection only; `Source Live` / `Source Partial` / `Source Off` describe Hydra source binding.
- The CodeEditor inline `Synced` / `Send failed` pill remains intentional per D6.5: the editor send region owns editor-local acknowledgement, while the Stage strip owns room broadcast state.
- No server, socket, shared action, Player rendering, room policy, preset CRUD, or status-strip logic changed.

## Tests

- RED confirmed the missing row glyphs, missing Presets-tab dot, old `Camera ...` pipeline wording, and missing source-binding ownership helper.
- `npm test -- src/routes/Orchestrator/components/PresetTree.test.tsx src/routes/Orchestrator/views/OrchestratorView.test.tsx src/routes/Orchestrator/components/StagePanel.test.tsx src/routes/Orchestrator/components/orchestratorStatusOwnership.test.ts`
- `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`
- Full closeout gates: `npm run slices:check`, `npm run typecheck`, `npm run lint`.

No screenshot verification was claimed; local Nix Chromium remains blocked, so this slice is verified by render tests, source-level CSS audit, typecheck, and lint.

## Rollback

After merge, revert with:

```sh
git revert <merge-sha>
```
