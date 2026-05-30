# Orchestrator Token Application

Date: 2026-05-30

## Context

Gate 3d applies the Gate 3a-ii spacing/focus contract to Orchestrator CSS and closes the static HiG correctness bugs tracked in `docs/analysis/orchestrator_hig_ux_backlog_2026_05_30.md`:

- #1: `ApiReference.css` referenced undefined `--orch-text-muted` / `--orch-text-soft` tokens.
- #2: `PresetTree.css` suppressed focus rings on the busiest preset surface.
- #3 and #11: reduced-motion handling missed skeleton shimmer, Orchestrator shell animation, and CodeEditor control motion.
- #12: `ApiReference.css` action buttons had hover styles without a keyboard focus ring.
- #13: the smallest desktop/tablet controls needed 44px hit-slop without visual resizing.

This is a CSS/runtime presentation slice only. It does not change labels, state, handlers, route access, status ownership, server/shared contracts, Player rendering, preset CRUD, or Player Output snapshot state.

## Decision

- Added the style-guide `--orch-space-*` scale and `--orch-focus-ring-*` tokens in `OrchestratorView.css`, while keeping `--orch-gap-*` as compatibility aliases.
- Migrated Orchestrator CSS spacing/radius declarations to the token scale. Remaining `999px` radii are true pills, which the style guide explicitly allows.
- Replaced old focus outlines with `--orch-focus-ring` tokens.
- Restored visible PresetTree keyboard focus through inset focus rings so rounded rows/actions do not clip external outlines. Existing hover/selected tint remains only a redundant cue.
- Replaced ApiReference undefined text tokens with `--orch-muted` and `--orch-muted-soft`, and added focus-visible rings to ApiReference action buttons.
- Added reduced-motion coverage for OrchestratorView shell animation, CodeEditor controls, and PresetBrowser skeleton shimmer.
- Added pseudo-element hit-slop to Stage buffer buttons and CodeEditor resend without changing the visible button geometry.
- Extended `orchestratorColorAudit.test.ts` to catch unresolved `var(--orch-*)` references and the specific CSS regressions this slice fixes.

## Consequences

The Orchestrator CSS now has a single spacing/focus vocabulary for the next UX slices. The audit catches the undefined-token class of bug that previously slipped through CI.

The spacing migration is intentionally mechanical. It should not be treated as a visual redesign; larger layout judgment remains with the planned Stage header/layout slice.

Rendered screenshot validation was not run. Local Nix Chromium e2e remains blocked by the downloaded-browser `stub-ld` issue, so verification is CSS source audit + component regression tests + typecheck/lint.

## ARCH

- Files touched:
  - `src/routes/Orchestrator/views/OrchestratorView.css`: token definitions, shell focus/reduced-motion spacing migration.
  - `src/routes/Orchestrator/components/*.css` in the registered write scope: spacing/radius migration, focus-ring normalization, reduced-motion/hit-slop fixes.
  - `src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`: raw color audit plus undefined-token/focus/reduced-motion/hit-slop source checks.
  - `docs/plans/active-slices.yaml`: completed-slice prune.
  - `docs/analysis/current_state_2026_03_05.md`: completed row.
  - `docs/analysis/orchestrator_token_application_2026_05_30.md`: this ADR.
- Dependency chain: Orchestrator token source in `OrchestratorView.css` -> child Orchestrator CSS modules -> `/orchestrator` UI surfaces. No app-state, socket, Player, or server chain changed.
- Invariant overlap: accessibility/input style guidance only.
- Known Issue overlap: none.

## RISKS

- Visual regression from spacing migration: medium / medium / mitigated by mapping existing values to the documented token equivalents rather than redesigning layout.
- Focus-ring clipping on rounded PresetTree rows: medium / medium / mitigated by inset `box-shadow` focus rings for row/action surfaces.
- Hit-slop overlap around compact controls: low / medium / limited to buffer/resend pseudo-elements and did not enlarge the visible control.
- CSS source audit false positives: medium / low / unresolved-token audit ignores `var(..., fallback)` and collects component-local `--orch-*` definitions.
- Screenshot blind spot: medium / medium / documented; final validation uses deterministic CSS audit because local Nix Chromium is blocked.

## PLAN

1. Extend `orchestratorColorAudit.test.ts` RED for unresolved tokens, missing Gate 3d tokens, PresetTree focus suppression, ApiReference action focus, reduced-motion coverage, and hit-slop markers.
2. Add token definitions and migrate CSS spacing/radii/focus to the style-guide scale.
3. Fix ApiReference undefined refs and add action focus-visible rings.
4. Add reduced-motion and hit-slop CSS.
5. Run regression tests and close the slice record.

Rollback: `git revert <merge-sha>`.

## TESTS

- RED result: `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts` failed before implementation on undefined ApiReference tokens, missing Gate 3d tokens, PresetTree focus suppression, missing ApiReference action focus, missing reduced-motion coverage, and missing hit-slop markers.
- PASS: `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`
- PASS: `npm test -- src/routes/Orchestrator/components/HydraPreview.test.tsx src/routes/Orchestrator/components/PresetTree.test.tsx`
- PASS: `npm run slices:check`
- PASS: `npm run typecheck`
- PASS: `npm run lint`

Vitest gap: no screenshot/e2e validation; local Nix Chromium remains blocked, so this slice uses CSS source audit plus component regression tests.

## QUESTIONS

None.
