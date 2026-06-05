---
slice: phase-B-no-hero-entry-guard
date: 2026_06_05
status: implemented — gate green
---

# No-hero entry guard (D1.1) + QR_CODE-not-orphaned correction

Two small items landed as ONE slice (both touch the shared `orchestratorColorAudit.test.ts` /
the conformance docs, per the backlog serialization constraint — one owner edits the audit test):

1. **`no-hero-entry-guard` (D1.1)** — a static regression guard that the Orchestrator entry
   (`OrchestratorView.tsx`) never grows hero/landing/welcome/onboard/splash/dashboard markup. The
   Orchestrator is a workstation entry, not a marketing/landing surface (visual-language §5
   FORBIDDEN_ENTRY_TERMS, principle "Defer to content").
2. **QR_CODE-not-orphaned doc correction** — the planned `drop-orphan-qr-icon` slice was **invalid**
   and is dropped. `QR_CODE` is NOT orphaned.

## What changed
- **`orchestratorColorAudit.test.ts`** — added one test-only `it(...)` that lowercases
  `OrchestratorView.tsx` and asserts a word-boundary scan for `['hero','landing','welcome',
  'onboard','splash','dashboard']` returns `[]`. Word-boundary (`\b<term>`) avoids false positives
  on substrings (e.g. `download`). No production change — `OrchestratorView.tsx` is already clean;
  this guards the existing good state against regression.
- **`docs/analysis/orchestrator_hig_ux_backlog_2026_05_30.md`** — dropped the `drop-orphan-qr-icon`
  slice (struck through with the reason) and corrected the `spec-doc-sync` note: `QR_CODE` is no
  longer an Orchestrator preset badge but is a registered icon **with a live consumer**.
- **`docs/architecture/orchestrator-visual-language.md` §4.7** — corrected the false
  "`QR_CODE` has no live consumer" reasoning. The conclusion (keep it registered) was already
  correct; the *reason* was wrong.

## Why `drop-orphan-qr-icon` was invalid
`QR_CODE` (`src/components/Icon/icons.ts:42`) was the former Gallery-state preset glyph. The Gallery
badge was dropped from the Orchestrator preset row, so it is no longer rendered there. But a grep
across `src/` found exactly one live consumer outside the Orchestrator:

```
src/routes/Account/components/Rooms/EditRoom/QRPrefs/QRPrefs.tsx:34:  <Icon icon='QR_CODE' />
```

The room QR-code prefs surface renders it. Deleting the registration would break that surface.
Lesson: "no Orchestrator badge consumer" ≠ "no consumer" — verify across the whole tree before
treating a registration as dead.

## Tests (TDD)
This is a regression guard over an already-clean state, so it is GREEN on add (the RED state would
only appear if `OrchestratorView.tsx` ever regressed). `orchestratorColorAudit.test.ts`: 29/29 pass
(was 28; +1 no-hero guard).

Gate: full `npm test`, typecheck, lint, slices:check.

## Rollback
`git revert <merge-sha>`.
