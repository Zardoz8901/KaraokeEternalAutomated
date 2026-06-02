# Orchestrator Host Row Ratio ADR

## Context

The Orchestrator Visual Language document locks the host workspace to a Stage-first spatial model: Stage on top, Code beneath it, and Stage at least as visually dominant as Code. Before this slice, the base desktop `.container` grid used:

```css
grid-template-rows: minmax(320px, 44dvh) minmax(0, 1fr);
```

That capped Stage at `44dvh` while Code received the `1fr` growth share. `hostSplit` is the default desktop layout and has no modifier class, so host inherited the inverted rows. Operator and browse layouts already span Stage across both rows with `.containerOperatorStageExpanded .stageDock { grid-row: 1 / 3; }`.

The Option B Player-output snapshot remains a target only. This slice does not implement the snapshot runtime or reserve a static second Stage track.

## Decision

- Changed the base Orchestrator desktop rows to:

```css
grid-template-rows: minmax(0, 1fr) clamp(12rem, 30dvh, 22rem);
```

- Added `OrchestratorView.spatial.test.tsx` to lock the CSS value through raw stylesheet reads because CSS-module/jsdom computed style cannot prove grid track sizing here.
- Added a pre-Option-B reserve guard proving the Stage frame still renders a single `HydraPreview` child and that `StagePanel.css` keeps `.stageFrame` as flex with no `grid-template-columns`, `.snapshotCell`, or `Player Output` label.

## Consequences

- Host mode now gives Stage the growth row and bounds Code to a clamp, matching OQ-4.1 option b.
- Operator and browse modes remain compatible because their Stage dock spans both rows.
- Mobile remains governed by the existing single-column media-query rows.
- CI validates the CSS contract and DOM reserve, but it does not prove actual rendered proportions. Local Chromium e2e remains blocked, so Stage>=Code proportion should be manually smoke-checked after merge.

## Verification

- RED: `npm test -- src/routes/Orchestrator/views/OrchestratorView.spatial.test.tsx` failed on the old `minmax(320px, 44dvh) minmax(0, 1fr)` row template. The Stage frame reserve guard was green from the start.
- GREEN: `npm test -- src/routes/Orchestrator/views/OrchestratorView.spatial.test.tsx`
- GREEN: `npm test`
- GREEN: `npm run typecheck`
- GREEN: `npm run lint`
- GREEN: `npm run slices:check`

## Manual Smoke

- On desktop host Orchestrator, verify Stage visually owns the larger top row and Code remains bounded beneath it.
- On operator/browse Orchestrator, verify Stage still fills the right column.
- On mobile, verify the single-column Stage/Code/Presets tab flow is unchanged.

## Rollback

Rollback after landing with:

```sh
git revert <slice-commit-sha>
```
