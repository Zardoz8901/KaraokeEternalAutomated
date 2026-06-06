---
slice: phase-B-empty-error-states
date: 2026_06_06
status: implemented — gate green
---

# Phase B: shared token-driven empty/error/loading treatment

Standardizes the empty/error/loading "treatment" (token-driven sizing + a11y live-region roles)
across the Presets panel (`PresetBrowser`) and `ApiReference`, on the existing `presetEmptyState.ts`
logic. Conformance-only — **no visual change, no behavior change.** Governed by visual-language
§4.6 (empty-state) and §4.9 (error-copy).

## What changed
- **`PresetBrowser.css`** — the grouped `.loading, .error, .empty, .policyNotice` rule routes its
  `font-size` from the raw ramp rung `var(--text-xs)` onto the semantic token `var(--orch-text-meta)`
  (§4.6 mandate; `ApiReference.css` already did this). **Visual no-op:** `--orch-text-meta` is
  defined as `var(--text-xs)` (`OrchestratorView.css`), so this is a token-discipline change, not a
  sizing change. The sibling `.toolbarHint` / `.searchClear` legitimately keep `--text-xs` (out of
  scope) — the audit assertion is scoped to the grouped block only.
- **`PresetBrowser.tsx`** — a11y live-region roles on the panel notices: error → `role='alert'`
  (assertive); empty + policyNotice → `role='status' aria-live='polite'`. The loading region already
  carried `role='status' aria-live='polite'` and is unchanged. The two in-modal `.empty` divs
  ("Create a folder first.", "No other folders available.") share the class but are outside the §4.6
  panel render block, so they get the font-size no-op only and **no role** (correct — they are form
  hints inside dialogs, not panel-owned status).
- **`ApiReference.tsx`** — the search-empty notice (`No functions match this search.`) →
  `role='status' aria-live='polite'`, matching the PresetBrowser idiom (resolves the cross-panel
  explicit/implicit `aria-live` inconsistency).

Why live regions: the empty notice is not static — when a user types a query and results vanish,
`filteredTree.length` (PresetBrowser) / `filtered.length` (ApiReference) flips to 0 and the notice
replaces the tree/list on keystroke. That is a genuine live content change, so a polite announcement
of the sourced message is the right behavior (§4.6 "status line"; §4.9 "never a silent no-op").

## Tests (TDD RED → GREEN)
- **NEW `orchestratorEmptyStateTreatment.test.ts`** (pure fs-read; deliberately does NOT touch
  `orchestratorColorAudit.test.ts`, so this slice stays parallelizable with `breakpoints-lockstep`).
  Grades: grouped-block font routes through `--orch-text-meta` and NOT `--text-xs`; `.error` stays
  `--orch-danger`; ApiReference `.emptyState` stays `--orch-text-meta`; per-div role attributes
  (error=alert; empty/policyNotice/emptyState = status+polite); exactly three `role='status'` /
  `aria-live='polite'` in PresetBrowser.tsx (loading+empty+policy — guards "loading unchanged"); the
  empty notice still renders the sourced `presetPanelState?.message ?? ROOM_EMPTY_PRESET_PANEL_MESSAGE`
  expression (no inline literal). 8/8.
- **`ApiReference.test.tsx`** — added one render-level proof: drive the search to a non-matching
  query, assert `[role="status"]` exists, `aria-live='polite'`, text === `No functions match this
  search.` 7/7.
- Copy-string correctness stays owned by `presetEmptyState.test.ts` (5 tests); the new file asserts
  only the container treatment, never the literal strings (avoids coupling to copy edits).

Gate: full `npm test` (1331), typecheck, lint, slices:check.

## Adversarial verification (workflow `wf_b5ed866f-876`)
A 4-lens verification ran before implementation (completeness / spec-lock / a11y-correctness /
test-regression). Three lenses approved the production plan; the **test-regression lens caught two
blocking flaws in the original test design** and they were fixed before any code:
1. A file-wide `not.toContain('font-size: var(--text-xs)')` would FALSE-FAIL — `--text-xs` legitimately
   stays at `.toolbarHint`/`.searchClear`. → scoped the negative assertion to the grouped rule body.
2. A bare `toContain("role='status'")` is TAUTOLOGICAL — the loading div already has it. → switched to
   per-div, attribute-order- and quote-tolerant regex plus a count-of-three guard.
The a11y lens confirmed `role='alert'` (error) and `role='status' aria-live='polite'` (empties) are
semantically correct with no nested-live-region or announcement-storm hazard.

## Known residual / accepted divergences (recorded, not closed by this slice)
- **§4.9 inline error-copy fallbacks (residual gap).** The eleven `toErrorMessage(err, 'Failed to …')`
  fallbacks in `PresetBrowser.tsx` (`:135,297,337,377,411,450,486,504,525,546,568`) are inline,
  sentence-case and conformant in *voice*, but NOT sourced from a copy module / unit-assertable, which
  §4.9 ("strings live in presetEmptyState.ts / presetOperatorUx.ts") asks for. **Out of scope for a
  treatment slice; flagged as a follow-up** so §4.9 is not read as fully satisfied. See backlog.
- **ApiReference empty box visual divergence (accepted).** `.emptyState` is a dashed-border box with
  `--orch-muted-soft` + `--orch-space-xl`; PresetBrowser `.empty` is borderless `--orch-muted`.
  ApiReference is a docs/reference panel, outside §4.6's Presets-panel jurisdiction — divergence
  accepted, only the role was added.
- **§4.9 disabled-control reason exposure** (title + aria on disabled Send) is out of scope here and
  partially covered by `PresetBrowser.test.tsx:339-341`; deliberately deferred.
- **Two simultaneous polite regions** (policyNotice + empty can co-render for a sends-blocked user with
  an empty tree) is intentional and benign; the strings differ.

## Test-harness note
Standalone `vitest` cannot resolve PresetBrowser's path aliases (`components/Modal/Modal`) — the
documented alias gap (CLAUDE.md). The new `orchestratorEmptyStateTreatment.test.ts` is pure fs-read so
it runs under both, but the render tests require `npm test` (project config).

## Rollback
`git revert <merge-sha>`.
