# Orchestrator Role Token Layer ADR

## Context

The Orchestrator visual-language spec calls for semantic role tokens, consistent tone recipes, motion tokens, and explicit z-layer ordering. Before this slice, multiple status, badge, and preview classes still reached directly for raw Solarized hue tokens or bespoke `color-mix()` percentages. That made cyan/green/yellow/violet meaning harder to police and left the audit unable to catch several classes of visual-system drift.

This slice is presentation-only. It deliberately avoids markup, runtime logic, Player rendering, camera relay, Redux, routers, server/shared contracts, `FORBIDDEN_PREVIEW_TERMS`, the Option B Player-output snapshot runtime, and the deferred cameraPipeline text relabel.

## Decision

- Added semantic role tokens in `OrchestratorView.css`:
  - `--orch-loaded: var(--orch-primary)`
  - `--orch-selected: var(--orch-warning)`
  - `--orch-synced: var(--orch-live)`
  - `--orch-reference: var(--orch-muted)`
- Added shared tone recipe tokens:
  - `--orch-tone-fill: 14%`
  - `--orch-tone-emphasis-fill: 22%`
  - `--orch-tone-border: 55%`
- Added motion and ordering tokens:
  - `--orch-motion-fast/base/slow`
  - `--orch-ease-standard`
  - `--orch-z-dock/resize/picker/scrim/sheet/toolbar/banner/modal`
- Routed scoped state, badge, status, camera-pipeline, preview, and send-status CSS through role tokens plus the tone recipe.
- Kept alarm emphasis-fill limited to error/failure surfaces and the one-shot send-ack confirmation keyframe.
- Kept violet/red glyph text on `--orch-text` where the role hue is expressed by border/icon/tint instead of relying on low-contrast colored text.
- Added a one-shot `sendAckConfirm` beat on successful PresetTree row send acknowledgement. It animates only opacity, background luminance, and border color; it does not animate layout-affecting properties.
- Migrated the scoped `z-index` literals in Orchestrator shell, HydraPreview, and PresetPicker to the new z-layer scale.
- Added a shell-scoped reduced-motion blanket guard.
- Extended `orchestratorColorAudit.test.ts` to verify token definitions, distinct role hues, tone recipe routing, alarm-only emphasis fill, flat contrast string guards, z migration/order, motion-token usage, send-ack beat constraints, and reduced-motion coverage.

## Consequences

- The Orchestrator now has a single CSS role layer for these presentation states instead of repeating raw hue choices and one-off mix percentages at each surface.
- The audit catches regressions that would reintroduce undefined role tokens, bare z-index literals in the scoped files, raw hue drift in routed state classes, or layout-affecting send-ack animation.
- The audit remains a source-level guard. It does not compute composited `color-mix()` WCAG contrast; that remains an e2e/OQ-8.1 checklist item.
- `--orch-shadow` remains reserved for existing drag-lift/modal/popover cases. This slice adds no new shadow-based depth.

## Verification

- RED: `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts` failed before the CSS/token implementation on the new token, routing, contrast, z, motion, beat, raw-hue ceiling, and reduced-motion assertions.
- GREEN: `npm test -- src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`
- GREEN: `npm test`
- GREEN: `npm run typecheck`
- GREEN: `npm run slices:check`

Full screenshot/e2e verification was not claimed. Local Nix Chromium remains unsuitable for that path in this environment.

## Rollback

Rollback after the slice lands with:

```sh
git revert <slice-commit-sha>
```
