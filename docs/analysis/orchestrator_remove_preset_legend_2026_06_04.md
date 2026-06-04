---
slice: refactor/orch-remove-preset-legend
date: 2026_06_04
status: implemented — awaiting Steph visual confirm + merge
supersedes: the legend half of phase-17 (orchestrator_preset_state_legend_2026_06_03.md)
---

# Remove the preset-state legend (redundant with hover tooltips)

## Why
Phase-17 added a persistent `PresetStateLegend` to the Presets panel header. On review the
legend is redundant: each row badge already collapses to a glyph circle that carries its full
word as both the accessible name and a hover `title` (set in `renderBadgeDot`), so the decode
is available on hover/AT without spending panel space on a static key. Steph's call:
"the legend is unnecessary, we have hover tooltips."

## What changed (removal only)
- Deleted `PresetStateLegend` + the `PRESET_STATE_LEGEND_CLASS` map from `PresetTree.tsx`.
- Removed the `<PresetStateLegend />` mount + named import from `PresetBrowser.tsx`.
- Deleted the `.legend*` CSS from `PresetTree.css`.
- Removed the now-dead `PRESET_STATE_LEGEND` constant + `PresetStateLegendEntry` interface from
  `orchestratorPresentationModel.ts` (the legend was their only consumer; verified by grep).
- Removed the legend tests from `PresetTree.test.tsx`, the legend mock stub + unconditional-mount
  test from `PresetBrowser.test.tsx`, and the `PRESET_STATE_LEGEND` assertions from the model test.

## What is intentionally KEPT (from phase-17)
- The **Gallery-badge drop** stays: `PRESET_STATE_GLYPHS` has no Gallery, the row badge is gone,
  and "Gallery" remains in the preset row accessible name via `accessibleBadgeLabels`.
- The row glyph circles + their `title`/`aria-label` decode (the tooltip path) — unchanged and
  still guarded by the existing PresetTree badge tests.

## Verification
Full `npm test`, typecheck, lint, slices:check. The retained badge/tooltip + Gallery-drop tests
stay green; the removed feature's tests are gone with it.

## Manual visual gate (Steph — visual authority)
- No legend row at the top of the Presets panel.
- Row badges still render as glyph circles; hovering a badge shows its word as a tooltip.
- Gallery rows still announce "Gallery" to a screen reader; no Gallery/QR glyph anywhere.

## Rollback
`git revert <merge-sha>`.
