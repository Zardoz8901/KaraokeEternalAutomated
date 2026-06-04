# Orchestrator HiG Product Interpretation & Visual System

> The **style direction** for the Orchestrator: what this thing *is* and how it should look and behave.
> It translates Apple HiG (modern + the archival Mac HIG refs) and our locked decisions into
> app-specific interpretation. The [Synthesis UI Style Guide](orchestrator-synthesis-ui-style-guide.md)
> holds the *rules*; this doc holds the *direction those rules serve*. The token contract
> ([spacing/focus, Gate 3a-ii](orchestrator-synthesis-ui-style-guide.md)) and the
> [HiG backlog](../analysis/orchestrator_hig_ux_backlog_2026_05_30.md) are how it gets realized.
>
> **Exploratory, not final pixels.** Each principle below states the interpretation, the open
> questions to resolve, the app-specific rule it should yield, its tensions, and how we'll know it's
> achieved. It implements nothing and changes no locked contract.

## Purpose

**The Orchestrator is a calm, dense operator workstation for repeated live visual control — every
element is a tool with visible state, near its subject, on a Solarized semantic system, with HiG
principles expressed as concrete testable rules.**

## Cross-cutting locked constraints (every principle honors these)

- Solarized-only tokens; no relabeling; `FORBIDDEN_PREVIEW_TERMS` (preview is never Live/Player Output/
  Now Playing/On Display) — a permanent guard under Option A; the one-owner-per-label status table; the
  authority model. The Orchestrator does not surface a copy of the Player's audience output (Option A,
  terminal): Local Preview is the operator's authoritative working view and no Player-Output slot is reserved.
