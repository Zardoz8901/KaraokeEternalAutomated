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
(Load≠Send≠Save≠Camera); authority boundary + capability-mirrors-authority disclosure; the reserved
(unbuilt) Player Output snapshot slot; visible focus on most surfaces (gaps are *narrow*: PresetTree
rows, ApiReference action buttons, resize separator); two workspace layouts + Library-as-nav; empty/
policy **copy** (only visual treatment is open). Source: style guide + operator-journey + preset-operator-ux.

## Doc-system gaps (future style-guide expansion, beyond Gate 3)

Our docs encode the *taxonomy* but not a full visual system. Not yet specified: **spacing/grid scale**
(owned by 3a-ii), **focus-ring recipe** (width/offset/3:1 contrast — 3a-ii), **density audit**,
**typography scale** (no type ramp / min sizes / Dynamic-Type-style scaling), **quantitative contrast
targets** (no measurable threshold), **motion guidance** (durations/easing/reduced-motion policy),
**latency/progress patterns** (response-time budgets, debounce, skeleton/optimistic), **empty-state
visual** treatment, **iconography** system, **responsive breakpoints** (widths/tablet reflow),
**elevation/depth** language, **i18n/text-length** resilience, **constructive error-copy** standard.

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
