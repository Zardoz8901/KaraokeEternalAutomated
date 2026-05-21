# Deterministic Hydra Video Binding - 2026-05-21

## Context

Phase 7B added Player MP4 media-clock sync and Orchestrator shadow-video preview, but `HydraVisualizer` could still evaluate `sN.initVideo()` while the Orchestrator shadow video provider was still null. In that timing window, `applyVideoProxyOverride()` fell through to the external/random fallback path and could report fallback/applied truth before the provider-backed eval happened.

## Decision

Add a narrow `initVideo()` runtime barrier:

- `detectCameraUsage()` now distinguishes `initVideo()` from `initImage()` and `initScreen()`.
- Orchestrator waits for a shadow video only when a valid Player MP4 clock exists and the current code uses `s0`-`s3.initVideo()`.
- `applyVideoProxyOverride()` has a required-provider waiting state that soft-clears the source without creating fallback videos or calling `Math.random`.
- `HydraVisualizer` re-evaluates code when the media-binding identity changes: code, provider element, media id, or queue id. Position and `statusAt` are excluded.
- Applied emits are suppressed while required Player media is missing and deduped by run id plus binding identity.

## REDTEAM

- Fallback suppression: required-provider null creates no fallback video, no proxy URL, no random start, no fallback callback, and no video-ready event.
- Borrowed lifecycle: Player/shadow video elements are borrowed; the override never pauses, removes, src-clears, loads, or track-stops them. `HydraPreview` alone removes its owned shadow video from `__hydraVideoMount`.
- Applied truth: a missing required provider cannot emit `PLAYER_EMIT_VISUALIZER_APPLIED`; provider-backed re-eval can report the same run id once the source is truthful.
- Resource cleanup: shadow videos are removed on unmount/media change; override timers are cleared on re-init/restore.
- Overreach guard: audio-only, mouse-only, `initImage()`, and `initScreen()` patches are not blocked by the MP4 shadow-video barrier.

## Tests

- RED verified before implementation with focused failures in `detectCameraUsage`, `videoProxyOverride`, `HydraPreview`, and `HydraVisualizer`.
- GREEN focused command:
  `npm test -- src/lib/detectCameraUsage.test.ts src/lib/videoProxyOverride.test.ts src/routes/Orchestrator/components/HydraPreview.test.tsx src/routes/Player/components/Player/PlayerVisualizer/HydraVisualizer.applied.test.tsx src/routes/Player/components/Player/PlayerVisualizer/HydraVisualizer.camera.test.tsx`

## Manual Smoke

Use the smoke preset in `e2e/fixtures/hydra-video-binding-preset.ts` with local-library Cousteau and Close Encounters MP4 targets.

Expected results:

- All `o0`-`o3` slices sample the same Player media timestamp.
- Orchestrator preview follows Player play/pause/seek within the existing 0.75 second drift threshold.
- No random external start points or `example.invalid` fallback loads are visible.

Manual smoke was not run in this coding pass because the local media/player environment is not available inside the automated test command.

## Rollback

After merge, rollback with `git revert <implementation-sha>`. The high-risk savepoint command was run before implementation; there were no local changes to stash.
