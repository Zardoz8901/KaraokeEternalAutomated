---
slice: fix/orch-preview-video-crop
date: 2026_06_04
status: implemented — awaiting Steph visual confirm on BOTH surfaces + merge
risk: high (HydraVisualizer is shared by Player + Orchestrator preview)
---

# Fix: Orchestrator preview cropped to a corner / not scaling (DPR mismatch)

## Symptom
The preview video (camera / shadow MP4 / any source) renders into a corner of the simulated
preview and does not scale with the frame. Shows up when `devicePixelRatio != 1` (HiDPI display
or browser zoom, which changes DPR).

## Root cause
Introduced by phase-14 fit-window. `fitPreviewToFrame` returns the **DPR-scaled** size
(`cssW * dpr`, `orchestratorLayout.ts`). That value is passed as `width`/`height` to
`HydraVisualizer`, which used it for the **container's inline CSS box**:
`containerStyle = { width, height }` (`HydraVisualizer.tsx`). The container is
`position:absolute; top:0; left:0` and the stylesheet says `width:100%; height:100%`, but the
inline pixels override the stylesheet, so at DPR 2 a 400×300 frame got an 800×600 absolute box
pinned top-left inside an `overflow:hidden` preview container → **only the top-left quadrant is
visible = cropped to a corner**, constant across resizes. The sibling HydraPreview container
took the same value but is a flex child capped by `max-width:100%`, so only the absolutely
positioned visualizer container escaped the clamp. At DPR 1 the numbers coincided (why it looked
fine before).

## Fix
- `HydraVisualizer` container: stop pinning the inline pixel box. `containerStyle = {}` (+ zIndex);
  the container fills its positioned parent via the existing `.container { width/height:100% }`.
- Keep `width`/`height` on the **canvas backing-store attributes** + `setResolution` — that is
  where DPR scaling belongs (crisp output, output-resolution parity).
- Error-boundary fallback also switched from `props.width/height` to `100%` (same bug class, was
  only visible during a transient Hydra error).

## Why it is safe for the Player (high-risk shared component)
The Player passes **CSS-pixel** dims (`PlayerView.tsx`: `innerWidth` / `viewportHeight` from
`state.ui`), never DPR-scaled, and `PlayerVisualizer .container` is sized to those CSS px. After
the fix, `HydraVisualizer`'s container fills that CSS-pixel parent = **identical computed size**
to before → no visible change on the Player. Orchestrator: container fills the frame → no crop,
scales on resize, backing store stays DPR-crisp.

## Tests
`HydraVisualizer.layout.test.tsx` (new, TDD RED→GREEN): canvas keeps `width`/`height` backing-store
attributes; the container carries no inline pixel width/height (fills via CSS). Camera + applied
suites unaffected. jsdom has no layout engine, so this is a structural guard, not a pixel check —
the visual outcome is Steph's gate.

## Manual visual gate (Steph — visual authority) — confirm BOTH surfaces
- Orchestrator preview: camera + osc fill the frame (no corner crop), crisp, and scale when the
  Stage/Code split or window is resized — at DPR 1 and with browser zoom (DPR != 1).
- Player: visualizer still fills the screen; camera/visual unchanged.

## Rollback
`git revert <merge-sha>` (single-component change).
