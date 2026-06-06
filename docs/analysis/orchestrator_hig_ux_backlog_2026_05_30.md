# Orchestrator HiG-grounded UI/UX backlog — 2026-05-30

> Investigation output. Improvement opportunities for the Orchestrator UI/UX grounded in Apple HiG +
> our style guides/references, audited against current source and adversarially verified.
> Companion to [Synthesis UI Style Guide](../architecture/orchestrator-synthesis-ui-style-guide.md),
> [Operator Journey + Status-Ownership](../architecture/orchestrator-operator-journey.md),
> [Preview/Output Model](../architecture/orchestrator-preview-output-model.md),
> [Preset Operator UX](../architecture/orchestrator-preset-operator-ux.md).
>
> **17 opportunities, 0 conflicts with locked decisions.** Nothing here relabels, moves status
> ownership, changes the authority model, or builds the (reserved, unbuilt) Player Output snapshot.

## Method & sources

5-agent investigation: distill Apple HiG → extract what our docs already encode → audit current
components/CSS against HiG dimensions → synthesize prioritized opportunities → adversarial prune.
Apple HiG specifics confirmed via WebSearch + a GitHub-mirrored HiG progress-indicators reference
(developer.apple.com pages are JS-rendered, not directly fetchable): ~44pt min touch target;
~4.5:1 body / ~3:1 large-text & UI-component contrast; Dynamic Type; honor `prefers-reduced-motion`;
never rely on color alone; keep progress indicators moving (stationary reads as frozen), prefer
determinate, don't morph spinner↔bar. Project constraints read directly from the style guide +
operator-journey docs. Archival HiG refs (1987/1992 Mac HIG) are cited in the style guide.

## ⚠️ Meta-finding: the color audit does not verify contrast or token resolution

`orchestratorColorAudit.test.ts` only flags **raw** `#hex`/`rgb()`/`hsl()` literals outside the token
block (regex). It does **not** resolve `var()` references or measure contrast. Consequences:
- **Undefined-token bugs are CI-invisible** — see correctness bug #1 below.
- Low-contrast token *pairs* are not caught. "Contrast is CI-enforced" is **overstated**; only
  raw-literal discipline is enforced.
