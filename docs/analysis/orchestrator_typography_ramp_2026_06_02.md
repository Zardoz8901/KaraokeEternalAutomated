# Orchestrator Typography Ramp

## Context

The Orchestrator visual language defines one calm typography ramp with a hard
0.75rem floor and a 1.125rem cap reserved for the Stage title. Several Orchestrator
CSS surfaces still used literal sub-floor sizes. This slice adds semantic size aliases
for the ramp and raises sub-floor CSS declarations without changing color, spacing,
motion, layout, React logic, Player, camera relay, or server behavior.

Scope classification: Standard, TDD.

## Decision

Added four size-only aliases in `OrchestratorView.css`:

| Token | Value | Use |
|---|---|---|
| `--orch-text-meta` | `var(--text-xs)` | 0.75rem floor for metadata, badges, empty states, i18n |
| `--orch-text-body` | `var(--text-sm)` | 0.875rem default body, labels, notices |
| `--orch-text-control` | `var(--text-md)` | 1rem controls/search inputs |
| `--orch-text-title` | `var(--text-lg)` | 1.125rem cap; Stage title only |

No line-height or font-weight companion tokens were added. Existing selector-specific
line-height and weight declarations remain in place.

## Applied Raises

StagePanel:

| Selector | Change |
|---|---|
| `.stageTitle` | `var(--text-sm)` -> `var(--orch-text-title)` |
| `.cameraPipelineLabel` | `0.62rem` -> `var(--orch-text-meta)` |
| `.cameraPipelineDetail` | `0.58rem` -> `var(--orch-text-meta)` |

ApiReference two-rung split:

| Selector | Change | Rationale |
|---|---|---|
| `.searchLabel` | `0.68rem` -> `var(--orch-text-body)` | bold label clamp-up |
| `.audioName` | `0.72rem` -> `var(--orch-text-body)` | bold label clamp-up |
| `.functionName` | `0.74rem` -> `var(--orch-text-body)` | heading/name clamp-up |
| `.detailLabel` | `0.65rem` -> `var(--orch-text-body)` | bold label clamp-up |
| `.paramName` | `0.67rem` -> `var(--orch-text-body)` | bold label clamp-up |
| `.audioRange` | `0.67rem` -> `var(--orch-text-meta)` | secondary metadata |
| `.audioDescription` | `0.65rem` -> `var(--orch-text-meta)` | secondary metadata |
| `.functionCategory` | `0.58rem` -> `var(--orch-text-meta)` | secondary metadata |
| `.functionSignature` | `0.62rem` -> `var(--orch-text-meta)` | secondary metadata |
| `.emptyState` | `0.7rem` -> `var(--orch-text-meta)` | secondary metadata |
| `.detailSummary` | `0.71rem` -> `var(--orch-text-meta)` | secondary metadata |
| `.detailText` | `0.69rem` -> `var(--orch-text-meta)` | secondary metadata/body floor |
| `.referenceLink` | `0.63rem` -> `var(--orch-text-meta)` | secondary metadata |
| `.relatedChip` | `0.62rem` -> `var(--orch-text-meta)` | secondary metadata |
| `.paramMeta` | `0.64rem` -> `var(--orch-text-meta)` | secondary metadata |
| `.noParams` | `0.68rem` -> `var(--orch-text-meta)` | secondary metadata |
| `.exampleBlock` | `0.67rem` -> `var(--orch-text-meta)` | monospace code floor |
| `.actionButtonSecondary` | `0.68rem` -> `var(--orch-text-meta)` | secondary action text floor |

PresetPicker:

| Selector | Change |
|---|---|
| `.action` | `11px` -> `var(--orch-text-meta)` |
| `.empty` | `11px` -> `var(--orch-text-meta)` |

## Audit

`orchestratorColorAudit.test.ts` now includes a CSS-only file-wide font-size floor
scan. It catches literal `px`/`rem` and raw `var(--text-*)` declarations below 0.75rem.
Migrated `var(--orch-text-*)` declarations are covered by the token-definition test,
which pins the aliases exactly. The audit intentionally does not parse `.tsx` inline
style objects.

RED result before implementation:

- 22 sub-floor CSS declarations were reported.
- `--orch-text-meta/body/control/title` were undefined.

GREEN result after implementation:

- `collectSubFloorFontSizes()` returns `[]`.
- The token-definition assertions pass.

## Excluded Literals

- `OrchestratorView.css` `.mobileTabIcon` uses `font-size: 1.25rem`. It is an icon
  glyph size under the icon system, not a text-ramp body/title declaration, and is
  above the low-side floor.
- `OrchestratorView.css` root `.container` uses `font-size: 16px`. This is the root
  divisor assumed by the audit when converting px values to rem.
- `CodeEditor.tsx` has inline JS `fontSize: '13px'`, which is above the floor and is a
  deliberate non-target of this CSS-discipline audit.

## Manual Reflow Gate

CI verifies the typography floor and token definitions, but jsdom cannot prove rendered
overflow, clipping, or line wrapping. Manual visual inspection remains required for:

- Stage header title and camera source block.
- ApiReference search, audio cards, function list, detail pane, params, related chips,
  links, example block, and action buttons.
- PresetPicker row actions and empty state.

Result: pending manual review by Steph. If any clipping appears, the remedy should be
width, wrapping, or ellipsis changes, not lowering text below the 0.75rem floor.

## Consequences

- All audited Orchestrator CSS font sizes now meet or exceed the hard floor.
- ApiReference preserves the required two-rung split instead of flattening all copy to
  metadata size.
- The `--text-lg` rung is now consumed through `--orch-text-title` by Stage title only.

## Rollback

After the final local commit lands, rollback with `git revert HEAD` on this branch, or
use the exact commit SHA reported in the implementation summary.
