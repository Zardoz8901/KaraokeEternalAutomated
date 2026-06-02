# Orchestrator Preview Fit Window

## Context

The Orchestrator Local Preview previously used a viewport-derived fixed size from
`getPreviewSize(innerWidth)`. After the host Stage row was expanded, that left a
large centered matte inside `.stageFrame`. This high-risk slice makes the preview
size follow the actual Stage frame size while preserving the existing first-paint
fallback and the camera binding lifecycle.

Scope classification: High-Risk. The production change is Orchestrator-side, but it
exercises the visualizer resize path and adds camera-relay regression coverage.

High-risk savepoint: `git stash push -m "pre-preview-fit-window-savepoint"` created
`stash@{0}` before implementation edits.

## Touchpoint Map

- `useOrchestratorWorkspace.ts` still computes the first-paint fallback size through
  `getPreviewSize(innerWidth)`. This file was not changed.
- `StagePanel.tsx` now observes the existing `.stageFrame` div in place and passes a
  measured, debounced preview size to `HydraPreview`.
- `HydraPreview.tsx` was not changed. Its local camera preview element remains memoized
  on `[allowCamera, localCameraStream]`, not on width or height.
- `HydraVisualizer.tsx` source was not changed. Its resize effect remains
  `hydra.setResolution(width, height)` on width/height changes, without recreating the
  WebGL context.
- Camera sub-chain: `StagePanel localCameraStream` -> `HydraPreview previewVideoElement`
  -> `HydraVisualizer remoteVideoElement`. Width/height updates do not alter the video
  element identity.

## Decision

Use Option A: fill the frame at the frame's own aspect. The new
`fitPreviewToFrame(frameW, frameH, opts)` helper treats measured frame dimensions as
the CSS frame and returns rounded device-buffer dimensions, with DPR clamped to 2.
Collapsed, invalid, negative, or missing input is clamped to positive integer output;
`getPreviewSize` remains unchanged as the SSR/pre-measure fallback.

`StagePanel` uses `use-resize-observer` on the existing `.stageFrame`, coalesces resize
events through `requestAnimationFrame` plus a 120 ms trailing debounce, skips identical
dimension updates, and never keys or conditionally mounts `HydraPreview` based on size.

`.stageFrame` remains a single flex cell. No snapshot cell, Player Output slot, or
Player Live runtime was added.

## REDTEAM

- Auth bypass / admin lockout / data loss: N/A. The slice changes sizing and tests
  only; it does not touch auth, room prefs, server routes, sockets, persistence, or
  destructive actions.
- Camera-drop risk: mitigated by stable `HydraPreview` local camera memo dependencies,
  no width/height key, no size-based `shouldMountHydra` gate, and the
  `HydraVisualizer.camera.test.tsx` regression proving a width/height-only rerender
  calls `setResolution` with new dimensions while keeping camera `init` count,
  `eval`, and `hush` unchanged.
- Zero/NaN injection: mitigated by `fitPreviewToFrame` tests for zero, negative, NaN,
  undefined DPR, and fractional output.
- Resize DoS / GPU churn: mitigated by rAF plus trailing 120 ms debounce, identical-size
  suppression, and DPR cap at 2.
- Reserve geometry breach: mitigated by unchanged spatial test asserting `.stageFrame`
  is flex-only with one preview child, no `.snapshotCell`, and no `Player Output` text.
- Term guard: no preview label/source code changed; `Local Preview` remains the
  primary label and no `Live`, `Player Output`, `Now Playing`, or `On Display` preview
  terms were introduced.
- Open questions: DPR relistening for monitor changes is deferred. The v1 path relies
  on resize events and clamps DPR to 2.
- Vendor noise: hydra-synth logs during initialization/resolution in tests and runtime;
  this slice does not patch vendor code. Debouncing limits resize frequency.

## Validation Matrix

Automated jsdom tests cannot validate real layout, WebGL visual sharpness, iPhone
Safari, or camera hardware behavior. Manual validation remains required before calling
the runtime behavior visually accepted:

| Check | Result |
|---|---|
| iPhone Safari opens `/camera`, starts relay, Player/Orchestrator show live feed | Not run in this environment; requires manual device/browser validation |
| Stop and restart relay without page reload; feed resumes | Not run in this environment; requires manual device/browser validation |
| Relay active, switch non-camera to camera preset; feed binds immediately | Not run in this environment; requires manual device/browser validation |
| Send visualizer while relay active; applies without relay restart | Not run in this environment; requires manual device/browser validation |
| Resize Stage/window; preview fills edge-to-edge, stays crisp, no GPU thrash/frame drops, camera survives | Not run in this environment; requires manual browser/WebGL validation |

## Tests

RED:

- `orchestratorLayout.test.ts` failed because `fitPreviewToFrame` did not exist.
- `StagePanel.test.tsx` failed because no ResizeObserver callback existed and measured
  dimensions did not flow to `HydraPreview`.

GREEN:

- `npm test -- src/routes/Orchestrator/views/orchestratorLayout.test.ts src/routes/Orchestrator/components/StagePanel.test.tsx src/routes/Orchestrator/components/HydraPreview.test.tsx src/routes/Player/components/Player/PlayerVisualizer/HydraVisualizer.camera.test.tsx src/routes/Orchestrator/views/OrchestratorView.spatial.test.tsx`
- `npm run typecheck`

Full-suite and slice-control verification are run before commit.

## Consequences

- The first paint can still show the old fallback size until the frame observer settles.
  This avoids a 0x0 preview and avoids mount gating on measurement.
- The visual fill behavior is now frame-driven rather than viewport-width-driven.
- Real WebGL crispness and resize feel remain manual validation items because jsdom has
  no layout engine or WebGL renderer.

## Rollback

After the final local commit lands, rollback with `git revert HEAD` on this branch, or
use the exact commit SHA reported in the final implementation summary.
