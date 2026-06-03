---
slice: phase-17-orch-legend-drop-gallery
date: 2026_06_03
status: implemented (behavior slice A+B) — awaiting Steph visual sign-off; docs slice C pending
---

# Preset-state legend + Gallery badge drop (phase-17 behavior)

## What landed (this slice)
The direct follow-up to phase-16 glyph-circle badges:

- **Persistent legend** — `PresetStateLegend` (exported from `PresetTree.tsx`) renders the
  `PRESET_STATE_LEGEND` key as a labeled list (`role='list'`, `aria-label='Preset state key'`),
  one item per entry, reusing the phase-16 glyph-circle vocabulary (`.badgeDot`/`.badgeGlyph` +
  the tone-recipe state classes). In the legend the circle is **decorative** (`aria-hidden`) and the
  readable name is the adjacent label+meaning text — the inverse of the row badge, where the circle
  carries the accessible name. Mounted **unconditionally** at the top of the Presets panel
  (`PresetBrowser`, first child of `.panel`, above the management-toolbar gate) so viewers/guests
  with no toolbar still get the decode key. Non-interactive (no `tabindex`, no `data-tree-focusable`).
- **Gallery badge dropped** — the Gallery entry is removed from `PRESET_STATE_GLYPHS` and
  `PRESET_STATE_LEGEND`, the icon glyph union narrowed to `'VIDEO'` (QR_CODE no longer referenced;
  the `QR_CODE` registration stays in `icons.ts` for any other consumer), and the Gallery
  `renderBadgeDot` call removed from the preset row. **"Gallery" survives in the preset row
  accessible name** via the decoupled `accessibleBadgeLabels` path (`PresetTree.tsx` ~line 323),
  which never depended on the badge render — confirmed by the unchanged aria-label guard.

Files: `orchestratorPresentationModel.ts`, `PresetTree.tsx`, `PresetTree.css`, `PresetBrowser.tsx`,
and the three test files + this doc.

## Tests (TDD: RED → GREEN)
- Model (`orchestratorPresentationModel.test.ts`): Gallery absent from both maps; both length 5.
- `PresetTree.test.tsx`: legend renders as a labeled list of N items; names every label+meaning and
  omits Gallery; one decorative glyph circle per item with the camcorder for Cam and exactly one svg
  (no QR); legend is non-interactive; CSS `.legendMeaning` uses body text, never `--orch-muted`
  (§4.2 contrast lock). Existing Test A row-badge assertion for Gallery deleted (Gallery is no longer
  a row badge; the word still appears via the gallery *folder name*, so the assertion would have
  passed for the wrong reason); the `demo` gallery-row checks flipped to assert **no** Gallery circle
  while the row aria-label preservation guard (`Preset demo, Gallery`) stays green.
- `PresetBrowser.test.tsx`: the `./PresetTree` mock extended with a `PresetStateLegend` stub (without
  it the named import yields `undefined` → React "Element type is invalid" → whole suite breaks); a
  new test proves the legend renders even when the management toolbar is hidden (default viewer harness).

Gate: full `npm test` 1323 pass, typecheck, lint, `orchestratorColorAudit` green.

## Manual visual gate (Steph — visual authority)
- Legend appears at the top of the Presets panel for an operator **and** for a viewer/guest with no
  management toolbar.
- Legend circles match the row badge circles (same size, same per-state hue; camcorder for Cam).
- No Gallery/QR glyph anywhere (legend or rows); gallery rows still announce "Gallery" to a screen reader.
- Legend does not push the tree off-screen / no clipping; on narrow widths it wraps (flex-wrap) and the
  tree absorbs the height. Reduce-motion shows no hover lift anywhere (legend is static regardless).

## Deferred — docs slice C (separate branch)
Bring `docs/architecture/orchestrator-visual-language.md` in lockstep: §4.11 collapsed glyph-circle +
the persistent legend; §4.3 the size-neutral micro-lift; §4.7 register `VIDEO`, retire `QR_CODE` from
the preset-state glyph set; §4.2 glyph-on-tint text uses `--orch-text`. No code/tests.

## Rollback
`git revert <merge-sha>` after merge; pre-merge, drop the branch.
