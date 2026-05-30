# Orchestrator UX Spacing And Focus Token Contract

Date: 2026-05-30

## Context

Gate 3a-ii is a docs contract slice for the Orchestrator UI. It follows the Gate 3a-i journey/status-ownership contract and feeds the future Gate 3d token-application slice.

The Orchestrator already has a Solarized token block in `src/routes/Orchestrator/views/OrchestratorView.css`. The inventory found these existing non-color tokens:

- spacing aliases: `--orch-gap-xs: 0.35rem`, `--orch-gap-sm: 0.5rem`, `--orch-gap-md: 0.75rem`;
- radii: `--orch-radius-sm: 6px`, `--orch-radius-md: 8px`, `--orch-radius-lg: 10px`;
- target/focus: `--orch-control-height: 2.25rem`, `--orch-touch-target: 44px`, `--orch-focus: var(--orch-blue)`.

The CSS also contains many raw spacing values across Orchestrator surfaces. The densest clusters are `4px`, `6px`, `8px`, `10px`, `12px`, `0.375rem`, `0.625rem`, and `0.75rem`. `ApiReference.css` has the widest spread of fractional values and radii.

Focus treatment is uneven. Shell tabs, Stage buffer buttons, CodeEditor controls, PresetPicker controls, and many PresetBrowser controls have visible `var(--orch-focus)` treatment. PresetTree folder headers, preset rows, and action buttons currently collapse keyboard focus into hover-style background/border changes with `outline: none`. PresetBrowser search relies on border color rather than the same ring as buttons.

Rendered screenshot validation was not performed in this slice. Local Nix Chromium e2e remains blocked by the downloaded-browser `stub-ld` issue, so this audit is based on CSS source measurement and manual viewport reasoning.

## Decision

The durable style guide now defines:

- a `--orch-space-*` spacing scale from `--orch-space-2xs` through `--orch-space-2xl`;
- compatibility mapping from existing `--orch-gap-xs/sm/md` tokens to the new scale;
- a migration table for raw spacing/radius values found in current Orchestrator CSS;
- a focus-ring token contract using `--orch-focus`, `--orch-focus-ring-width`, `--orch-focus-ring-offset`, `--orch-focus-ring-inset-offset`, and `--orch-focus-ring`;
- required focus coverage for shell nav, Stage controls, PresetTree, PresetBrowser, CodeEditor, API reference, and modal controls;
- a density and hierarchy audit for Stage header, PresetTree rows, PresetBrowser, status pills, buffer controls, PresetPicker, API reference, and the remote-update banner.

This slice deliberately does not apply the tokens to CSS. Gate 3d should make the mechanical CSS changes and then validate rendered desktop/mobile surfaces.

## Consequences

Gate 3d has a concrete migration path instead of another open-ended visual pass. The expected implementation shape is:

- add the spacing/focus-ring token declarations in the Orchestrator token block;
- keep old `--orch-gap-*` names as aliases during migration;
- replace raw spacing/radius values according to the migration table;
- restore visible keyboard focus on PresetTree rows, folder headers, and row/folder action buttons;
- normalize search/input focus so fields and buttons share the same focus vocabulary;
- preserve compact desktop density where the control is not a touch target, while enforcing `--orch-touch-target` on mobile interactive controls.

The main tradeoff is that this is still source-based rather than screenshot-backed. The contract records that limitation instead of claiming visual evidence.

## ARCH

- Files touched:
  - `docs/architecture/orchestrator-synthesis-ui-style-guide.md`: durable spacing scale, focus-ring contract, and density audit.
  - `docs/analysis/orchestrator_ux_spacing_focus_tokens_2026_05_30.md`: this ADR.
  - `docs/analysis/current_state_2026_03_05.md`: completed work tracker row.
  - `docs/plans/active-slices.yaml`: slice lifecycle closeout.
- Dependency chain: docs contract -> future Gate 3d CSS token application -> Orchestrator UI density/focus behavior. No runtime dependency changes.
- Invariant overlap: accessibility/input guidance only. No Safety, Runtime, Security, camera, player, room access, socket, or proxy invariants changed.
- Known Issue overlap: none.

## RISKS

- Source-only audit may miss a real viewport collision: medium / medium / Gate 3d must include rendered desktop/mobile visual QA when the browser harness is available.
- Token scale could be applied too broadly and flatten density: medium / medium / the style guide separates compact desktop controls from mobile touch targets.
- Focus-ring application may add visual noise: low / medium / use `:focus-visible` only, with inset offsets only where outlines would be clipped.
- Runtime drift: low / high / this slice is docs-only and touches no `src/`, server, shared, package, Nix, e2e, or workflow files.

## PLAN

1. Inventory current Orchestrator CSS token names, raw spacing/radius values, target sizes, and focus selectors.
2. Extend the style guide with the spacing scale, focus-ring contract, migration mapping, and density audit.
3. Record this ADR and current-state row.
4. Prune the completed slice record from `active-slices.yaml` for clean closeout.

Rollback: `git revert <merge-sha>`.

## TESTS

- `rg -n "spacing scale|focus-ring" docs/architecture/orchestrator-synthesis-ui-style-guide.md`
- `npm run slices:check`
- `npm run typecheck`
- `npm run lint`

Vitest gap: this is a docs-only slice; there is no runtime unit target.

## QUESTIONS

None.
