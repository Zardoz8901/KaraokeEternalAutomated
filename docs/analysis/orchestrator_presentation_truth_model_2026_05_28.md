# Orchestrator Presentation Truth Model - 2026-05-28

## Context

The Preview/Output mental model docs established that Orchestrator Local Preview is approximate local feedback, not Player Output. Before this slice, `HydraPreview` still labeled the surface as `Preview (Live Audio)` or `Preview (Simulated Audio)`, and it created a hidden Player MP4 shadow video whenever a valid MP4 clock existed, even for Hydra code that did not use `initVideo()`.

## Decision

- Add a pure `orchestratorPresentationModel` for Stage/Preview truth with explicit inputs:
  `isHydraActive`, `hasInitVideo`, `hasPlayerMediaClock`, `hasPlayerMediaVideoElement`, `isPlayerPresent`, `hasFftData`, and `hasSimulatedAudioSource`.
- Model only truths this slice can prove: preview, audio, and player-output presence.
- Keep `OrchestratorStatusStrip`, PresetTree Applied-on-Player behavior, Player rendering, server/socket protocol, and shared contracts unchanged.
- Label the preview as `Local Preview` with secondary source/audio copy:
  `Preview using Player MP4`, `Waiting for Player media`, `Preview uses preset video source`, `Player audio reactive`, or `Simulated audio`.
- Avoid successful external-binding claims from `HydraPreview`; it only knows that preset `initVideo()` is configured without a current Player MP4 binding.
- Create the Orchestrator shadow MP4 video only when current Hydra code uses `s0`-`s3.initVideo()` and a valid Player MP4 clock exists.
- Enroll `HydraPreview.css` in the Orchestrator color audit and move the overlay to Solarized tokens.

## Verification

- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorPresentationModel.test.ts src/routes/Orchestrator/components/HydraPreview.test.tsx src/routes/Orchestrator/components/orchestratorStatus.test.ts`
- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`
- PASS: `npm run typecheck`
- PASS: `npm run lint`
- PASS: `npm run slices:check` before final lifecycle marking with only pre-existing merged-branch cleanup warnings.
- PASS: `npm run slices:check` after final lifecycle marking with the expected Phase 8 merged-branch cleanup warning plus pre-existing cleanup warnings.

## Rollback

After merge, rollback with `git revert <phase-8-sha>`.
