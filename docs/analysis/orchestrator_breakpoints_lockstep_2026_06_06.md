---
slice: phase-B-breakpoints-lockstep
date: 2026_06_06
status: implemented — gate green
---

# Phase B: breakpoint lockstep (§4.8)

Keeps the Orchestrator responsive breakpoints in lockstep across CSS `@media` queries and the JS
`innerWidth` comparisons, so the desktop/mobile split can't drift. Conformance + a one-line bug fix.

## What changed
- **Uniform-split fix (the real bug):** `PresetTree.css:426` and `PresetBrowser.css:238` used
  `@media (max-width: 980px)` while the other six panels use `max-width: 979px` and the desktop side
  is `min-width: 980px` (`OrchestratorView.css:502`). At *exactly* 980px viewport width both the
  `max-width:980` mobile rule and the `min-width:980` desktop rule applied → a 1px overlap. Both fixed
  to `max-width: 979px` so every panel switches at the same clean boundary.
- **Documented breakpoint tokens** (`OrchestratorView.css`): `--orch-bp-desktop: 980px`,
  `--orch-bp-narrow: 640px`, `--orch-bp-phone: 390px` — the named source of truth (§4.8 table). CSS
  custom properties **cannot** be used inside `@media` conditions (plain css-loader, no PostCSS), so
  these are documentary; the audit keeps them in sync with the literals.
- **Single-sourced JS split:** `NARROW_BREAKPOINT` (= 980) is now `export`ed from
  `orchestratorLayout.ts` and referenced by `orchestratorWorkspaceModel.ts` (`isMobile`) and the four
  `useOrchestratorWorkspace.ts` `innerWidth < 980` sites. No bare `980` breakpoint literal remains in
  the JS. (`orchestratorWorkspaceModel` already imported from `orchestratorLayout` — no new edge;
  `orchestratorLayout` is a leaf util, so no import cycle.)

## Mechanism choice (§4.8)
§4.8 sanctions either a single-source declaration *or* "a grep audit that the JS 980 and CSS 979/980
stay in lockstep." Since CSS custom properties can't drive `@media`, the implemented mechanism is the
**audit + a single JS constant**: the JS literals collapse to one exported constant, and a test locks
the CSS `@media` set. No build-time/PostCSS pipeline introduced.

## Tests (TDD RED → GREEN), `orchestratorColorAudit.test.ts` — new `describe('Orchestrator breakpoint lockstep')`
- Collects every `@media (max|min)-width: Npx` across the nine audited Orchestrator CSS files. The
  leading `\(` distinguishes a media condition from the `max-width:` CSS *property* (e.g. CodeEditor's
  `999px` element widths are correctly ignored).
- Asserts: the breakpoint set ⊆ {979, 980, 640}; a uniform split (no `max-width: 980`, a `min-width:
  980` exists, `max-width: 979` exists); the `--orch-bp-*` tokens are declared; the JS uses
  `NARROW_BREAKPOINT` and contains no bare `innerWidth < 980`.
- RED before: uniform-split, tokens, and JS-single-source failed. GREEN after. 33/33 in the file.

Gate: full `npm test` (1338), typecheck, lint, slices:check.

## Steph eyeball (optional, low-risk)
The only runtime-observable change is at *exactly* 980px viewport width: PresetTree and PresetBrowser
now adopt the desktop layout at 980px (matching every other panel) instead of the mobile layout. To
check: resize the Orchestrator to exactly 980px and confirm the preset panel matches the rest of the
shell (no longer a 1px-wide mobile/desktop mismatch). Below 980px and above 980px are unchanged.

## Rollback
`git revert <merge-sha>`.
