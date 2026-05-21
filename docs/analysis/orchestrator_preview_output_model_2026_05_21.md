# Orchestrator Preview/Output Model - 2026-05-21

## Context

Phase 7A added Player-applied runtime truth, Phase 7B synced Hydra `initVideo()` sources to Player MP4 media where possible, and Phase 7B.1 made required Player-media binding deterministic. Those slices improved source truth, but the Orchestrator Hydra preview remains a separate local render. It can be fast and useful without being authoritative Player Output.

This docs slice clarifies product language before any heavier Player Live mirroring work. It updates durable architecture docs only.

## Research Basis

Historical Apple Human Interface Guidelines were used as archival guidance, not current platform doctrine:

- 1987 Apple Human Interface Guidelines record: https://openlibrary.org/books/OL7406922M/Apple_Human_Interface_Guidelines?show_page_status=1
- 1992 Macintosh Human Interface Guidelines PDF: https://vintageapple.org/inside_r/pdf/Human_Interface_Guidelines_1992.pdf
- Archived Apple controls guidance: https://leopard-adc.pepas.com/documentation/UserExperience/Conceptual/AppleHIGuidelines/XHIGControls/XHIGControls.html

Practical principles carried into the Orchestrator model:

- make system state visible near the affected object;
- keep the user's mental model concrete;
- make direct actions produce immediate local feedback;
- avoid hidden modes and ambiguous "live" labels;
- keep labels consistent with behavior and proof.

## Decision

- Local Preview is the fast approximate Hydra render in the current browser.
- Preview using Player MP4 is still Local Preview, but it borrows Player media source and clock.
- Preview waiting for Player media means the local render is intentionally held for a required Player MP4 provider.
- Fallback external source means Hydra used external/random video because Player MP4 is unavailable or not required.
- Applied on Player means the Player confirmed eval, first tick, and sanitized source-binding data for an accepted run.
- Player Output is the actual audience display.
- Player Live is reserved for a future mirror, stream, or snapshot of Player Output.

Blunt rule: never label the local Hydra preview as Live, Player Output, Now Playing, or On Display.

## Supersession

`docs/analysis/orchestrator_preset_operator_ux_spec_2026_05_21.md` remains historical analysis. This note supersedes only its statement that "Applied on Player" is future-only. The rest of its Preset operator decisions remain intact unless a later analysis explicitly changes them.

## ARCH

- Files touched:
  - `docs/plans/active-slices.yaml`: registered the docs slice lifecycle.
  - `docs/ARCHITECTURE.md`: linked the durable Preview/Output model.
  - `docs/architecture/orchestrator-preview-output-model.md`: added the durable mental model and allowed labels.
  - `docs/architecture/orchestrator-synthesis-ui-style-guide.md`: linked the model and added HIG-derived preview/output rules.
  - `docs/architecture/orchestrator-preset-operator-ux.md`: reconciled Applied on Player with Phase 7A runtime truth.
  - `docs/analysis/orchestrator_preview_output_model_2026_05_21.md`: recorded this analysis and supersession note.
  - `docs/analysis/current_state_2026_03_05.md`: records completion when the slice lands.
- Dependency chain:
  - Orchestrator product language -> Local Preview labels -> Player-applied/source-binding state -> future Player Live implementation boundary.
- Invariant overlap:
  - Visualizer runtime truth and access consistency are documented only. No runtime enforcement changes.
- Known Issue overlap:
  - No open Known Issue overlap.

## RISKS

- Misleading Live language: medium likelihood / high impact / mitigated by a durable forbidden-label rule.
- Historical-doc confusion: medium likelihood / medium impact / mitigated by superseding only the Applied-is-future-only point.
- Player Live scope creep: medium likelihood / high impact / mitigated by marking mirroring as a future high-risk slice.

Blast radius: documentation and future Orchestrator UI implementation guidance only.

## PLAN

1. Register the slice as planned before worktree creation.
2. Move the slice to in progress after the dedicated worktree exists.
3. Add the durable Preview/Output model.
4. Link the model from the architecture index and Orchestrator style guide.
5. Reconcile the Preset operator spec with Phase 7A Applied on Player truth.
6. Update current state when the docs slice lands.

Rollback after merge: `git revert <orchestrator-preview-output-model-sha>`.

## TESTS

- PASS: `rg -n "orchestrator-preview-output-model" docs/ARCHITECTURE.md docs/architecture`
- PASS: `rg -n --no-ignore "Local Preview|Player Output|Player Live|Applied on Player" docs/architecture docs/analysis`
- PASS: `npm run slices:check` - warnings only for pre-existing stale merged cleanup branches.
- PASS: `npm run typecheck`

Vitest gaps: no Vitest target is required because this is a docs-only slice.

## QUESTIONS

- None. Default locked: reserve Player Live for a future actual Player-output mirror.
