---
slice: phase-B-icon-i18n-stance
date: 2026_06_06
status: implemented — gate green
decision: ADR
---

# i18n stance (§4.10) — English-only, defer extraction

The final Phase B roadmap slice. Doc + a light guard; **no production code change.**

## Context
The §4.10 stance section described text-*length* robustness but never recorded the i18n *posture*
(localize now? defer? English-only?). Ground truth (2026-06-06): the repo ships **no i18n framework**
(no `react-intl` / `i18next` / `intl` dependency anywhere), and the Orchestrator's ~26 `aria-label`s
and all copy are inline English — consistent with the whole app.

## Decision
**English-only, defer extraction** (owner choice 2026-06-06). Do not adopt an i18n framework and do not
extract strings into a message catalog now. Revisit only when localization becomes a real product
requirement; the inline strings are the extraction surface at that point. This is a deliberate *defer*,
not a rejection: the §4.10 text-length robustness rules stay in force so the layout is i18n-ready
(labels can grow ~1.5×, clamp via flexible `max-width` + ellipsis with the full text in `aria-label`/
`title`) and a future localization is not hard-blocked.

## Consequences
- Lowest cost; matches the app-wide posture. No new dependency, no string churn across ~7 files.
- Risk if localization is later required: a one-time extraction pass — bounded because the strings are
  already centralized-by-component and the accessible-name/text-length rules keep the UI translation-safe.

## What changed
- **`orchestrator-visual-language.md` §4.10** — prepended the explicit English-only/defer stance
  (decision + rationale + revisit trigger) above the existing text-length rules; updated the static-check
  line to cite the implementing tests.
- **NEW `orchestratorI18nReadiness.test.ts`** — the previously un-covered half of §4.10's static check:
  `ellipsis-not-fixed-width`. Walks every `text-overflow: ellipsis` rule across the nine Orchestrator
  CSS files and asserts none pins a fixed `width: Npx` (lookbehind excludes the sanctioned
  `max-width`/`min-width` and `width: 100%`/`auto`); plus asserts the cited StatusStrip exemplar keeps a
  rem-based `max-width` + ellipsis. GREEN-on-add (current CSS already conforms — this locks the good
  state). The complementary accessible-name-contains-full-label check is already covered by existing
  PresetTree/StagePanel render tests.
- Backlog: `icon-i18n-stance` marked DONE.

## Tests
`orchestratorI18nReadiness.test.ts` 2/2 (does NOT touch `orchestratorColorAudit.test.ts`).
Gate: full `npm test`, typecheck, lint, slices:check. No production code change, so no RED phase — the
guard is a regression lock over the already-conformant CSS.

## Rollback
`git revert <merge-sha>`.