- Mobile/touch is first-class (the camera operator's primary device). Local Nix Chromium e2e is blocked,
  so prefer **statically verifiable** rules (tokens, audits, render-tests) over screenshot-only ones.

---

## The nine principles (with exploratory criteria)

Each: **Interpretation · Explore · App-rule(s) · Tensions · Done-bar · Touches.**

### 1. An operator workstation, not a dashboard or landing page
- **Interpretation:** optimized for a returning operator who already knows the room and acts repeatedly and fast — not for first impressions, hero areas, at-a-glance metrics, or marketing chrome.
- **Explore:** what is the default focus on entry (Stage? presets)? what is always-visible vs disclosed? the target information density for a workstation (dense but calm)? what existing affordance is "dashboard/landing-like" and should be removed?
- **App-rule:** no hero/landing; a returning operator is always one step from browse→load→send; persistent controls over hidden menus; expert accelerators (keyboard, search) are first-class, not hidden.
- **Tensions:** must still be learnable in ~5s (locked acceptance); progressive disclosure for low-frequency capability.
- **Done-bar:** a returning operator completes browse→load→preview→send→confirm without hunting; nothing on screen exists only to impress.
- **Touches:** `OrchestratorView` layout, `StagePanel`, `PresetBrowser`.

### 2. Local Preview is the operator's authoritative working view; no Player-Output copy is surfaced
- **Interpretation:** Local Preview is the operator's approximate working view; it is rendered locally and is not the Player's rendered output. The real Player has an audience display, but the Orchestrator does not surface a copy of it (Option A, terminal). Local Preview must never read as that audience truth — the visual reinforcement of the permanent `FORBIDDEN_PREVIEW_TERMS` guard.
- **Explore:** how to mark Local Preview as approximate (frame/border treatment, a persistent label chip, distinct elevation) so it never reads as the audience display?
- **App-rule:** Local Preview always carries its `Local Preview` chip + an "approximate" treatment; the Orchestrator surfaces no Player-Output panel and reserves no slot for one (Option A, terminal).
- **Tensions:** never label the local preview as output. (A live mirror of the audience display is out of scope under Option A and would require a fresh ADR before any surface is reserved.)
- **Done-bar:** a viewer instantly reads the preview as the operator's local approximation, never as audience truth.
- **Touches:** `HydraPreview`, `StagePanel`, the elevation system (spec below).

### 3. Presets are manipulable objects with state, not just list rows
- **Interpretation:** a preset is an object that *has state* (selected / loaded-in-preview / applied-on-player / starting / camera-using / gallery-vs-saved) and *affordances* (load, send, manage). The row reads as an actionable object, with its state as part of its identity — not a text line.
- **Explore:** how much state on the row vs on demand? direct-manipulation affordances (selection binds visibly; drag)? card vs row at different densities? how state reads as the object's *condition*, not decoration.
- **App-rule:** each preset surfaces its state + available actions as part of the object; selecting binds visibly (direct manipulation, immediate feedback); state uses redundant encoding (color + text/shape, never color-only); the status-ownership table is the object's state vocabulary.
- **Tensions:** density vs richness — stay calm/dense, don't bloat rows; authority gating decides which actions exist.
- **Done-bar:** a row communicates "what this preset is, its current state, what I can do with it" before any selection.
- **Touches:** `PresetTree`, `PresetBrowser`, the row-badge a11y work (HiG #8).

### 4. Code is an expert instrument, not the center of every workflow
- **Interpretation:** the editor is a powerful instrument for the Host live-coder, but the Operator/Browse-only workflows (browse→load→send presets) are first-class and must not be dominated by the editor. Code is weighted by role.
- **Explore:** default weighting of code vs presets per role/layout? when is code prominent vs collapsed? how the two locked workspace layouts (Host vs Operator/Browse-only) express this?
- **App-rule:** Operator/Browse-only layouts de-emphasize or hide code; Host layout gives the editor instrument-grade affordances; code is third in the priority order (Stage→Preset→Code→API), never the centerpiece.
- **Tensions:** don't cripple the Host expert path; the two-layout decision is locked.
- **Done-bar:** an Operator never has to touch the editor to do their job; a Host has full instrument controls.
- **Touches:** `OrchestratorView` layouts, `CodeEditor`, the host/operator workspace model.

### 5. Controls are visible, immediate, and modeless where possible
- **Interpretation:** prefer always-visible controls with immediate feedback over hidden modes and hover-only affordances; avoid modes a user can get stuck in (the anti-hidden-mode HiG principle).
- **Explore:** which currently-hidden affordances should become persistent (e.g. the hover-only folder actions, HiG #14)? which interactions are needlessly modal? the immediacy budget (acknowledge within ~100ms)?
- **App-rule:** side-effecting commands are visible buttons, not buried; every command acknowledges immediately (visible + announced — ties to the aria-live work); minimize modes; where a mode exists (authority), it is a persistent visible pill, never discovered via a rejected action.
- **Tensions:** density vs always-visible — disclosure for low-frequency is fine, but core/destructive actions must not be hover-only (the #14 lesson); destructive actions keep confirmation.
- **Done-bar:** no core action is discoverable only by hover/guesswork; every tap/keypress is acknowledged.
- **Touches:** `PresetTree` folder actions (#14), buffer controls, feedback/aria-live work.

### 6. Status lives near the thing it describes
- **Interpretation:** status belongs adjacent to its subject — not in a detached banner far from the control it concerns. This is the *spatial* rule behind the one-owner-per-label table.
- **Explore:** which statuses are correctly placed vs detached today? when is a centralized strip right (cross-cutting authority/broadcast/camera that govern the Stage) vs when status must be inline (per-preset, per-control)? proximity rules; no detached help banners.
- **App-rule:** per-row state on the row; preview/source status on the preview; broadcast/camera/authority in the strip near the Stage they govern; source-binding warnings near the preview or affected preset, never a detached help banner; one owner per label.
- **Tensions:** the locked ownership table assigns owners — this is its spatial dimension; the strip is "near" because it governs the adjacent Stage.
- **Done-bar:** a user never looks away from a control to learn its status.
- **Touches:** status strip, preview overlay, row badges, the ownership table (spatial reading).

### 7. Visual hierarchy favors repeated live operation: dense, calm, legible, low ornament
- **Interpretation:** the aesthetic target is a calm, dense, legible instrument for long sessions — not flashy. Low ornament, strong legibility, restrained motion and color, adequate touch targets within density.
- **Explore:** the density target (comfortable-dense)? what counts as removable ornament? staying calm under bright/arbitrary Hydra output (chrome must stay separate and readable)? balancing density against the 44px touch minimum.
- **App-rule:** minimal decoration (nothing decorative-only); Solarized chrome stays visually separate from Stage output; type/contrast tuned for sustained legibility; motion restrained + reduce-motion-safe; the spacing scale serves density without crowding; hit-slop reconciles density with 44px.
- **Tensions:** dense vs 44px (resolve via hit-slop, HiG #13); calm vs emphasis (use hierarchy, not ornament).
- **Motion is event-bound, not absent:** "restrained motion" means motion fires only as the felt confirmation of a real state change — the send ack, the row beat, the size-neutral badge micro-lift — never idle or decorative; all motion presence is on the time axis (one-shot, reduce-motion-safe), none on resting luminance, so the matte chrome never competes with Stage output (the concrete tokens/values are in orchestrator-visual-language.md §4.3/§4.5).
- **Done-bar:** comfortable to watch and operate for a long set; nothing decorative-only survives.
- **Touches:** everything — the overall aesthetic tenet; realized by the typography/contrast/motion/density specs below.

### 8. Solarized is a working semantic system, not just a palette
- **Interpretation:** color carries *meaning* — semantic roles (primary/focus, live/synced/camera, ready, pending, error, surfaces) — never arbitrary decoration. The palette is a system with named semantic tokens, contrast guarantees, and redundant encoding.
- **Explore:** complete the semantic token layer (semantic names over raw hues)? contrast guarantees per pair (system spec below)? ensure no raw hue is used decoratively; strengthen the audit (the meta-finding: it resolves no `var()` and measures no contrast).
- **App-rule:** every color use = a semantic `--orch-*` token with a defined role; color is never the sole signal (paired with text/icon/state); contrast thresholds are explicit and enforced; the color audit is the guardrail — extend it to flag undefined `--orch-*` refs (Gate 3d) and, later, compute contrast.
- **Tensions:** Solarized-only is locked; the audit can't yet check `var()`/contrast — strengthen it.
- **Done-bar:** the semantic role is readable from the token name; the audit catches undefined / raw / (eventually) low-contrast uses.
- **Touches:** the token block (`OrchestratorView.css`), `orchestratorColorAudit.test.ts`, all CSS; the contrast spec below.

### 9. Early HiG principles become app-specific rules for layout, feedback, and control behavior
- **Interpretation:** the HiG principles (visible state, no hidden modes, immediate feedback, direct manipulation, labels-match-behavior, error prevention/recovery) must not stay abstract — each becomes a concrete, testable Orchestrator rule. This doc + the style guide are where that translation lives and stays current.
- **Explore:** which HiG principles still lack an app-specific rule? how to make each rule testable (e.g. "every command acknowledges within X / has an aria-live", "no core action is hover-only", "authority is always a visible pill")?
- **App-rule:** maintain a HiG-principle → Orchestrator-rule → verification mapping; new UI cites which rule it satisfies; rules are testable via lint/audit/render-test where feasible.
- **Tensions:** keep it living; avoid generic platitudes — each rule must be concrete and checkable.
- **Done-bar:** each HiG principle has ≥1 concrete, ideally testable Orchestrator rule; the HiG backlog's a11y/feedback items map onto these rules.
- **Touches:** this doc + the style guide; the whole rule set; the HiG backlog.

---

## Lower-level system specs this direction requires

These realize the direction above and are **docs-first specs to define, then apply** (the Gate 3a-ii→3d
pattern). Spacing scale, focus-ring recipe, and an initial density audit are **already defined** (Gate 3a-ii).
Still to define:

- **Typography scale** — ramp, sizes/line-heights/weights, a stated minimum readable size, Dynamic-Type-style relative units (serves principle 7).
- **Quantitative contrast targets** — adopt WCAG-equivalent numbers (4.5:1 body, 3:1 large/UI/focus), a token-pair pass/fail matrix, and an audit that resolves token values (serves principle 8).
- **Motion system** — duration/easing tokens + an allowed-motion policy + a blanket reduce-motion contract (serves principle 7).
- **Latency/progress patterns** — response-time budgets, debounce timing, spinner-vs-skeleton-vs-optimistic, stalled-state surfacing (serves principles 5, 6).
- **Elevation/depth** — z-layer + surface/shadow/border system for shell<docks<banner<popover<modal (serves principle 7).
- **Empty-state visual** treatment, **iconography** system, **responsive breakpoint** tokens, **constructive error-copy** standard, and an **i18n/text-length** stance — each a small docs-first spec.

(The full per-spec exploratory criteria were drafted alongside this doc; if a separate companion is wanted,
expand each bullet into a brief using the same Explore/Criteria/Done-bar structure.)

## Design tenets (quick reference)

1. Workstation, not dashboard. 2. Local Preview is the terminal working view (no Player-Output copy). 3. Presets are stateful objects.
4. Code is an instrument, role-weighted. 5. Visible, immediate, modeless. 6. Status near its subject.
7. Dense, calm, legible, low ornament. 8. Solarized is semantic. 9. HiG → concrete testable rules.

## Relationship to existing docs

- **This doc** = direction/interpretation (the "why").
- **[Style Directions](orchestrator-style-directions.md)** = the concrete per-principle directions (tagged DONE/PARTIAL/OPEN), open questions, and guideline citations that realize these principles — the "what to actually do".
- **Synthesis UI Style Guide** = the rules that implement the direction.
- **Preview/Output Model · Operator Journey + Status-Ownership · Preset Operator UX** =
  locked product contracts this direction must honor. (The Player Live ADR is superseded by Option A,
  2026-06-04: the Orchestrator surfaces no copy of the audience display.)
- **HiG UX backlog** = the concrete opportunities/bugs that move surfaces toward this direction.

## How this guides current and future work

- The in-flight **Gate 3 closeout** (token application, a11y exposure, stage-header layout) is the first
  wave of *applying* this direction — visible focus (5), status near subject (6), dense/calm tokens (7),
  semantic Solarized + audit (8).
- The remaining **system specs** above are the next docs-first wave.
- Net test of success: a returning operator runs a live set comfortably, never confuses preview for
  output, always knows their mode and each control's state, and the chrome stays calm under any Hydra output.
