---
slice: phase-16-orch-badge-glyph-circle
date: 2026_06_03
status: landed (core) — legend + spec amendments deferred
---

# Preset badge → glyph-circle collapse

## What landed (this slice)
Preset row state badges collapse from cramped 0.75rem text capsules to fixed lane-height **glyph circles** (reuse of the `.sendAck` box):
- Each circle carries a **non-color glyph** + the full word as a **visually-hidden in-DOM accessible name** (`role='img'` + `aria-label` + `title`). Glyph set: `A` Applied, `L` Loaded, `S` Selected, `★` Start, **`VIDEO` camcorder** Cam, **`QR_CODE` grid** Gallery. New `VIDEO` (mdiVideo camcorder) icon added to `icons.ts`.
- Hue rides the existing tone-recipe state classes (`--orch-applied/loaded/selected/live`, neutral `--orch-reference` for Gallery). Color is never the sole signal (glyph + name).
- **Elegant hover/focus micro-lift** = `filter: brightness(1.12)` + inward `inset` ring (`currentColor`), transitioned over `--orch-motion-fast`. SIZE-NEUTRAL → cannot clip the fixed lane or reflow rows. Instant under `prefers-reduced-motion`.
- Single-sourced `PRESET_STATE_GLYPHS` + `PRESET_STATE_LEGEND` in `orchestratorPresentationModel.ts`. D3.2 order + row `aria-label` composition preserved (existing textContent/order/aria-label guards stayed green via the hidden label).

Files: `src/components/Icon/icons.ts`, `src/routes/Orchestrator/components/{PresetTree.tsx,PresetTree.css,PresetTree.test.tsx,orchestratorPresentationModel.ts}`.
Verification: PresetTree 23/23; full suite 1315 pass; typecheck; lint; clean.

## Deferred (follow-up: phase-17)
- **Panel-header legend** (the persistent color/glyph key in the Presets panel) — interim decode is the hover `title` + the row `aria-label`.
- **Spec amendments** to `docs/architecture/orchestrator-visual-language.md`: §4.11 collapsed glyph-circle + legend; §4.5 sanctioned size-neutral micro-lift; §4.7 register `VIDEO` + `QR_CODE`; §4.2 `--orch-loaded` glyph-on-tint row + WCAG-1.4.11 3:1 classification. (Doc is currently behind the code.)

## Manual visual gate (Steph — visual authority)
Camcorder reads as "camera" + clean at lane size; `A`/`L`/`S`/★ legible + grayscale-distinct; hover micro-lift elegant (not too subtle/strong); no row reflow on hover; composite contrast on the tinted circles; reduce-motion = no animation.

## Rollback
This slice's badge work: `git revert <badge-commit-sha>`.
