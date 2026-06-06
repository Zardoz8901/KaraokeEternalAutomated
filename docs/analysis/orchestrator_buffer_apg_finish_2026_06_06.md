---
slice: phase-B-buffer-apg-finish
date: 2026_06_06
status: implemented — gate green
---

# Phase B: WAI-ARIA radiogroup keyboard pattern on StagePanel buffer controls

The StagePanel "Preview output buffer" control was already a structural radiogroup
(`role='radiogroup'` + five `role='radio'` buttons with `aria-checked`, StagePanel.tsx:200-213),
but had no keyboard interaction — every radio was a tab stop and arrow keys did nothing. This slice
finishes the WAI-ARIA APG radio-group pattern. No new visual surface.

## What changed (`StagePanel.tsx`)
- **Roving tabindex**: the checked radio is `tabIndex=0`, the other four `tabIndex=-1`, so the group
  is a single tab stop (`buffer` is always one of the five keys, default `auto`, so exactly one is 0).
- **Keyboard navigation** via an `onKeyDown` handler with selection-follows-focus:
  - `ArrowRight` / `ArrowDown` → next radio (wraps last→first)
  - `ArrowLeft` / `ArrowUp` → previous radio (wraps first→last)
  - `Home` → first, `End` → last
  - Each navigation `preventDefault()`s (no page scroll), calls `onBufferChange(target.key)`
    (selection follows focus, per APG), and imperatively moves DOM focus to the target radio via a
    `bufferButtonRefs` array.
- Click behavior and `aria-checked` are unchanged.

The focus cue already existed (`.bufferButton:focus-visible { outline: var(--orch-focus-ring) }`,
StagePanel.css:164) — the backlog's "deferred focus cue" was already shipped, so this slice adds **no
CSS / no visual change** and needs no visual gate.

## Tests (TDD RED → GREEN), `StagePanel.test.tsx`
Three render tests (createRoot + act + native `KeyboardEvent`; container appended to `document.body`
so `document.activeElement` reflects focus):
1. roving tabindex — `buffer='o2'` ⇒ `['-1','-1','-1','0','-1']`.
2. ArrowRight/ArrowDown select+focus next, wrap last→first; asserts `onBufferChange` last-called arg
   and `document.activeElement`.
3. ArrowUp/ArrowLeft (wrap first→last) + Home/End.
All four arrows + Home + End are exercised. 26/26 StagePanel tests pass.

Gate: full `npm test` (1334), typecheck, lint, slices:check.

## Notes
- Standard scope: StagePanel is NOT a High-Risk Touchpoint; no camera-relay / player-routing change.
- Behavior is fully captured by render tests (keydown → `onBufferChange` + focus), so this was led by
  exhaustive TDD rather than an adversarial workflow — the APG radio-group spec is unambiguous.
- `stagePanelUtils.ts` (`BUFFER_OPTIONS` / `detectOutputBuffer` / `buildPreviewCode`) untouched;
  `orchestratorColorAudit.test.ts` untouched.

## Rollback
`git revert <merge-sha>`.
