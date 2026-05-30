# Orchestrator Presentation Truth Hardening - 2026-05-30

## Context

Phase 8 introduced the `orchestratorPresentationModel` and wired `HydraPreview` to Local Preview source/audio truth. Phase 9 made the adjacent status vocabulary coherent. Two residue findings remained before the Player Live architecture work:

- The default `local` preview truth mapped by convention to `statusLocal`, but `HydraPreview.css` did not define `.statusLocal`. The most common preview state therefore rendered without an explicit state accent.
- `HydraPreview` treated `Boolean(playerMediaVideoElement)` as enough to show `Preview using Player MP4`. The shadow video exists before any frame decodes, so the copy could overclaim usable Player MP4 binding. `HydraVisualizer` uses the stricter renderability gate `readyState >= 2 && videoWidth > 0 && videoHeight > 0`.

## Decision

- Export `PREVIEW_STATUS_CLASS_KEY` and `getPreviewStatusClassKey()` from `orchestratorPresentationModel.ts`, covering every current `OrchestratorPreviewTruth`: `off`, `local`, `waitingForPlayerMedia`, `usingPlayerMp4`, and `externalVideoSource`.
- Keep `getOrchestratorPresentationModel()` byte-equivalent for identical inputs. The renderability decision stays in `HydraPreview` input derivation; the model still receives a boolean `hasPlayerMediaVideoElement`.
- Add a neutral/muted `.statusLocal` selector to `HydraPreview.css` using only existing `var(--orch-*)` tokens.
- Mirror the full Player visualizer video renderability condition in `HydraPreview`: a Player media video counts as present for presentation truth only when `readyState >= 2`, `videoWidth > 0`, and `videoHeight > 0`.
- Subscribe to shadow-video media readiness events so a decoded frame can update React while Hydra is still unmounted.
- Keep `HydraVisualizer.tsx`, Player rendering, server/socket/shared contracts, status-strip vocabulary, PresetTree behavior, route guards, package, Nix, workflows, and e2e files unchanged.

## Consequences

- The Local Preview overlay now has a defined default-state class instead of relying on the base status style by accident.
- `Preview using Player MP4` appears only after jsdom/browser-visible renderability conditions are met. Before that, `HydraPreview` remains in `Waiting for Player media`.
- Because `presentation.preview !== 'waitingForPlayerMedia'` gates the Hydra mount, the stricter video gate delays Hydra evaluation as well as the label. This is intentional for `initVideo()` patches that require Player media; the shadow video is owned outside Hydra, listens for decode/readiness events, and can wake React while Hydra is unmounted.
- The CSS-module test trap is avoided by reading `HydraPreview.css` as raw text with `fs.readFileSync`; the project vitest setup does not expose reliable CSS-module keys.

## ARCH

- Files touched:
  - `docs/plans/active-slices.yaml`: Phase 10 lifecycle.
  - `docs/analysis/orchestrator_presentation_truth_hardening_2026_05_30.md`: this ADR.
  - `docs/analysis/current_state_2026_03_05.md`: completed-work row.
  - `src/routes/Orchestrator/components/orchestratorPresentationModel.ts`: preview truth-to-class helper.
  - `src/routes/Orchestrator/components/orchestratorPresentationModel.test.ts`: class-key table and raw CSS selector coverage.
  - `src/routes/Orchestrator/components/HydraPreview.tsx`: renderable-video gate and helper-based class lookup.
  - `src/routes/Orchestrator/components/HydraPreview.test.tsx`: decoded-shadow-video mount gate regression coverage.
  - `src/routes/Orchestrator/components/HydraPreview.css`: neutral `.statusLocal`.
- Dependency chain:
  - `HydraPreview` derives Player media clock and shadow video -> presentation model input -> preview label/class -> Hydra mount gate -> `HydraVisualizer` props when mounted.
  - `orchestratorPresentationModel` helper -> `HydraPreview` status class lookup -> `HydraPreview.css` selector.
- Invariant overlap:
  - No safety, access, relay, proxy, socket, or SQL invariant changes.
- Known Issue overlap:
  - No open Known Issue overlap.

## RISKS

- Mount-gate delay: medium likelihood / medium impact / mitigated by a regression test proving the shadow `<video>` exists and can become renderable while Hydra is unmounted, then Hydra mounts with the same borrowed element.
- CSS-module false positive: medium likelihood / low impact / mitigated by raw CSS selector reads rather than asserting against the imported CSS module object.
- Presentation/model drift: low likelihood / medium impact / mitigated by a truth table for all preview states.

Blast radius: Orchestrator `HydraPreview` overlay copy/class and the timing of Hydra mount for `initVideo()` previews when Player MP4 media is expected but not decoded.

## REDTEAM

The main failure mode was a hidden deadlock: if Hydra owned the media element needed to become renderable, gating the Hydra mount on video decode would block forever. In this implementation, `usePlayerMediaShadowVideo()` creates and appends the shadow `<video>` before Hydra mounts, and `HydraPreview` subscribes to readiness events on that borrowed element. The test stubs `readyState`, `videoWidth`, and `videoHeight` on the shadow element while Hydra is unmounted, dispatches `loadeddata`, and verifies Hydra mounts with the same element. That preserves the required wait state without relying on Hydra to create the provider or on an unrelated rerender.

No auth, room access, camera relay, proxy, server, socket, shared contract, or Player rendering paths were edited.

## PLAN

1. Mark Phase 10 in progress and run `npm run slices:check`.
2. RED: add class-key and raw CSS selector tests; add decoded-video mount-gate tests.
3. GREEN: export the class-key helper, add `.statusLocal`, and apply the full video renderability gate in `HydraPreview`.
4. REFACTOR: document this ADR and update current state.

Rollback after merge: `git revert <phase-10-merge-sha>`.

## TESTS

- PASS: RED suite failed before production edits for missing `PREVIEW_STATUS_CLASS_KEY`, missing `.statusLocal`, and Hydra mounting before shadow video decode.
- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorPresentationModel.test.ts src/routes/Orchestrator/components/HydraPreview.test.tsx`
- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`
- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorStatus.test.ts src/routes/Orchestrator/components/PresetTree.test.tsx src/routes/Orchestrator/components/OrchestratorStatusStrip.test.tsx`
- PASS: `npm run slices:check` - warnings only for pre-existing stale merged branches.
- PASS: `npm run typecheck`
- PASS: `npm run lint`

Vitest gaps: none for this slice.

## QUESTIONS

- None. Locked Phase 10 decisions were sufficient.