- **Recommended:** extend the audit to flag `var(--orch-*)` references that resolve to no defined
  token (a cheap static check that would have caught bug #1).

---

## A. Correctness bugs — land now as one quick-win slice

These are below-baseline regressions / real defects, all token-compliant static fixes, no screenshots needed.

1. **ApiReference references undefined tokens** *(high)* — `ApiReference.css` uses `--orch-text-muted`
   / `--orch-text-soft` (~10×, e.g. lines 33, 49) but only `--orch-muted` / `--orch-muted-soft` are
   defined (`OrchestratorView.css:1-72`). Subtitles/signatures/params/summaries fall back to inherited
   color → tuned Solarized contrast not applied. **Fix:** map `--orch-text-muted→--orch-muted`,
   `--orch-text-soft→--orch-muted-soft`. → `ApiReference.css`
2. **PresetTree suppresses its focus ring** *(high)* — the highest-traffic surface sets `outline: none`
   on rows/headers/action buttons (`PresetTree.css:31-34, 125-132, 208-213`) while every sibling uses
   `2px solid var(--orch-focus)`. Keyboard/switch users can't distinguish focus from hover. **Fix:**
   apply the standard ring (or inset box-shadow where outline clips rounded corners); keep the cyan
   tint as a redundant cue. → `PresetTree.css`
3. **PresetBrowser shimmer loops under Reduce Motion** *(medium)* — `.skeleton*` run
   `shimmer 1.2s linear infinite` (`PresetBrowser.css:141-146`); the existing
   `@media (prefers-reduced-motion)` block (255-262) omits the `.skeleton*` selectors. **Fix:** add
   `animation: none` for them in that block. → `PresetBrowser.css`

---

## B. Accessibility state-exposure — fold into existing gate slices

Attribute-only additions that expose **already-locked** labels to assistive tech. No relabeling, no
ownership change. Each notes its natural gate.

| # | Opportunity (pri) | Gap (file) | Gate |
|---|---|---|---|
| 4 | **aria-live on remote-update banner** *(high)* — no `role`/`aria-live`; arrival/×N silent (`OrchestratorView.tsx:110-122`). Add `role='status' aria-live='polite'`. | 3b |
| 5 | **Buffer selector group semantics** *(high)* — `Auto/o0..o3` bare buttons, no name/role/`aria-pressed`, active = color-only (`StagePanel.tsx:108-119`). Wrap as `radiogroup`/`aria-checked` (+ group label). | 3b/3e |
| 6 | **aria-live on OrchestratorStatusStrip** *(med)* — pills are `<span>`s, no live region; broadcast/camera transitions unannounced (`OrchestratorStatusStrip.tsx:18-33`). Add `aria-live` + per-pill name prefix (`Broadcast: Synced`). | 3b |
| 7 | **Announce CodeEditor send lifecycle** *(med)* — send pills are plain `<span>`s, no live region (`CodeEditor.tsx:503-517`). Wrap in `role='status' aria-live='polite'`. | 3b |
| 8 | **Expose PresetTree row badges in accessible name** *(med)* — badges visual-only; row `aria-label` is only `Preset ${name}` (`PresetTree.tsx:303,313-321`). Compose badge states into the name. | 3c |
| 9 | **Surface HydraPreview overlay state** *(low)* — overlay has no `role`/`aria-live`; secondary truths color-coded (`HydraPreview.tsx:324-335`). Add a non-pointer-blocking live region. | 3b |
| 10 | **Keep 'Preview' qualifier on mobile Stage header** *(low)* — `.stageHint { display:none }` until ≥980px (`StagePanel.css:53-58, 227-231`); the phone (operator's primary device) reads only "STAGE", weakening the locked "approximate Local Preview, never Live" intent. Show a compact qualifier on mobile (keep exact vocabulary). | 3e |

---

## C. System/token application — fits Gate 3a-ii / 3d

| # | Opportunity (pri) | Gap (file) | Gate |
|---|---|---|---|
| 11 | **Reduced-motion fallbacks** *(med)* — only PresetTree/PresetBrowser are guarded; `OrchestratorView.css` `refPanelSlideUp` (~399) + tab transitions and `CodeEditor.css` button/`translateY` motion have none. | 3a-ii/3d |
| 12 | **:focus-visible on ApiReference action buttons** *(med)* — `.actionButton`/`.actionButtonSecondary` have `:hover` only; sibling `.functionItem` has the ring (`ApiReference.css:333-352`). | 3d |
| 13 | **Apply the 44px touch-target token on desktop/tablet** *(med, judgement call)* — `--orch-touch-target: 44px` (`OrchestratorView.css:47`) is referenced **only** in mobile media queries; desktop/tablet keep sub-44px controls (CodeEditor 36px, buffer 28px, resend/banner 32px). Recommend hit-slop on smallest controls first; size policy owned by 3a-ii/3f. | 3a-ii/3f |

---

## D. Deferred (valid, lower-traffic / larger / opinion)

| # | Opportunity (pri/effort) | Note |
|---|---|---|
| 14 | **PresetTree folder-action discoverability** *(low/small)* — actions `opacity:0` until hover (`PresetTree.css:86-103`); delete/set-player-folder are hover-only on desktop. UX opinion; mutates the high-risk PresetTree surface. Authority gating is correct/untouched — discoverability only. | pairs w/ 3c |
| 15 | **PresetPicker conformant menu** *(med/larger)* — popover lacks `aria-haspopup`/`aria-expanded`, no `role`, no Escape/focus-trap/return (`PresetPicker.tsx:58-66`). | own slice |
| 16 | **Keyboard-operable resize separator** *(low/small)* — `role='separator'` but `tabIndex={-1}`, pointer-only (`OrchestratorView.tsx:92-101`). Add focus + Arrow/Home/End per the window-splitter pattern. | coord. 3a-ii |

(Items 1–16 above = the 17 opportunities; the focus-ring fix spans rows+headers+buttons.)

## Adversarial verdict

> *"Strong, unusually well-grounded set… no fabrications and no LOCKED-decision conflicts."*

**Top recommendations, ordered:** (1) ApiReference token fix — highest, real & CI-invisible;
(2) restore PresetTree focus ring — below-baseline regression on the busiest surface;
(3) suppress shimmer under reduce-motion — **bundle 1–3 as one quick-win slice**;
(4) aria-live on banner + send-status + status-strip → **sequence into Gate 3b**;
(5) buffer-selector group semantics → 3b/3e; (6) PresetTree row-badge accessible names → 3c.
**Deprioritize:** the 44px size-bump (defer to 3a-ii/3f; at most hit-slop on buffer/resend),
folder-action discoverability, PresetPicker rebuild, keyboard resize separator.

**Infeasible now:** empirical contrast *verification* of ApiReference text and the camera-pipeline
0.58rem detail (local Nix Chromium e2e is blocked → no authenticated screenshots; the audit can't
measure contrast). The token-mapping *fix* itself is not blocked (static, grep/typecheck-verifiable).

## Roadmap mapping (summary)

- **New quick-win slice:** bugs #1–#3 (+ optionally extend the color audit to catch undefined tokens).
- **Gate 3b** (Stage/preview reconciliation): #4, #6, #7, #9, #5.
- **Gate 3c** (PresetTree/PresetBrowser): #8, #14.
- **Gate 3a-ii / 3d** (tokens): #11, #12, #13, focus-ring recipe for #2.
- **Gate 3e** (Stage header): #10, #5.
- **Gate 3f** (mobile density): #13 counterpart.

## Already covered (do NOT re-propose)

Status taxonomy + one-owner-per-label; pill-vs-banner split; `FORBIDDEN_PREVIEW_TERMS` & fixed
preview/output vocabulary; Solarized semantic token mapping; explicit-action separation
(Load≠Send≠Save≠Camera); authority boundary + capability-mirrors-authority disclosure; visible focus
on most surfaces (gaps are *narrow*: PresetTree rows, ApiReference action buttons, resize separator);
two workspace layouts + Library-as-nav; empty/policy **copy** (only visual treatment is open). Source:
style guide + operator-journey + preset-operator-ux. (The former reserved Player Output snapshot slot
is removed per the 2026-06-04 owner decision — Local Preview is terminal.)

## Doc-system gaps (future style-guide expansion, beyond Gate 3)

Our docs encode the *taxonomy* but not a full visual system. Not yet specified: **spacing/grid scale**
(owned by 3a-ii), **focus-ring recipe** (width/offset/3:1 contrast — 3a-ii), **density audit**,
**typography scale** (no type ramp / min sizes / Dynamic-Type-style scaling), **quantitative contrast
targets** (no measurable threshold), **motion guidance** (durations/easing/reduced-motion policy),
**latency/progress patterns** (response-time budgets, debounce, skeleton/optimistic), **empty-state
visual** treatment, **iconography** system, **responsive breakpoints** (widths/tablet reflow),
**elevation/depth** language, **i18n/text-length** resilience, **constructive error-copy** standard.

## Forward slices — conformance finish (Local Preview is terminal) (operationalized 2026-06-04)

Derived from the `orch-alignment-roadmap` workflow (run `wf_c4414b98-aff`, critic verdict
approve-with-changes). **Verdict: the engineering is aligned (every shipped slice passed
TDD/typecheck/lint/`slices:check`=0); the doc layer is drifted** — the ratified spec still
describes textual tone pills while the code ships glyph circles, and `current_state_2026_03_05.md`
is missing the last 4 merges. `active-slices.yaml` stays coordination-only; this is the durable
forward record. A slice gets an `active-slices` record only when its branch/worktree is created.

**Execution constraints (read first):**
- **Serialize every slice that edits `orchestratorColorAudit.test.ts`:** `elevation-aqua-cleanup`,
  `error-state-route`, `motion-tokenize`, `breakpoints-lockstep`. The CSS scopes are line-disjoint
  but the test file is shared — one integrator owns the test edits, or run them sequentially.
  **Do NOT run these as parallel agents.**
- **`spec-doc-sync` is BLOCKING only for spec-graded slices** (`empty-error-states`, anything citing
  §4.11/§4.5/§4.7). The pure-CSS cleanups (`elevation-aqua-cleanup`, `error-state-route`,
  `motion-tokenize`, `breakpoints-lockstep`) are graded by the audit test, not the prose spec — they
  need NOT wait on the doc slice.

### Phase A — doc-truth reconciliation (do first)
- **`spec-doc-sync`** [M, pure docs] — bring the ratified spec in lockstep with shipped code.
  - `orchestrator-visual-language.md`: §4.11 badges = collapsed **glyph circles** (`A/L/S/★/VIDEO` +
    visually-hidden accessible name + hover `title`), §4.2 glyph-on-tint contrast (WCAG-1.4.11 3:1),
    §4.5/§4.3 sanctioned **size-neutral micro-lift** (`brightness(1.12)` + inset `currentColor` ring,
    no geometry change), §4.7 register **VIDEO/mdiVideo** (`icons.ts:48`). Drop **Gallery** from the
    §4.11 rendered-badge list + the D3.2 order (L341/L500/L551/L587/L601); note `QR_CODE` is no
    longer rendered as an Orchestrator preset badge but remains a registered icon with a live
    consumer at `QRPrefs.tsx:34` (so it is NOT orphaned), and "Gallery" survives only as
    accessible-name text on the Orchestrator preset row. Record the legend
    **add (`70d0e6ad`) then remove (`70650635`)** + the "redundant with hover tooltips" rationale.
    NOTE: the spec's OQ-8.1/OQ-8.2 + the "Doc-truth reconciliation" section (L275/L276/L338) are
    **already reconciled — do not re-touch them.**
  - `orchestrator-style-directions.md`: flip stale tags for merged work (D6.2→DONE; revisit
    D2.1/D4.1/D7.1/D7.2/D7.3/D8.1/D8.2); correct OQ-8.2 "Cam badge is blue" → `--orch-synced` cyan
    (:382/:483); **re-measure or supersede** the stale D8.5 raw-hue counts (:363, pre-role-routing).
  - `orchestrator-visual-system.md`: Principle 7 one-line note — restraint = **event-bound, not absent**.
  - Cut **`current_state_2026_06_04.md`** capturing the 4 entries missing from
    `current_state_2026_03_05.md` (**phase-16 glyph circles, phase-17 legend add, legend remove,
    video-crop fix** — phase-15 typography is ALREADY at `:13`); supersede the stale-dated file.

### Phase B — residual conformance (CSS / markup)
- **`elevation-aqua-cleanup`** [S, audit-test] — delete the 7 dead `--aqua-*` shims
  (`OrchestratorView.css:83-89`, zero consumers) + an audit assertion of their absence. There is NO
  tiered elevation scale to build (only a single `--orch-shadow` + focus-ring insets).
- **`error-state-route`** [S, audit-test] — route `PresetBrowser.css .error` (:123) off raw
  `--orch-red` onto `--orch-danger`/tone recipe; remove the deferred `\.error` allowlist exception
  (`orchestratorColorAudit.test.ts:74`).
- **`motion-tokenize`** [S, audit-test] — tokenize the 5 raw holdouts: `PresetBrowser.css:34/76`
  (0.2s), `:119` (180ms + raw bezier), `:148` (shimmer 1.2s), `PresetTree.css:147` (sendAckSpin
  800ms). Keep reduce-motion guards.
- **`breakpoints-lockstep`** [M, audit-test] — define `--orch-bp-*` (980/979/640/~390); 979/980/640
  px are hardcoded across 8 files. **CAVEAT: CSS custom properties cannot be used inside `@media`
  conditions** — pick a real single-source mechanism (documented constant + lint, or build-time),
  not naive `var()` in media queries.
- ~~**`empty-error-states`**~~ — **DONE 2026-06-06** (slice `phase-B-empty-error-states`, analysis
  `docs/analysis/orchestrator_empty_error_states_2026_06_06.md`). Routed the PresetBrowser
  empty/error/loading group font to `--orch-text-meta` (§4.6); added live-region roles
  (error=`role='alert'`; empty+policyNotice+ApiReference emptyState = `role='status' aria-live='polite'`).
  New `orchestratorEmptyStateTreatment.test.ts` (does NOT touch the audit test). No visual/behavior change.
- **`error-copy-sourcing`** [S/M, follow-up to `empty-error-states`] — **residual §4.9 gap.** The eleven
  inline `toErrorMessage(err, 'Failed to …')` fallbacks in `PresetBrowser.tsx`
  (`:135,297,337,377,411,450,486,504,525,546,568`) are conformant in *voice* but not sourced from a copy
  module / unit-assertable, which §4.9 asks for ("strings live in presetEmptyState.ts / presetOperatorUx.ts").
  Extract them into a copy module + unit-assert. Deliberately deferred from the treatment slice.
- **`buffer-apg-finish`** [M, own component] — WAI-ARIA radiogroup keyboard pattern on StagePanel
  buffer controls (roving tabindex + Arrow/Home/End + the deferred focus cue); roles exist
  (`StagePanel.tsx:200/205`), key handling does not.
- **`icon-i18n-stance`** [S/M, doc-only] — decide the i18n stance (zero today; ~40 hardcoded
  aria-labels + all copy). Defer string extraction unless the stance says extract now.
- ~~**`drop-orphan-qr-icon`**~~ — **DROPPED 2026-06-05, invalid slice.** `QR_CODE` (`icons.ts:42`)
  is NOT orphaned: it has a live consumer at `QRPrefs.tsx:34` (`<Icon icon='QR_CODE' />`, the room
  QR-code prefs surface). It must stay registered. The premise of this slice was a stale "no live
  consumer" reading; verification (grep across `src/`) found exactly one consumer. No code change.

### Terminal decision — Local Preview is the terminal truth (owner decision 2026-06-04)
The owner decided 2026-06-04 that a live image of what is playing is not necessary. **Option A
(Local Preview is the terminal truth) is adopted; the ADR `orchestrator-player-live-decision.md` is
updated to record A as terminal.** Option B (periodic Player-output snapshot) and Option C (live
mirror) are both dropped from the roadmap. C remains theoretically possible only behind a fresh
future ADR and is no longer a roadmap item.

The conformance roadmap therefore **ends at Phase B**. The former Phase C
(`term-guard-surface-aware`, `reserved-snapshot-slot`) and Phase D (`player-live-runtime`) are
removed: no Player-output snapshot or mirror will be built, no Stage frame slot is reserved for one,
and `FORBIDDEN_PREVIEW_TERMS` does not need to become surface-aware. The `FORBIDDEN_PREVIEW_TERMS`
guard stays in force, and `OrchestratorPlayerOutputTruth` stays at its 2-value
(`'noPlayer' | 'playerPresentNotMirrored'`) form.

### Deferred HiG (independent of Player-Live; after the conformance core)
- **`splitter-keyboard-and-drag`** [M] — HiG #16 keyboard-operable resize separator
  (`OrchestratorView.tsx:98/101` is `role='separator'` `tabIndex={-1}`, pointer-only) **designed
  together with** the OQ-4.1 draggable Stage/Code splitter (same surface).
- **`presetpicker-conformant-menu`** [M] — HiG #15: `aria-haspopup`/`aria-expanded`, menu role,
  Escape-to-close, focus-trap + focus-return (`PresetPicker.tsx:58-66`).
- **`presettree-folder-action-discoverability`** [S] — HiG #14: surface delete / set-player-folder
  beyond `opacity:0`-until-hover (`PresetTree.css:86-103`); lowest priority (mutates the High-Risk
  PresetTree surface).

### Residual research items outside the conformance wave (code-verified 2026-06-04)

A coverage check of every still-OPEN/PARTIAL style-direction against the code (not just the doc tag).
The Phase-B conformance wave + the deferred-HiG items above cover most of the research; these are the
items that were NOT in either, with their *verified* status:

- **`no-hero-entry-guard`** [S, real slice] — D1.1. The no-hero/landing good state exists (grep-clean in
  `OrchestratorView.tsx`) but is **unguarded**; the audit has no `FORBIDDEN_ENTRY`/no-hero grep. Add a
  static assertion (the `FORBIDDEN_PREVIEW_TERMS` pattern) so regression is CI-caught. Visual-language §5
  already specs it (`FORBIDDEN_ENTRY_TERMS` over `ENTRY_AUDITED_FILES`).
- **`entry-search-accelerator`** [S, real slice] — D1.2/D1.3 (OQ-1.1 RESOLVED → no autofocus + a `/`
  accelerator to Presets search via `aria-keyshortcuts` + in-field hint). Verified **unbuilt** (no
  `aria-keyshortcuts` / `/` handler in `PresetBrowser.tsx` / `useOrchestratorWorkspace.ts`). Small a11y/UX slice.
- **D2.2 approximate-frame dashed hairline** [optional polish] — the preview already carries a subtle
  border (`HydraPreview.css:4`); only the *dashed* "approximate" variant is unbuilt. Cosmetic; fold into
  `empty-error-states` or skip.
- **D9.1 verification-mechanism column** [doc-only] — visual-system Principle 9 names the
  rule→verification mapping in prose but has no column/table. Add it when next touching that doc.
- **D4.4 code-dock subordinate surface** [largely done] — `.codeDock` already recesses
  (`OrchestratorView.css:227`); residual is codifying the "Stage ≥ Code surface" rule in the style guide.
- **D3.5 keyboard preset-reorder** [met] — the *Move to folder* button (`PresetTree.tsx:448`) + arrow-key
  handlers satisfy the WCAG 2.5.7 "drag-not-the-sole-mechanism" bar. Full keyboard drag-reorder is optional.
- **D5.5 banner Apply/Dismiss in-flight** [N/A] — Apply/Dismiss are instant local ops
  (`OrchestratorView.tsx:117-120`), no network latency, so an in-flight state is not warranted.
- **Composited `color-mix()` contrast** (D7.6/D8.4/OQ-8.1 residue) [e2e-blocked] — flat-pair WCAG is
  audited; composited-tint contrast stays a docs-checklist item until the Nix Chromium e2e is unblocked.

**Open decisions still yours** (taste/policy, not build slices): OQ-4.2 (mobile pending-edits), OQ-6.2
(camera onto frame — note D6.2 resolved the collision differently), OQ-6.3 (390px proximity), OQ-7.1
(hard vs two-tier font floor), OQ-7.2 (44px policy for the remaining controls), OQ-9.3 (folder-action
pointer scope, overlaps OQ-5.2/HiG #14).

> **Correction to this doc's "Meta-finding" section above (re-verified 2026-06-04):** it is now
> partially outdated. `orchestratorColorAudit.test.ts` DOES resolve `var()` existence
> (`collectUnresolvedOrchVarRefs`) and — per spec OQ-8.1, RESOLVED — flat (non-`color-mix`) token-pair
> WCAG contrast via `resolveTokenValue`. Only **composited `color-mix()` contrast** remains unverified
> (e2e-blocked) — that is the genuine residual, not "no contrast/token resolution at all."

## HiG control-surface patterns (grounding)

Persistent role/authority indicator (anti-hidden-mode) · one-owner-per-label taxonomy · status-pill vs
actionable-banner split · explicit-action separation · determinate-leaning async lifecycle (no frozen
"pending", no shape-morph) · confirmation gating for high-impact commands · capability-mirrors-authority
disclosure · relevance-gated progressive disclosure · priority-layered layout (Stage→Preset→Code→API) ·
reserved-but-unbuilt slot · redundant (color+text+placement) encoding · recognition-over-recall ·
parameter-control conventions (live value, min/max, reset, no large touch jumps) · touch+keyboard dual
operability (44px, visible focus, ARIA semantics, expert shortcuts) · reduce-motion-safe live surface ·
stable cross-surface vocabulary.

---
_Full structured data: workflow run `wf_da2ad6b1-7f4`._
