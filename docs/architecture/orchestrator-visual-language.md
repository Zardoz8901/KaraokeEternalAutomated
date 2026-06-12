# The Orchestrator Visual Language

> **Purpose.** This is the *decisive* style direction for the Orchestrator. It sits one step downstream
> of [orchestrator-visual-system.md](orchestrator-visual-system.md) (the nine **principles** — *what this
> thing is*) and [orchestrator-style-directions.md](orchestrator-style-directions.md) (the per-principle
> **directions** + the consolidated open-question gate). Where those docs *explored*, this doc **decides**:
> it resolves every open question (OQ-1.1 … OQ-9.3), fills the missing system specs with concrete tokens
> and values, and sharpens the visual personality. Pipeline:
> **principle → direction → THIS (decisive direction) → rule ([synthesis style guide](orchestrator-synthesis-ui-style-guide.md)) → test (audit / render-test / grep).**
>
> **It implements nothing and changes no locked contract.** No CSS, no TSX, no test is edited by this doc.
> It is the spec the next implementation slices and the [synthesis style guide](orchestrator-synthesis-ui-style-guide.md)
> turn into enforced rules. Section 5 maps each new rule/token to its style-guide home and its guarding test.
>
> **Locked constraints honored throughout** (none re-opened):
> - **Solarized-only.** Every color is a named `--orch-*` token; raw `#hex`/`rgb()`/`rgba()`/`hsl()`/`hsla()`
>   are forbidden outside the `ORCH_SOLARIZED_TOKENS_START/END` block (`OrchestratorView.css:2-20`), audited by
>   `orchestratorColorAudit.test.ts`. No new palette families.
> - **`FORBIDDEN_PREVIEW_TERMS`** = `['Live','Player Output','Now Playing','On Display']`: the local Hydra
>   preview is never labeled with any of these. It is `Local Preview` (approximate). Guard:
>   `orchestratorPresentationModel.ts:41`.
> - **One-owner-per-label.** Each status string is rendered by exactly ONE surface
>   (operator-journey §3); enforced by `orchestratorStatusOwnership.test.ts`.
> - **Authority model.** owner/admin = live-code authority; collaborator/operator = saved DB presets only;
>   Browse-only = Load/audition locally, no send. Gallery broadcast is host/admin-only. UI mirrors the
>   server boundary; rejection is never the primary UX.
> - **Local Preview is the terminal truth surface (Option A, owner decision 2026-06-04).** The Orchestrator
>   surfaces no copy of the real audience output: no reserved layout slot, no reserved label slot, no
>   truth-union extension point for a snapshot. `.stageFrame` is permanently single-preview. The real Player
>   still has audience output — Option A declines to mirror it here, it does not deny it. `Player Output` and
>   `Player Live` remain forbidden as labels on the local preview. Option C (a live mirror) is no longer a
>   roadmap item and would require a fresh ADR.
> - **Local Nix Chromium e2e is BLOCKED.** Prefer statically verifiable rules (token audit, render-test,
>   source grep) over screenshot-only ones.
> - **Contrast targets are LOCKED:** ≥4.5:1 body text, ≥3:1 large text / UI components / borders / focus
>   indicators, audited context dark Solarized (base03). Only the enforcement *mechanism* is open (OQ-8.1).
> - **Elevation is border/shape/label only.** `--orch-shadow` (`OrchestratorView.css:41`) is reserved for
>   true popovers/modals AND the transient drag-lift (`.folderDragging`/`.presetDragging`) only — never the
>   preview frame, the docks, or static chrome.
> - **UI chrome is a separate Solarized plane** from arbitrary/bright Hydra output and must stay readable
>   over it; **color is never the sole signal** (always paired with text/icon/shape/placement).

---

## 1. Design intent

### Design principles

1. **Defer to content.** Chrome is visually subordinate to the live visuals and active state signals: a calm, dense, dark Solarized plane that stays legible over arbitrary/bright Hydra output without competing with it. Emphasis comes from luminance, weight, and placement — never from ornament, texture, or skeuomorphic styling that imitates a physical object. The dark theme is functional (legible in a dim performance room), not decorative. *(Apple HiG — Deference; D7.4.)*
2. **Emphasis is earned, not ambient.** The only emphasized elements are the operator's live visuals and the few state signals relevant *right now*. Emphasis comes from weight, contrast, placement, and feedback timing — not glow, idle animation, texture, or resting luminance. *(Principle 7; §4.3.)*
3. **Feedback is immediate and honest.** Every side-effecting action is acknowledged within Tier-0 (≤100 ms) in two channels (visible + assistive tech); the surface changes on events and is static at rest; failures are announced and state their remedy. *(§4.5; Apple HiG — immediate feedback.)*
4. **No skeuomorphism.** No bevels, gloss, brushed metal, knobs/faders/VU meters, textures, or controls drawn to imitate hardware. *(D7.4.)*
5. **Density serves repetition.** Comfortable-dense layout for a returning operator under time pressure; touch targets meet the ≥44 px-effective floor via hit-slop, not bulk. *(§4.1, §4.8; OQ-7.1/7.2.)*
6. **Labels match behavior.** A label never claims more than the behavior delivers; local-preview state is distinguished from room/applied state; modes are always visible. *(`FORBIDDEN_PREVIEW_TERMS`; one-owner table.)*

It is a tool, not a stage — the audience-facing output is the Player. Control placement is stable across visits (familiar on return); chrome is lit just enough to read in a dim room; state labels distinguish local-to-operator from what the room actually sees; the surface introduces no hidden modes, makes no claim that the audience sees output it does not, and escalates visual prominence only when an operation actually fails. It rewards repetition (muscle memory over menu traversal). We adopt the *interaction ergonomics* of established performance tools — predictable placement, immediate response, frequent controls reachable without traversal — but not their *appearance*: no knobs, faders, bevels, gloss, or brushed metal. This matches flat session DAWs (Ableton, Bitwig): adopt the interaction model, not the hardware faceplate.

> **Provenance (re-anchored 2026-06-01, per review).** An earlier draft anchored this on "a lit instrument panel in a dark booth"; that metaphor was rejected because naming the aesthetic after a physical apparatus invites the knobs, faders, bevels, and brushed-metal chrome this doc rejects (D7.4, §1 "Mac-like"), so the intent is stated as qualities rather than an object to imitate.

### Mac-like without copying old Mac UI literally

We take the early-Macintosh HiG *principles* (1987/1992), not its *pixels*. **No faux-bevels, pinstripes,
brushed metal, gloss, or skeuomorph chrome** — those are explicitly the removal target (D7.4; the neutralized
`--aqua-*` shims at `OrchestratorView.css:63-69` are dead weight to delete). Each archival idea maps to one
concrete, testable app behavior:

| Early-HiG idea | Orchestrator behavior (concrete) | Where / how checked |
| --- | --- | --- |
| **See-and-point** | Every side-effecting command is a visible, named control next to its subject. Load/Send are text buttons on the row (`PresetTree.tsx:339-368`), not a hidden menu or gesture. | `presetOperatorUx.test.ts`; render-test click=Select |
| **Visible state** | A preset's state IS its identity, painted in the reserved badge lane; authority is a persistent pill, never discovered by a rejected click. | `orchestratorStatusOwnership.test.ts`; PresetTree render-test |
| **No hidden modes** | The one mode that exists (Host / Operator / Browse authority) is always shown as a pill; no command palette to get trapped in; no core action hidden behind hover on touch. | `OrchestratorStatusStrip` render-test; capability-query reveal (§3, OQ-5.2) |
| **Direct manipulation** | Selecting binds visibly (3px inset rail, `PresetTree.css:235-244`); Load shows immediately in Local Preview; drag has a keyboard/pointer equivalent (Move-to-folder, arrow-roving). | render-test aria-label composition; `PresetTree.css` focus-ring guard |
| **Immediate feedback** | Every command acknowledges synchronously (Tier-0 ≤100ms), dual-channel (visible + aria-live); a stalled send resolves, never freezes (4000ms → Failed). | render-test ack-on-dispatch; timer-test (§4 Latency) |
| **Labels match behavior** | `Local Preview` is never `Live`; a control's name equals what it does. `FORBIDDEN_PREVIEW_TERMS` is this principle in code. | `orchestratorPresentationModel.ts:41` |

**Typography rhythm:** one calm ramp, `--orch-text-meta` 0.75rem floor up to `--orch-text-title` 1.125rem
(Stage title only); generous line-height for long-session reading; **weight, not size or color, carries
emphasis.** **Motion philosophy:** motion only confirms a state change or shows where something came from —
120/180/250ms, one easing, zero ambient/decorative animation, fully reduce-motion-safe. **Disclosure
philosophy:** always-visible = the returning operator's hot path (Stage, preset rows with state, Load/Send,
authority, search) + every core/destructive command; progressively disclosed = low-frequency host management
(rename/move/delete), advanced API/reference, code diagnostics — disclosed by relevance, **never hover-only
for a core action**.

Rejected personalities: a *plugin-rack / VST hero* aesthetic with knobs and chrome bevels (style guide opens
"not a plugin rack"; Principle 7 low-ornament); *literal retro-Mac skeuomorphism* (copies pixels not
principles); a *bright/energetic party-VJ* look (would make chrome compete with Hydra output, breaking the
locked chrome-stays-separate-and-readable constraint).

### Reference points: flat session-style tools (Ableton, Bitwig)

Where "an instrument panel" was a *liability* (it invites the very knobs and bevels we reject), modern
flat-dark **session DAWs are safe references** for the opposite reason: at the *application* level they are
deliberately anti-skeuomorphic. Ableton reduces every control "to its most essential nature — zero
decoration": it is full of dials and faders, but "a slider is just a line, a dial is just a curved slider" —
drawn flat and abstract, never as hardware (it was flat ~10–15 years before flat design). Bitwig drops
graphical ornament "unless absolutely necessary." Both are calm, dark, dense, single-window tools where color
is rationed as *coding*, not decoration — a direct convergence with the §1 **defer-to-content** principle
(chrome recessive; emphasis reserved for live visuals and active state signals). We borrow the **interaction
model and restraint**, never the device chrome and never the palette.

| Borrow (adopt) | Adapt to our constraints | Reject (NOT a model) |
| --- | --- | --- |
| Flat surface; emphasis by luminance/weight/placement, no ornament (P7, D7.4) | Their free/large color sets → fixed Solarized `--orch-*` role tokens, one hue per meaning, capped, always + a non-color cue (P8) | Rotary knobs / dials, hardware-mimic faders |
| Single fixed window, no floating/modal panels (P1, §2 grid) | Pro-grade *extreme* density → our **comfortable-dense** (reserved fixed-height badge lane, no reflow) (P7) | VU/needle meters, lamp/LED glows |
| Color = identity/role/state coding on monochrome chrome (P8) | Multi-view (clip-launcher + timeline, detach/pop-out) → single fixed two-axis grid (P1, P2) | Inner-shadows, bevels, gloss, neon, brushed-metal/wood textures |
| State = luminance/weight shift on the element itself, co-located (P3, P6) | Full theme/hue/Detail-Level + Bitwig contrast triplet → **respect OS light/dark + high-contrast + reduce-motion only**; no theming engine, one honest density (P7, P8) | Photographic rack-skins, physical toggle switches |
| Direct manipulation, one consistent grammar, immediate honest feedback (P5) | Self-documenting map-mode → discoverable, *never* hidden (always-visible-state rule binds) (P5, P9) | Plugin-faceplate / VST-hero framing |
| Keyboard-first accelerators (P9); adaptive live-vs-deep detail (P4) | — | — |

> **Caveat — borrow the interaction model, not the device chrome, not the palette.** These tools are a model
> *only* at the chrome-recedes application layer. Their **device panels** (knobs, faders, VU/lamp glows,
> bevels, textures) are exactly the D7.4 / `--aqua-*` exclusion set — ergonomically wrong under a mouse, zero
> information value, and would break the locked chrome-stays-flat-and-readable-over-Hydra constraint. And we
> are **Solarized**: we take the *discipline* hue=role, never Ableton's/Bitwig's orange-blue-grey palettes —
> every color stays a named `--orch-*` token. Treat Bitwig especially as an *aspirational, partly-flawed*
> ethos (its own teardown flags over-used dividers/inner-shadows and inconsistent greys), not a layout to clone.

**Citable-spec note (Ableton has one; Bitwig does not).** Of the two, only **Ableton** publishes anything
spec-like: the **Max for Live Production Guidelines** (Ableton, official, on GitHub) — authoritative but
**device-scoped** (it governs Max for Live *device* UIs, not the whole DAW). Its concrete rules — whole-pixel
widget sizing, **Ableton Sans**, dynamic colors that follow the active Live theme + legibility checked across
all themes, symmetric left/right margins, no size-flash on load, correct disabled-state colors —
independently echo decisions in this doc (crisp rendering; the Solarized `--orch-*` role tokens + OS
light/dark respect; the alignment/spacing contract). **Bitwig**
publishes no design system: everything cited for it below is **observed-design** (user guide + independent
teardowns), not a spec. The rest of this doc cites true published standards (Apple HiG, WCAG, NN/g); the DAW
material stays a *reference layer*, with Ableton's M4L guideline the one genuinely citable item in it.

**Sources.** Ableton Live 12 Reference Manual — Session View / MIDI & Key Remote Control / Theme & Colors
customization; Nenad Milosevic, *Ableton Live redesign* (flat/dark ethos, Detail-Level density); Eric Carl,
*Ableton Live and Designing for Authenticity* ("a slider is just a line"; "window management has nothing to
do with being a musician"). **Ableton (official): *Max for Live Production Guidelines*** —
github.com/Ableton/maxdevtools (device-scoped UI spec: whole-pixel widgets, Ableton Sans, theme-following
dynamic color, symmetric margins, no load-flash); *Push 2 MIDI & Display Interface Manual* —
github.com/Ableton/push-interface (hardware/display protocol, not visual UX); *Branding & Trademark
Guidelines* (brand, not UX). Bitwig Studio User Guide — *Anatomy of the Window* (single-window header/body/
footer; active tab bright-white; blue=info, red=error), *Unified Modulation System* (targets turn green),
*Introduction to Devices* (selected = brightened header), *Dashboard* (contrast-only settings); CDM —
*Bitwig themes / 4.1 color palettes* (one curated scheme + contrast controls; color-as-coding); cirrhoz,
*Bitwig Studio Refurbished* teardown (inner-shadow/divider clutter critique); truematter, *Designing with
White Space* (group boundaries + active space over whitespace bloat).

---

## 2. Spatial model

### One fixed two-axis grid

The Orchestrator is a single fixed two-axis CSS grid — **no floating/overlapping panels, no z-shuffling
between content panes**. The spatial frame is **state-invariant across visits**; only content and status
*within* fixed slots change.

- **Horizontal axis (columns, `OrchestratorView.css:77`):** a LEFT reference rail
  `minmax(240px, var(--ref-panel-width, 320px))` holding the tabbed **Presets / API** panel (the **Library
  escape is global navigation, never a tab** — `OrchestratorView.tsx:62-65`, wrapper is not `role='tablist'`),
  and a RIGHT work column `minmax(0, 1fr)`. The rail is ONE fixed slot whose tabs swap Presets↔API in place;
  they are co-located peers sharing the rail, never two competing regions.
- **Vertical axis (rows, the right column):** **Stage on TOP, Code on BOTTOM.**

Grid summary: the reference rail is on the left; Local Preview is top-right and dominant; the Code editor is
directly beneath it. The Stage holds Local Preview alone — no reserved Player-output surface beside it (Option
A; see §2 "Stage is permanently single-preview").

> **Anchor honesty.** The columns (`OrchestratorView.css:77`) and the role-variant row-span swaps
> (`.containerOperatorStageExpanded .stageDock { grid-row: 1/3 }`, `OrchestratorView.css:192`) are
> existing-and-clean and are ratified here. The Host *row ratio* (`OrchestratorView.css:78`) is currently
> **inverted** — see Stage≥Code below — and is the one spatial bug this direction must fix.

### Stage ≥ Code invariant + chosen ratio (OQ-4.1)

Today `OrchestratorView.css:78` is `grid-template-rows: minmax(320px, 44dvh) minmax(0, 1fr)` — the `1fr`
growth share goes to **Code** and Stage is capped at 44dvh, inverting the locked Stage-first hierarchy.
Operator/Browse already give Stage the full column, so Host is the lone violator.

**Decision (OQ-4.1 — option c SHIPPED 2026-06-12, superseding the option-b static clamp):** for
`hostSplit`, set

```css
grid-template-rows: minmax(0, 1fr) clamp(12rem, var(--code-dock-height, 30dvh), 50dvh);
```

Stage row takes the `minmax(0,1fr)` growth share; the Code row is operator-resizable through
`--code-dock-height` but stays CSS-bounded: 12rem floor, **50dvh ceiling so Stage ≥ Code at every
desktop height**, and the 30dvh default applies when no preference is stored. The splitter
(`.codeDockResize`, phase-21) is a focusable APG window-splitter — pointer drag plus
Arrow/Home/End with `aria-value*` semantics — and its height persists under
`orchestratorCodeDockHeight` as OQ-1.2 inert view-shape. The rail separator carries the same
keyboard pattern. Both splitters are absent on mobile (tab-switched panels share no boundary).
**Static check:** render-test asserts host grid track 1 = `minmax(0,1fr)` and track 2 = a bounded
var-clamp, never `1fr`; render test asserts both separators are focusable with value semantics.

### Stage is permanently single-preview (OQ-2.1, Option A)

Owner decision 2026-06-04: the Orchestrator does not surface a copy of the real audience output. `.stageFrame`
holds Local Preview alone — a single centered object (`StagePanel.css:192`), `grid-template-columns: minmax(0,
1fr)`. There is no reserved second cell, no presence-gated two-column template, and no inset poster. The real
Player retains its own audience output; Option A declines to mirror it here. **Static check:** render-test
asserts `.stageFrame` is single-column with no second-cell node and claims no `Player Output` label.

### Elevation / depth — `--orch-z-*` scale + border/shape/label-only grammar

Both preview objects, the docks, and all static chrome share the **same z-floor**; only popovers/sheets/
banners rise. Depth is carried by **border, shape, and label only — never shadow.** Local Preview sits at the
shared z-floor; only popovers/sheets/banners rise above it.

Add the named scale to the `.container` token block (`OrchestratorView.css`, near `:42-60`) and migrate every
magic z-index:

| Token | Value | Role | Migrates (file:line, current literal) |
| --- | --- | --- | --- |
| `--orch-z-shell` | `1` | default stacking floor | — |
| `--orch-z-dock` | `10` | refPanel, preview status overlay | `OrchestratorView.css:95` (10); `HydraPreview.css:26` (10) |
| `--orch-z-resize` | `11` | refPanel resize separator | `OrchestratorView.css:212` (11) |
| `--orch-z-picker` | `20` | PresetPicker inline menu | `PresetPicker.css:33` (20) |
| `--orch-z-scrim` | `90` | mobile sheet backdrop | `OrchestratorView.css:420` (94) |
| `--orch-z-sheet` | `95` | mobile refPanel sheet | `OrchestratorView.css:408` (95) |
| `--orch-z-toolbar` | `100` | mobile toolbar | `OrchestratorView.css:239` (100) |
| `--orch-z-banner` | `110` | remote-update banner + true popovers | `OrchestratorView.css:338` (110) |
| `--orch-z-modal` | `120` | modals/dialogs (reserved, no current consumer) | — |

> **Naming note (reconciles the charter z-list label):** the charter's `banner 95` rung is renamed here to
> `--orch-z-sheet 95` (the 95 literal is the mobile sheet) and the remote-update **banner** keeps `110`
> (`--orch-z-banner`). This is more source-accurate than the charter's draft labels; the *values* are
> unchanged.

**Shadow rule (verified true in-tree):** `--orch-shadow` is consumed today only by `.panel` popover
(`PresetPicker.css:43`), `.orchestratorModal` (`PresetBrowser.css:225`), and the drag-lift
`.folderDragging`/`.presetDragging` (`PresetTree.css:200,205`). Static chrome carries zero shadow. Keep it
that way.

**Static check:** extend `orchestratorColorAudit.test.ts` to assert (1) no bare numeric `z-index:` literal
exists across the audited Orchestrator CSS files outside the `--orch-z-*` definitions, and (2)
`var(--orch-shadow)` / `var(--aqua-shadow)` (and any multi-axis, non-`inset` drop shadow) appears only on the
popover/modal/drag-lift allowlist. **Do NOT assert on raw `box-shadow`** — the inset focus rings and
Selected-accent rails (`PresetTree.css:243`, CI-locked at `orchestratorColorAudit.test.ts:173`) are
`box-shadow` and must survive.

---

## 3. Resolved decisions

Tags: **RESOLVED** = decided here; **HONORED** = already-resolved upstream, restated and not re-opened;
**RATIFIED** = a taste/irreversible call surfaced in §6 and confirmed by the user on 2026-06-01 (at the
recommended option; the §1 visual-personality direction was re-anchored on the physical-object reference per
review — see §1).

| OQ / D | Call (decisive) | One-line rationale | Conf. | Rev. | Tag |
| --- | --- | --- | --- | --- | --- |
| **OQ-1.1** | No programmatic focus on entry; add one documented `/` accelerator to the Presets search (only when focus is not in a text field/editor) via `aria-keyshortcuts` + in-field hint. | Auto-focusing an input on load reassigns the AT landmark (WCAG SC 3.2.1); accelerator is additive (`useOrchestratorWorkspace.ts:152`, `PresetBrowser.tsx:653-659`, `CodeEditor.tsx:342`). | high | easy | RESOLVED |
| **OQ-1.2** | Persist ONLY inert view-shape (ref-panel width, expanded-folder set, active rail panel, preview buffer) under one versioned fail-safe key. Persist nothing in the truth lane. | Restores furniture without manufacturing a stale Player/applied claim; Selected/Loaded seed null, applied re-derived live (`PresetBrowser.tsx:84-85,156-164`). | high | easy | RATIFIED |
| **OQ-1.3** | No command palette. Keep per-surface labeled controls; accelerators (`Cmd/Ctrl-Enter` send gated to `canLiveCode`, `/` to search) are additive, role-scoped, in one documented table. | A palette is a hidden modal mode (Principle 5) and only e2e-verifiable; duplicates `orchestratorCapabilities.ts:48-69` authority. | high | easy | RESOLVED |
| **OQ-2.1** | Resolved by Option A (owner decision 2026-06-04): `.stageFrame` is permanently single-preview; no reserved Player-output surface, no presence-gated 2-col template. | The Orchestrator surfaces no copy of the real audience output (see §2). | high | moderate | RESOLVED |
| **OQ-2.2** | Borrowing Player MP4 changes ONLY the `.statusUsingPlayerMp4` source capsule (cyan tint + `Preview using Player MP4`); frame/radius/z-tier and primary `Local Preview` label stay constant. No per-source "approximate" qualifier. | A stronger frame would imply output authority — forbidden; the capsule already states the source delta (`HydraPreview.css:50-54`, `orchestratorPresentationModel.ts:83`). | high | easy | RESOLVED |
| **OQ-3.1** | Dense row + reserved fixed-height badge lane, NOT a card/split-lane; Gallery painted on-row; no thumbnail. | Constant lane geometry → no mid-set reflow; thumbnail would imply output truth (`PresetTree.css:2,266-273`). | high | hard | **HONORED** |
| **OQ-3.2** | Single-click = Select; explicit Load button = Load (local only, never broadcasts); Space = Send; **Enter = Select** (not Load). | State Truth Model forbids collapsing Selected/Loaded; `PresetTree.tsx:317,339-368`; Enter→Select is the tested binding (`PresetTree.test.tsx:143`). | high | moderate | **HONORED** |
| **OQ-3.3** | `Applied on Player` badge is strictly binary — present iff derived key == row key, drops instantly on mismatch; no decay/timer. Superseded messaging stays on the strip Remote-update pill. | Honest-by-construction (`presetOperatorUx.ts:48-67`, `PresetTree.tsx:278`); a decaying tint reads as a competing Player claim. | high | easy | RATIFIED |
| **OQ-4.1** | `hostSplit` rows = `minmax(0,1fr) clamp(12rem, var(--code-dock-height, 30dvh), 50dvh)`; splitter SHIPPED 2026-06-12 (phase-21: drag + APG keyboard, persisted, bounded). | Stage ≥ Code at every desktop height via the 50dvh ceiling (§2). | high | easy | RESOLVED (option c shipped) |
| **OQ-4.2** | Mobile tab-away with unsent edits shows ONLY the non-textual Presets/Code-tab dot (warning tone), no count, no `Local edits` wording; strip pill stays sole text owner. | One-owner-per-label; a count is quasi-textual duplication (`OrchestratorView.css:229`, operator-journey §3). | high | easy | RESOLVED |
| **OQ-5.1** | Buffer selector = full APG radiogroup (roving tabindex, arrow selection-follows-focus, Home/End) + a non-color active cue: `.bufferButtonActive::after { content: '●' }`. | DOM announces radiogroup but ships tab-per-button today; active state is cyan-fill-only — breaches color-never-sole-signal (`StagePanel.tsx:108-121`, `StagePanel.css:176-180`). | high | easy | RESOLVED |
| **OQ-5.2 + OQ-9.3** | Quiet-by-default on fine-pointer (`opacity: var(--orch-quiet-opacity, 0.55)` + `pointer-events:auto`), intensify on hover/`:focus-within`; **always full-opacity on coarse-pointer/touch and keyboard**, gated by `@media (hover/pointer)` capability queries, NOT width. No kebab/overflow. | Today's `opacity:0; pointer-events:none` (`PresetTree.css:104-106`) makes folder Delete/Set-player unreachable on touch at desktop width; width-gated mobile rule (`:367-371`) strands touch laptops. | high | easy | RESOLVED |
| **OQ-6.1** | Strip broadcast pill is SOLE owner of `Sending/Synced/Failed` TEXT; just-sent row gets a row-local NON-textual ack (spinner→check/fail glyph) + mobile Presets-tab dot. Host send-group also drops to non-textual; extend ownership audit to ingest the CodeEditor send-group strings — same slice. | One-owner-per-label; `CodeEditor.tsx:508` `Synced` collides with the strip and is audit-invisible today (`orchestratorStatus.ts:64`, `orchestratorStatusOwnership.test.ts:70`). | high | moderate | **HONORED** |
| **OQ-6.2 / D6.2** | Keep cameraPipeline in the Stage header right group; **relabel** `Camera Off/Partial/Live` → `Source: no camera` / `Source binding partial` / `Source bound`; extend `orchestratorStatusOwnership.test.ts` with a `stageCameraBinding` surface — SAME slice (relabel-before-audit). | `Camera Live` (`StagePanel.tsx:102`, `hydraPreviewUtils.ts:9`) leaks the forbidden term `Live` and is audit-invisible; relabel removes the leak + closes the coverage gap. Update `hydraPreviewUtils.test.ts:45/57/69` in-slice. | high | moderate | RATIFIED |
| **OQ-6.3** | Keep the locked three-row mobile Stage-header wrap; width-bound the camera card (`flex:1 1 auto; max-width:100%; min-width:0` + ellipsis on label & detail); buffer radiogroup keeps its own touch-sized row; raise the two sub-floor camera literals. | Collapsing pills or pinning a preview-overlay status line both fight the locked Stage Header Contract (`StagePanel.css:86,94,227-230`, style guide :253-257). | high | easy | RESOLVED |
| **OQ-7.1** | Single hard floor of `--orch-text-meta` 0.75rem everywhere; no sub-0.75rem tier; migrate every sub-floor literal up. | One audit-able number beats a two-tier exception list on an e2e-blocked surface; 12px is the comfortable dim-room minimum (`OrchestratorView.css:71`, `StagePanel.css:94`). | high | easy | RESOLVED |
| **OQ-7.2** | Per-control policy table requiring **effective ≥44px** on the mobile breakpoint via painted-size-OR-hit-slop(`::before`); never inflate painted size on fine-pointer; pills excluded; extend the hit-slop audit to the next-smallest controls. | Hit-slop is the proven pattern (`orchestratorColorAudit.test.ts:191-192`); re-anchored to the real `max-width:980px` breakpoint (no `pointer:coarse` query exists in-tree). | high | easy | RESOLVED |
| **OQ-8.1** | Hybrid: ship the docs pass/fail matrix now + extend the audit to compute WCAG contrast on **flat (non-`color-mix`) token pairs** via `resolveTokenValue()`; defer composited tint pairs to docs-checklist; assert glyph-on-tint against base03/base02 + tinted backdrop as the floor. | Flat-pair math needs no browser (`orchestratorColorAudit.test.ts:55-74,140-154`); docs-only repeats the silent-fallback bug class. | high | easy | RESOLVED |
| **OQ-8.2** | Keep ONE cyan live-signal role (`--orch-synced`=`--orch-live`) shared by synced + camera, disambiguated by text + order + icon; green `--orch-success` confirm tick; **no new `--orch-camera`/magenta token** (§4.11 authors the role + states the no-camera-token decision). The "Cam badge blue" inconsistency no longer exists (`.badgeCam` already routes `--orch-live`, `PresetTree.css:92-95`). | Camera is already cyan; the only real cleanup is `.cameraPipelineLive` reaching past the role layer to raw `--orch-cyan` (`StagePanel.css:104-109`) — fold into the D6.2 slice. | medium | moderate | RATIFIED |
| **OQ-8.3** | Two-tier fills (§4.11 tone recipe): `--orch-tone-fill` 14% for informational status; `--orch-tone-emphasis-fill` 22% for ALARM only (Failed / Camera error); canonical `--orch-tone-border` 55%. No brighter-than-22% fill; no second-grammar left-border accent. | Uniform 14% under-reads alarm on luminance-flat Solarized; >22% competes with bright Hydra (`OrchestratorStatusStrip.css:62-83`). | medium | easy | RATIFIED |
| **OQ-9.1** | Tiered budget: Tier-0 ≤100ms synchronous ack (render-test on dispatch); Tier-1 ~1000ms progress threshold; Tier-2 **4000ms** = locked stalled boundary (`sending`→`Failed`, never frozen); Synced auto-clears at 1500ms. | The 4000ms expiry + 1500ms reset already exist (`useOrchestratorWorkspace.ts:419-421,432-438`); names the tiers, binds the magic numbers. | high | easy | RESOLVED |
| **OQ-9.2** | Keep the mechanical `<ownerCategory>: <visibleLabel>` aria-label derivation; visible label is single source; add a static assertion that every pill routes through the helper (no hand-authored aria literals). | Shipped + tested (`OrchestratorStatusStrip.tsx:18-23`, `.test.tsx:52-54`); a hand-authored string is a drift-prone second copy. | high | easy | RESOLVED |
| **OQ-9.3** | (folded into OQ-5.2) capability-query reveal: always-visible on coarse/touch + `:focus-within`; quiet-but-clickable hover-intensified on fine-pointer desktop. | See OQ-5.2. | high | easy | RESOLVED |

> **Stale-list reconciliation (charter-flagged internal inconsistency).** The committed
> [orchestrator-style-directions.md](orchestrator-style-directions.md) consolidated open-questions list
> still shows **OQ-3.1 (#6), OQ-3.2 (#7), OQ-6.1 (#13)** as *open*, while its own Decisions section
> (`:13-20`) already records them **RESOLVED**. They are **HONORED** here. The reconciliation action is to
> prune those three from that bottom list (and flip OQ-3.1's `:139` heading from `OPEN (FIRM)` to
> `DONE (maintain)` — D3.2's badge order is already shipped in code; see "Doc-truth reconciliation" below).

### ADR blocks for higher-stakes / taste calls

**ADR — Spatial elevation: border/shape/label, never shadow-for-depth (elevation scale)**
*Context:* the Stage and docks could be tempted to use a drop shadow to "lift" the preview frame.
*Decision:* depth is carried by frame style and label only; static chrome and the preview frame stay on the
base03 z-floor; `--orch-shadow` stays popover/modal/drag-lift only. *Consequences:* a flat plane survives
color-blindness and bright Hydra bleed; an audit can enforce "no shadow on static chrome" cheaply.
Reversible-moderate.

**ADR — `Applied on Player` stays binary (OQ-3.3)**
*Context:* a superseded preset could decay with a "recently applied" tint. *Decision:* strictly binary,
drops instantly on key mismatch; superseded messaging is owned solely by the strip Remote-update pill.
*Consequences:* no soft claim that reads as "still kind of live" (a latent `FORBIDDEN_PREVIEW_TERMS`-adjacent
overclaim); no motion token / reduce-motion guard needed; reconsider only behind a fresh ADR introducing a
Player-output surface that could prove it. Reversible-easy (a tasteful decay could be added later behind such proof).

**ADR — Cyan stays the single live-signal role; no new camera hue (OQ-8.2)**
*Context:* the charter proposed splitting camera onto magenta to fix "cyan overload". *Decision:* keep one
cyan `--orch-live` role for synced + camera, disambiguated by text + strongest-truth order + icon; the
charter's "Cam badge is blue" premise is **stale** — `.badgeCam` already routes `--orch-live` (cyan)
(`PresetTree.css:92-95`, locked at `orchestratorColorAudit.test.ts:161`). The only real cleanup is
`.cameraPipelineLive` reaching past the role layer to raw `--orch-cyan` (`StagePanel.css:104-109`), folded
into the D6.2 relabel slice. *Consequences:* no new palette-family-adjacent move; no audit-test breakage from
a `.badgeCam` repoint; disambiguation rests on text + order (already locked) not hue. The completed role
layer that carries this decision — `--orch-synced`(cyan) shared with camera, and the explicit "no
`--orch-camera` token" — is authored in **§4.11**. Reversible-moderate.
**This is a taste call (§6) because medium-confidence palette semantics deserve explicit ratification.**

**ADR — Two-tier tint strength (OQ-8.3)**
*Context:* on luminance-flat Solarized a uniform 14% fill makes Failed read the same weight as Synced.
*Decision:* keep 14% for informational status, add `--orch-tone-emphasis-fill` 22% for alarm only (Failed,
Camera error); reject a brighter-than-22% fill (competes with bright Hydra) and a left-border accent (second
emphasis grammar). The three mix tokens (`--orch-tone-fill` / `--orch-tone-emphasis-fill` / `--orch-tone-border`)
and their usage shape are authored in **§4.11**. *Consequences:* alarm pops without ornament; one shared
recipe replaces the hand-copied 35/42/45/50% border + 10/12/14/16% fill drift; cannot be empirically tuned
(e2e blocked) so 22% is a human visual call. Reversible-easy.

**ADR — cameraPipeline relabel + audit extension, same slice (OQ-6.2 / D6.2)**
*Context:* `Camera Live` (pipeline source-binding) collides with `Camera live` (strip relay) AND leaks the
forbidden term `Live`; the one-owner audit derives camera labels only from the strip, so the pipeline is
invisible to it. *Decision:* relabel the pipeline to `Source bound`/`Source binding partial`/`Source: no
camera` and add a `stageCameraBinding` surface to the ownership audit IN THE SAME SLICE
(relabel-before-audit, or the new surface trips on the legacy string); also update `hydraPreviewUtils.test.ts`
(asserts `Live`/`Partial`/`Off`) and add a journey-table row for the new owner. *Consequences:* removes the
forbidden-term leak, closes the coverage gap, keeps the diagnostic ("missing: hydra source bind") that a
merge into the strip would lose. Reversible-moderate. **Taste call (§6) — moderate-reversibility relabel of a
user-facing string.**

### Doc-truth reconciliation (bookkeeping, no code change)

D3.2 (per-row badge + accessible-name order, strongest-truth-first) is **already satisfied in code**:
the rendered glyph circles paint `Applied on Player → Loaded in preview → Selected → Start → Cam`
(`PresetTree.tsx:390-394`; the Gallery badge was dropped, so it is **not** a rendered glyph), and the row
accessible name composes the same strongest-truth order with `Gallery` appended as an accessible-name-only
term (`PresetTree.tsx:317-328`); the regression guard already exists
(`PresetTree.test.tsx:572-624,626-657`). The stale prose at
[orchestrator-style-directions.md](orchestrator-style-directions.md)`:139-140,:169` (claims the JSX paints
`Selected → Loaded → Applied …` and a reorder is owed, citing the old `:326-330`) should be corrected to
"verified at HEAD: maintain this order; guard exists." Record D3.2 as **DONE (maintain)**.

---

## 4. System specs

Each spec gives the rule, concrete tokens/values, and the static verification (e2e is blocked).

### 4.1 Typography ramp (D7.1, OQ-7.1)

A semantic `--orch-text-*` ramp aliasing the existing raw `--text-*` rungs (`OrchestratorView.css:71-74`);
do **not** invent new sizes. All `rem` (Dynamic-Type-relative against the 16px root, `:84`).

| Token | Size / line-height | Weight | Role |
| --- | --- | --- | --- |
| `--orch-text-meta` | `0.75rem` / `1.3` | 500 | **the floor** — secondary metadata + pill/badge text |
| `--orch-text-body` | `0.875rem` / `1.45` | 400 (labels 600) | default body / labels / notices |
| `--orch-text-control` | `1rem` / `1.4` | 500 | interactive control text, search inputs |
| `--orch-text-title` | `1.125rem` / `1.3` | 600 | **Stage title only** — binds the dead `--text-lg` rung |

Weights never below 400; **emphasis carried by weight, not size or color**. Hard floor =
`--orch-text-meta` 0.75rem; no sub-0.75rem tier (OQ-7.1). Migrate sub-floor literals up: `StagePanel.css:86`
(0.62rem) and `:94` (0.58rem) → `--orch-text-meta`; the ApiReference 0.58–0.69rem cluster → `--orch-text-meta`
(metadata) or `--orch-text-body` (labels/headings; e.g. `.searchLabel` clamps UP); PresetPicker 11px →
`--orch-text-meta`, 12px → 0.75rem-equivalent, 13px → `--orch-text-body`.
**Static check:** extend `orchestratorColorAudit.test.ts` with a font-size audit over the Orchestrator
component+view files that **normalizes px→rem** (fail any computed `< 0.75rem`, i.e. `< 12px` or `< 0.75rem`)
and a "new code references an `--orch-text-*` token" rule. (Note: 12px == 0.75rem at root, so 12px literals
are floor-equivalent, not offenders.) `.container`-scoping is not literal — scope by source-file path, as the
color audit already does.

### 4.2 Contrast target matrix (D8.4, OQ-8.1)

Targets LOCKED: **≥4.5:1 body text; ≥3:1 large text / UI / borders / focus.** Audited context dark Solarized.
Surfaces (resolved flat backdrops): **S0** = `--orch-bg` (base03 `#002b36`), **S1** = `--orch-surface` (base02
`#073642`). Rule: **fills (`color-mix`) are background-only and never numerically measured; the readable
element is asserted as a flat pair.**

| Glyph / text role (flat hex) | Floor | Conservative backdrop | Result |
| --- | --- | --- | --- |
| `--orch-text` base1 `#93a1a1` | 4.5 (body) | S1 (lighter surface) | PASS (S0 5.x / S1 4.86) |
| `--orch-text-strong` base2 `#eee8d5` | 4.5 | S1 | PASS |
| `--orch-muted` base0 `#839496` | 3 (large/secondary ONLY — forbidden as body on S1) | S1 | S0 4.75 / **S1 4.11** → large-only |
| `--orch-live` cyan `#2aa198` | 3 (UI/large glyph) | S1 + 14% tint | PASS (~4.1) |
| `--orch-success` green `#859900` | 3 | S1 | PASS (~4.1) |
| `--orch-warning` yellow `#b58900` | 3 | S1 | PASS (~4.05) |
| `--orch-applied` violet `#6c71c4` | 3 | S1 + tint | **FAIL (~2.9)** → hue on border/icon, glyph text in `--orch-text` |
| `--orch-camera`→`--orch-live` (cyan) | 3 | S1 | PASS |
| `--orch-danger` red `#dc322f` | 3 | S1 + tint | **FAIL (~2.8)** → hue on border/icon, glyph text in `--orch-text` |
| `--orch-focus` blue `#268bd2` (border/focus) | 3 | S1 | PASS (~3.5) |

> **Conservative-backdrop logic (corrected):** every text/role color is *lighter* than both surfaces, so the
> worst case is the **lighter** backdrop (S1 / base02, and any 14% tint over base03 which is lighter still) —
> **not** S0. Asserting glyphs against S0 only would rubber-stamp violet/red at ~2.8–2.9:1. Where a role-hue
> glyph fails 3:1 on S1/tint, use the charter's locked escape hatch (style guide :109 "adjust weight,
> surface, or label placement before adding a color"): render the hue on the border/icon and the glyph text
> in `--orch-text`. Because color is never the sole signal, this loses no meaning.

**Static check:** extend `orchestratorColorAudit.test.ts` (fourth check) — resolve each text/role token and
its surface via `resolveTokenValue()` to `#hex`, compute WCAG relative-luminance contrast in Node, assert the
matrix; flag `--orch-muted`-as-body on S1 as a forbidden pairing. `color-mix`/transparent composited pairs
stay docs-checklist until e2e unblocks.

### 4.3 Motion tokens + reduce-motion contract (D7.2, D7.3)

Add to the `.container` token block:

```css
--orch-motion-fast: 120ms;   /* hover/focus/press tints, badge ack */
--orch-motion-base: 180ms;   /* panel/pill state transitions, sheet open */
--orch-motion-slow: 250ms;   /* mobile bottom-sheet, larger reveals */
--orch-ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
```

Migration buckets (corrected so the 120ms literals do not silently slow to 180ms):
`0.05s/0.15s/0.18s/120ms → fast`; `0.2s/0.22s/180ms → base`; `0.25s → slow`. The 1.2s skeleton shimmer stays
a named keyframe (the one exempt looping/determinate affordance) and is killed under reduce-motion. All
easings collapse to `--orch-ease-standard`; keep `linear` only as the shimmer timing-function.
**Allowed-motion policy:** motion only communicates state change or spatial origin; zero ambient/decorative
animation.

**Sanctioned size-neutral hover/focus micro-lift (badge circles).** The collapsed badge glyph circles
(§4.11) get an in-lane hover/focus response that is **geometry-constant by construction** so it can never clip
the fixed badge lane or reflow rows: `filter: brightness(1.12)` plus an inward `box-shadow: inset 0 0 0 1px
color-mix(in srgb, currentColor 70%, transparent)` (`PresetTree.css:96-102`), triggered on
`.presetRow:hover/:focus-visible/:focus-within`. It transitions `filter` + `box-shadow` only, both on
`--orch-motion-fast` `--orch-ease-standard` (`PresetTree.css:72-74`) — **no transform, no width/height/margin
change, no animated font-weight**. The blanket reduce-motion rule neutralizes its transition (the lift
applies instantly, no movement). This is the one sanctioned hover emphasis on the badge lane.

**Reduce-motion (blanket + per-file, because this is CSS Modules):** add ONE shell-scoped rule in
`OrchestratorView.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .container *, .container *::before, .container *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

This works via runtime descendant-cascade (CodeEditor/PresetTree/PresetBrowser render under the shell
`.container`). It does **not** let us delete the four existing per-file guards
(`OrchestratorView.css`, `PresetBrowser.css`, `PresetTree.css`, `CodeEditor.css`) — the `.container` class is
build-hashed and component modules define their own scoped classes. **Static check:** the new audit asserts
(a) the blanket block exists in `OrchestratorView.css`; (b) every component CSS file declaring an
`animation`/`transition` also declares a `prefers-reduced-motion` block; (c) duration literals are
`var(--orch-motion-*)` (shimmer exempt). **Migrate the locked per-file assertions in the SAME slice**
(`orchestratorColorAudit.test.ts:184-188` literally asserts the CodeEditor `@media` block + PresetBrowser
`animation:none`; PresetTree's `@media` is also asserted) or the suite goes RED.

### 4.4 Elevation scale

See **§2 → Elevation / depth**. The `--orch-z-*` scale (shell 1 / dock 10 / resize 11 / picker 20 / scrim
90 / sheet 95 / toolbar 100 / banner 110 / modal 120-reserved), the migration map, and the
shadow-only-on-popover/modal/drag-lift grammar live there. Static check: the `--orch-shadow`/z-index audit
described in §2.

### 4.5 Latency / progress patterns (D9.5, OQ-9.1)

**Response-time budgets.** Tier-0 ack **≤100ms**, rendered synchronously on dispatch (the `Sending…` button
flip at `CodeEditor.tsx:501`, driven by `setSendState(prev => startHydraSend(...))` at
`useOrchestratorWorkspace.ts:189-195` *before* the socket dispatch); Tier-1 progress threshold **~1000ms**
(determinate-leaning hint, never a spinner that later morphs); Tier-2 **4000ms** = the LOCKED stalled boundary
(`expireHydraSend`, `views/orchestratorSendState.ts:58-64`, guards `status==='sending'` so a synced/error
transition cancels it) where `sending` MUST resolve to `Failed` — never a frozen pending. Synced auto-clears
at **1500ms** (`useOrchestratorWorkspace.ts:419-421`).

**Pattern selection table.**

| Pattern | When | Anchor |
| --- | --- | --- |
| Optimistic + non-textual ack | Send / row-Send / buffer-switch / local mutations (default) | OQ-6.1 row ack |
| Skeleton | first async CONTENT load with unknown shape | `PresetBrowser.css:128-173`, `PresetBrowser.tsx:673` (`role=status` `aria-live=polite`) |
| Bounded spinner | transient row/send ack between Tier-0 and resolution; never the primary loader, never page-blocking | — |

**No-morph rule:** an indeterminate indicator MUST NOT animate-morph into a determinate bar; cross-fade by
swapping elements (opacity), never reshaping one (consistent with the locked OQ-3.1 no-reflow badge lane).
The `Send → Sending…` swap is text-only — no spinner injected into the button.

**Debounce** is a separate latency value, **not** bound to a motion token: keep the existing **150ms** preview
re-render / search debounce (`useOrchestratorWorkspace.ts:466`); coupling it to `--orch-motion-base` would let
a motion retune silently change perceived responsiveness. Promote to a named latency constant
`--orch-debounce-input: 150ms` (do not debounce Select/Load — those are instant per OQ-3.2). Remote-sync
coalescing stays on rAF.

**Stalled ownership:** the strip pill owns the failure TEXT (`Failed`, `orchestratorStatus.ts:66`). Reconcile
the CodeEditor send-group `Send failed` (`CodeEditor.tsx:508`) in the OQ-6.1 slice so one failure outcome is
not two strings across two surfaces.
**Static check:** render-test asserts the `Sending…` ack element is present in the first post-dispatch render
(no timer); timer-test asserts `sending` resolves to `error` by 4000ms (never persists).

### 4.6 Empty-state treatment (D1.5)

Empty/sparse states render **inside the panel that owns them** as quiet inline working-state text — never a
centered hero, full-surface takeover, or CTA-only screen, and never blocking the Stage. The Presets panel
keeps its toolbar + search visible above the empty notice (`PresetBrowser.tsx:636,652` render before the
empty div at `:693`). Exact strings stay sourced from `presetEmptyState.ts` (`No saved visuals available for
this room.` `:19/:42`; `No visuals match your search.` `:35`; `Party preset folder has no saved visuals.`
`:39`) and policy notices from `presetOperatorUx.ts` (`Room policy blocks collaborator visual sends.` `:96`,
`Gallery presets are preview-only.` `:144`). Style with **existing defined tokens only**: `color:
var(--orch-muted)`, `font-size: var(--orch-text-meta)` (matching the current `.empty` rule,
`PresetBrowser.css:104-109`). Do **not** introduce `--orch-text-body` as a literal here, and do not conflate
`.empty` with the bordered sibling `.policyNotice` (`:111-118`). No illustration, no "Create your first
preset" button (host New Folder/Save already live in the always-visible toolbar). The notice is a status
line, not an action surface. **Static check:** the no-hero entry guard (§5) covers PresetBrowser/StagePanel,
not only the shell.

### 4.7 Iconography (D3.6, D5.x)

Two icon mechanisms exist and the spec names both. The SVG `Icon` component (`src/components/Icon/Icon.tsx`)
takes a px `size` prop and does NOT inherit font-size — pin it to the ramp (14px inline-with-text / 16px
standalone management); text-glyph controls (`★☆✎×⧉`) use `font-size` off the `--orch-text-*` ramp (cap
`1rem` inline / `1.125rem` standalone). Stroke/fill = `currentColor` off the role token (already true:
`Icon.tsx` renders `fill='currentColor'`; management glyphs inherit `--orch-muted`). **Mandatory:** every
icon-only control carries BOTH `aria-label` AND `title` (this is *stricter* than style-guide :336 "titles
when helpful" — it supersedes it for icon-only controls). **No symbol-alone for any state-changing action:**
Load and Send remain text-bearing buttons (`PresetTree.tsx:343/357`); subordinate management verbs
(rename/move/delete/start) may be icon-only but stay quieter (`--orch-muted`) and named. Single glyph family:
the cited PresetTree mixes SVG `Icon` glyphs with Unicode emoji glyphs — record the Unicode set as a
**sanctioned allowed set** (do not assert a false "single family" that the code violates). **Cam badge glyph:**
the camcorder `VIDEO`/`mdiVideo` icon (`icons.ts:48`) is the registered Cam-state pictogram, rendered at
`size={14}` inline-with-lane via the `Icon` component (`PresetTree.tsx:36`). **`QR_CODE`
(`icons.ts:42`) is NOT an Orchestrator preset badge** — it was once the Gallery-state glyph, but the Gallery
badge was dropped (`PRESET_STATE_GLYPHS` has no Gallery entry, `orchestratorPresentationModel.ts:51-57`; the
row stops at Cam, `PresetTree.tsx:394`). It is **not orphaned**, though: it has a live consumer outside the
Orchestrator at `QRPrefs.tsx:34` (`<Icon icon='QR_CODE' />`, the room QR-code prefs surface). Keep it
registered; it is not a deletion candidate. **Static check:**
render-test that every icon-only control has an accessible name; the existing aria-label/title pattern at
`PresetTree.tsx:206-430` is the pattern.

### 4.8 Responsive breakpoint tokens

Name the breakpoints already implicit in the CSS as **documented comment-anchored constants** (no `@custom-media`/SCSS
pipeline exists — plain css-loader, no PostCSS):

| Constant | Value | Meaning |
| --- | --- | --- |
| `--orch-bp-desktop` | `980px` | desktop/mobile split (uniform `max-width:979px` / `min-width:980px` across all Orchestrator CSS) |
| `--orch-bp-narrow` | `640px` | ApiReference secondary collapse (`ApiReference.css:370`) |
| (phone target) | `~390px` | documented density-audit phone target; the locked three-row Stage-header wrap |

**JS sync (load-bearing):** the 980 split is also hardcoded in JS
(`orchestratorWorkspaceModel.ts:95`, `useOrchestratorWorkspace.ts:247/284/311/332`, `innerWidth < 980`).
The documented constant must be declared as the single source these literals reference, OR the spec asserts a
grep audit that the JS `980` and CSS `979/980` stay in lockstep. **Reflow contract (WCAG 1.4.10, no
horizontal scroll at 320px / 400% zoom):** ≥980px two-column; <980px single-column stacked (Library escape +
Stage/Presets tablist), ApiReference primary single-column collapse at 979px (`:360`) with a 640px secondary
refinement (audioStrip/actions stack); ~390px three-row Stage-header wrap keeps buffer controls above the
fold. All four reflow vertically; nothing relies on horizontal scroll.

### 4.9 Error-copy standard (D3.4, D6.1)

One voice: **short, sentence-case, says what happened and what to do, blames policy/system not the user,
never all-caps** (preset-operator-ux.md:125). Two established carriers stay the pattern: (1) the disabled-Send
`title` falls back to `sendDisabledMessage` (`PresetTree.tsx:358`) — keep `Send disabled by room policy` /
`Not in party folder` (`presetOperatorUx.ts:169/186`), generic `Send unavailable for this preset`
(`:271`) only when no specific reason exists; (2) `rowNotice` carries the constructive line near the action
(`Gallery presets are preview-only.`, `presetOperatorUx.ts:144`, rendered at `PresetTree.tsx:335`).
**Never a silent no-op:** a rejected Send produces the strip `Failed` text (one-owner) PLUS the row-local
non-textual fail glyph (OQ-6.1) PLUS resend-when-available (style guide :306). Disabled controls always expose
their reason via `title` + aria; an action is never both invisible and blocked without explanation.
**Static check:** the strings live in `presetEmptyState.ts` / `presetOperatorUx.ts` (unit-assertable); the
one-owner audit guards `Failed` placement.

### 4.10 i18n / text-length stance

**Stance (owner decision 2026-06-06): English-only, defer extraction.** The app ships no
internationalization framework (no `react-intl` / `i18next` / `intl` dependency anywhere) and all
Orchestrator copy + the ~26 `aria-label`s are inline English. The Orchestrator stays consistent with
that: **do not extract strings into a message catalog and do not adopt an i18n framework now.** Revisit
only when localization is a real product requirement (at which point the inline strings are the
extraction surface). This is a deliberate *defer*, not a rejection — so the text-length robustness
rules below **stay in force** to keep the layout i18n-ready rather than hard-blocking a future
localization. (The §4.7 icon stance — `aria-label` + `title` on every icon-only control — is already
shipped and unaffected by this decision.)

Assume any label can be **~1.5× longer** (translation / long room/preset names) and never break layout.
Reuse the established `max-width` + ellipsis clamps already on the strip (`OrchestratorStatusStrip.css:14`
13rem, `:29` 15rem, `:36` 11rem) and tree (`PresetTree.css:59` 9rem) as the pattern: status/metadata text
gets `max-width` + `text-overflow:ellipsis`, full text available via `title`. **No fixed-width labels / no
pixel-assumed layout.** **Accessible-name relationship:** the accessible name MUST contain the full
untruncated label (the row name composes the fuller semantic name `Preset <name>, <badges…>` at
`PresetTree.tsx:282-293`); where text is visually elided, `aria-label`/`title` carry the untruncated value —
never the truncated string. Status strings stay short standalone tokens (no English-word-order sentence
concatenation). **Static check:** render-test that the row accessible name contains the full name
(existing PresetTree/StagePanel render tests); the ellipsis-not-fixed-width grep is
`orchestratorI18nReadiness.test.ts` (every elided rule clamps via `max-width`, never a fixed px width).

### 4.11 Semantic role-layer completion + tone recipe (D8.1, D8.2, OQ-8.2, OQ-8.3)

The role layer is **half-built**: `--orch-primary/live/success/applied/warning/danger/focus` exist
(`OrchestratorView.css:34-40`), but the live-status state surfaces reach **past** the role layer to raw hues —
`.badgeSelected`/`.badgeStart` use raw `--orch-yellow` (`PresetTree.css:75-77`), `.badgeLoaded` uses raw
`--orch-blue` (`PresetTree.css:81-83`), `.cameraPipelineLive` uses raw `--orch-cyan` (`StagePanel.css:104-109`).
This spec **authors the missing role names** so every D3.2 state has a named role, and routes the raw-hue
consumers through them. **No new palette family** — each role aliases an existing Solarized hue already in the
`ORCH_SOLARIZED_TOKENS_START/END` block.

**Badge artifact — collapsed glyph circle, not a textual tone pill.** Each per-row state badge renders as a
fixed lane-height **glyph circle** (it reuses the `.sendAck` box geometry), NOT a text pill. The circle is
dual-channel: an `aria-hidden` non-color glyph — a grayscale-distinct letter/star (`A` Applied, `L` Loaded,
`S` Selected, `★` Start) or an `Icon`-component pictogram (`VIDEO` camcorder for Cam) — PLUS the full state
word as the accessible name and hover `title` (the decode path). The marks are single-sourced as
`PRESET_STATE_GLYPHS` (`orchestratorPresentationModel.ts:51-57`); the renderer paints the circle with
`role='img'` + `aria-label={label}` + `title={label}` and a visually-hidden in-DOM `.badgeLabel` span
(`PresetTree.tsx:24-41`, `.badgeDot`/`.badgeGlyph`/`.badgeLabel` at `PresetTree.css:58-94`). The hue rides the
tone-recipe **state class** below (`.badgeApplied`/`.badgeLoaded`/`.badgeSelected`/`.badgeCam`,
`PresetTree.css:104-127`); **color is never the sole channel** — glyph + accessible name + order carry the
meaning if hue is unavailable. Lane geometry is constant (OQ-3.1 no-reflow lane).

Add to the `.container` token block, immediately after the existing role tokens (`OrchestratorView.css:40`):

```css
--orch-synced:    var(--orch-live);    /* cyan  — broadcast Synced confirm (shared cyan live-signal, OQ-8.2) */
--orch-selected:  var(--orch-warning); /* yellow — Selected / Start (highlight-only, not yet in preview)     */
--orch-loaded:    var(--orch-primary); /* blue  — Loaded in Local Preview (local audition, not Player truth)  */
--orch-reference: var(--orch-muted);   /* base0 — reference/API rail + Gallery preview-only chrome (neutral) */
/* --orch-camera: DELIBERATELY NOT ADDED — camera routes --orch-live (cyan), OQ-8.2 ADR. */
```

**Target hue mapping + distinctness rule.** Each D3.2 strongest-truth state owns a *distinct* hue so the
badge lane is legible by hue AND order AND text (color is never sole signal):

| Role token | Aliases | Solarized hue | Owns (state) | Distinct from |
| --- | --- | --- | --- | --- |
| `--orch-applied` | `--orch-violet` | violet `#6c71c4` | **Applied on Player** (strongest truth) | all others (top of order) |
| `--orch-loaded` | `--orch-primary`→blue | blue `#268bd2` | **Loaded in preview** (local audition) | selected (yellow), synced (cyan) |
| `--orch-selected` | `--orch-warning`→yellow | yellow `#b58900` | **Selected** + **Start** (highlight-only) | loaded (blue), applied (violet) |
| `--orch-synced` | `--orch-live`→cyan | cyan `#2aa198` | **Synced** broadcast confirm + **Camera** binding | loaded (blue) — adjacent, so pair with icon |
| `--orch-success` | `--orch-green` | green `#859900` | **Send confirm tick** (transient ack) | warning (yellow) |
| `--orch-reference` | `--orch-muted`→base0 | base0 `#839496` | reference rail, **Gallery preview-only** chrome | all hues (it is neutral, not a state) |
| `--orch-danger` | `--orch-red` | red `#dc322f` | **Failed / Camera error** (alarm) | warning (yellow) |

Distinctness rule (audit-enforced): `--orch-applied`, `--orch-loaded`, `--orch-selected`, `--orch-synced`,
`--orch-success`, `--orch-danger` MUST resolve to **six different** Solarized hues. The single intentional
hue-share is `--orch-synced` = `--orch-live` (camera + broadcast confirm both cyan, OQ-8.2) — they are never
adjacent in the badge lane and are always paired with distinct icon + text, so the shared hue is not the sole
signal. `--orch-loaded` (blue) and `--orch-synced` (cyan) are perceptually adjacent; where both can appear on
one row they are separated by order (Loaded above Synced-adjacent Cam) and icon.

**One tokenized tone recipe (kills the hand-copied drift).** The status-tone fills/borders are authored today
at drifting strengths (cyan borders at 35/42/55%, fills at 10/12/14/16%; yellow 16%/42%, blue 16%/42%/50%).
Replace with **three mix tokens** any tone class composes off its role hue:

```css
--orch-tone-fill:          14%;  /* informational status fill strength (OQ-8.3)            */
--orch-tone-emphasis-fill:  22%;  /* ALARM-only fill (Failed / Camera error), OQ-8.3 two-tier */
--orch-tone-border:        55%;  /* canonical border strength (replaces 35/42/45/50%)      */
```

Usage shape (a tone class mixes its role token at the recipe strength, never a bespoke percentage):

```css
.badgeSelected { background: color-mix(in srgb, var(--orch-selected) var(--orch-tone-fill), transparent);
                 border-color: color-mix(in srgb, var(--orch-selected) var(--orch-tone-border), transparent);
                 color: var(--orch-selected); }
```

This honors **OQ-8.3** (14% informational / 22% alarm-only, no third strength, no left-border accent) and
**OQ-8.2** (one cyan live-signal role; no `--orch-camera`/magenta). Glyph text follows §4.2: where a role hue
fails 3:1 on its tinted backdrop (violet `--orch-applied`, red `--orch-danger`), the hue carries
border + icon and the glyph **text** drops to `--orch-text` — the fill is background-only.

**Static check (extends `orchestratorColorAudit.test.ts`):** (a) the four new role tokens resolve (catches the
silent-fallback bug class); (b) the six state roles resolve to six distinct hex values (`--orch-synced` ==
`--orch-live` is the one sanctioned alias); (c) **no raw `--orch-<hue>` reference** (`--orch-cyan/blue/green/
yellow/red/violet/magenta`) appears in a tone/badge/state class **outside the role-token definitions** — a
`grep`-style assertion over the Orchestrator CSS files, landed **warn-then-enforce (D8.5)** so the existing
raw-hue consumers can be migrated without a single RED step; (d) tone classes compose `var(--orch-tone-fill |
-emphasis-fill | -border)`, not bespoke `NN%` literals. `--orch-tone-emphasis-fill` is allowed ONLY on the
`Failed`/`Camera error` alarm classes.

> **No standalone state legend (provenance).** A persistent panel-header preset-state legend
> (`PresetStateLegend` / `PRESET_STATE_LEGEND`) was added (`70d0e6ad`) then **removed** (`70650635`) as
> redundant with the per-badge hover `title` + the row accessible name, which already carry every state's
> full word at the point of use. No legend symbol survives in `src/`. Decode of a badge circle is the badge's
> own `title`/`aria-label`, not a separate key. Do not re-introduce a standalone legend.

---

## 5. Graduation map

Each new rule/token → its home in [orchestrator-synthesis-ui-style-guide.md](orchestrator-synthesis-ui-style-guide.md)
and the test that guards it.

| New rule / token | Style-guide section | Guarding test (e2e blocked → static) |
| --- | --- | --- |
| `--orch-text-*` ramp + 0.75rem floor (4.1) | new **Typography Scale** | `orchestratorColorAudit.test.ts`: no font-size < 0.75rem (px-normalized); ramp present |
| Contrast pass/fail matrix + fills-are-background rule (4.2) | **Color System** → Contrast Targets & Matrix | `orchestratorColorAudit.test.ts`: flat-pair WCAG compute via `resolveTokenValue()`; muted-as-body-on-S1 forbidden |
| `--orch-motion-*` + `--orch-ease-standard` + blanket reduce-motion (4.3) | new **Motion System** | `orchestratorColorAudit.test.ts`: duration literals are tokens; per-file + blanket `prefers-reduced-motion` present (migrate `:184-188` in-slice) |
| `--orch-z-*` scale + shadow-only grammar (2 / 4.4) | new **Elevation & Z-Layers** | `orchestratorColorAudit.test.ts`: no bare `z-index` literal outside the scale; `--orch-shadow` only on popover/modal/drag-lift |
| Tiered latency budget + no-morph + `--orch-debounce-input` (4.5) | **Feedback And Failure States** → Latency & Progress | render-test ack-on-dispatch; timer-test `sending`→`Failed`≤4000ms |
| Empty-state inline working-state rule (4.6) | **Feedback And Failure States** → Empty & Sparse States | no-hero entry guard over PresetBrowser/StagePanel; copy unit-asserted |
| Iconography (mandatory aria-label+title, no symbol-alone verb) (4.7) | new **Iconography** | render-test: icon-only controls have accessible names |
| `--orch-bp-*` constants + reflow contract (4.8) | new **Responsive Breakpoints** | grep: JS `980` ⇔ CSS `979/980` lockstep |
| Error-copy standard (4.9) | **Feedback And Failure States** → Error & Disabled-Reason Copy | copy unit-asserted; one-owner `Failed` |
| i18n / text-length stance (4.10) | **Accessibility And Input** → Text Length & i18n | render-test accessible-name-contains-full-label; grep ellipsis-not-fixed-width |
| Entry: no programmatic focus + `/` accelerator (OQ-1.1) | **Core UX Rules** → Entry & Accelerators | render-test no autofocus/`view.focus()` on mount; accelerator table |
| No command palette; documented accelerator table (OQ-1.3) | **Core UX Rules** → Command model | accelerator table in guide; `canLiveCode` gating render-test |
| No-hero entry invariant + entry defaults (OQ-1.1, facet) | **Product Layout Contract** | `orchestratorColorAudit.test.ts`: `FORBIDDEN_ENTRY_TERMS` className/string grep over `ENTRY_AUDITED_FILES`; defaults stay presets/stage |
| Persistence boundary (inert view-shape only) (OQ-1.2) | **Core UX Rules** → Persistence boundary | unit-test: versioned key, fail-safe-to-default, no truth-lane key |
| Stage row ≥ Code clamp (OQ-4.1) | **Product Layout Contract** | render-test host grid track 1 = `1fr`, track 2 = bounded clamp |
| Stage permanently single-preview (OQ-2.1, Option A) | **Stage Header Contract** / Preview/Output Model | render-test: `.stageFrame` single-column, no second-cell node, no `Player Output` label |
| Buffer APG radiogroup + `::after` active cue (OQ-5.1) | **Synthesis Controls** → Selection Controls | render-test roving tabindex/arrow keys; audit `.bufferButtonActive::after` |
| Capability-query folder-action reveal + `--orch-quiet-opacity` (OQ-5.2/9.3) | **Accessibility And Input** / Menuing | grep: `@media (hover/pointer)` not width; quiet opacity token defined |
| cameraPipeline source-binding relabel + `stageCameraBinding` surface (OQ-6.2/D6.2) | **Stage Header Contract** + operator-journey table | `orchestratorStatusOwnership.test.ts` new surface; `hydraPreviewUtils.test.ts` updated |
| Mobile Stage-header camera width-bound + sub-floor raise (OQ-6.3) | **Stage Header Contract** | grep `max-width/min-width:0` + ellipsis; font-size audit |
| Per-control ≥44px effective via hit-slop (OQ-7.2) | **Density And Hierarchy Audit** | `orchestratorColorAudit.test.ts`: `::before` hit-slop on table-listed controls |
| Tone recipe `--orch-tone-fill` 14% / `--orch-tone-emphasis-fill` 22% / border 55% (§4.11, OQ-8.3, D8.2) | **Color System** → tone recipe | grep: tone classes use the mix tokens; no raw `--orch-<hue>` past role layer (warn-then-enforce, D8.5) |
| Semantic role layer completion `--orch-synced`(cyan)/`--orch-selected`(yellow)/`--orch-loaded`(blue)/`--orch-reference`(base0); no `--orch-camera` (§4.11, D8.1, OQ-8.2) | **Color System** role table | `orchestratorColorAudit.test.ts`: 4 new roles resolve; six state roles = six distinct hues; raw-hue-past-role grep |
| Mechanical aria-label derivation rule (OQ-9.2) | **Feedback And Failure States** → Accessible status naming | `OrchestratorStatusStrip.test.tsx` exact derived names; no hand-authored aria literals |
| `Applied on Player` binary rule (OQ-3.3) | **Presets And Authority** | `presetOperatorUx.test.ts` null-on-mismatch; strip owns Remote-update |

---

## 6. Calls awaiting your ratification

**Status: ratified 2026-06-01.** The user reviewed and said proceed, accepting every recommended option
below, with ONE change: the visual-personality intent (#7) was re-anchored away from the "instrument
panel" metaphor (it read as skeuomorphic for a principles-not-pixels doc — see §1). Each call below is
recorded with its ratified outcome and stays reversible; revisit any anytime.

1. **OQ-1.2 — Persist inert view-shape across visits?** *Recommend:* yes — persist ONLY ref-panel width,
   expanded-folder set, active rail panel, and preview buffer under one versioned fail-safe key; persist
   nothing truth-lane. *Why:* restores the workstation's furniture for a returning operator without ever
   manufacturing a stale Player/applied claim. *The one edge:* the remembered **preview buffer** — a returning
   operator may expect the safe `auto` default rather than a remembered manual buffer. Yes-to-all, or
   exclude buffer?

2. **OQ-2.1 — Player-output surface in the Orchestrator.** *Superseded 2026-06-04 by owner decision:* adopt
   Option A — Local Preview is the terminal truth surface and the Orchestrator surfaces no copy of the real
   audience output. The earlier ratified snapshot geometry (large preview + presence-gated inset) is dropped;
   `.stageFrame` is permanently single-preview. Option C (a live mirror) is no longer a roadmap item and would
   require a fresh ADR.

3. **OQ-3.3 — Stale `Applied on Player`.** *Recommend:* strictly binary — drops instantly on mismatch; the
   strip Remote-update pill owns "something newer is applied". *Why:* any decay reads as a competing Player
   claim with no proof. *Adjust option:* allow a tasteful "recently applied" decay later, only behind a fresh
   ADR introducing a Player-output surface that can prove it.

4. **OQ-6.2 / D6.2 — Relabel the cameraPipeline block.** *Recommend:* `Source bound` / `Source binding
   partial` / `Source: no camera` (drops the `Camera <state>` stem entirely). *Why:* removes a latent
   `FORBIDDEN_PREVIEW_TERMS` `Live` leak and the one-owner collision; keeps it in the header (low risk) and
   relabel-before-audit in one slice. *This changes a user-visible string* — confirm the vocabulary.

5. **OQ-8.2 — Cyan overload.** *Recommend:* keep ONE cyan `--orch-live` role for synced + camera (text +
   order + icon disambiguate); do NOT add a magenta `--orch-camera`. *Why:* `.badgeCam` is already cyan (the
   charter's "blue Cam badge" is stale), so the only real work is routing `.cameraPipelineLive` through the
   role layer; magenta adds a palette-adjacent move for no semantic payoff. *Adjust option:* give camera its
   own magenta role (louder separation, more palette surface, larger migration).

6. **OQ-8.3 — Alarm tint strength.** *Recommend:* two-tier — 14% informational, 22% alarm-only; no brighter
   fill, no left-border accent. *Why:* alarm must pop on luminance-flat Solarized without competing with
   bright Hydra. *This is a human visual call (e2e blocked)* — confirm 22% reads as "alarm" without "loud".

7. **facet — Visual personality.** *Ratified with one change.* The **intent** is confirmed (calm, dark,
   dense, legible, honest; the show is on the Player; emphasis by luminance not ornament). The **metaphor**
   was rejected on review — "a lit instrument panel in a dark booth" reads as skeuomorphic, contradicting the
   principles-not-pixels thesis and inviting knobs/bevels. §1 now states the personality as qualities (calm,
   dark, dense, legible, honest; emphasis carried by luminance, not ornament) and the design-intent prose
   borrows a tool's *ergonomics*, never its *appearance*.

8. **facet — Workstation entry feel (no hero / disclosure split).** *Recommend:* ratify "opens INTO work,
   never a welcome"; always-visible = the hot path + every core/destructive command; disclosed = low-frequency
   management. *Why:* discharges Principle 1's done-bar. *Note:* the `/`-to-search accelerator is PROPOSED, not
   shipped; Cmd/Ctrl-Enter send is the only existing accelerator.

---

## Relationship to existing docs

- **[orchestrator-visual-system.md](orchestrator-visual-system.md)** — the nine principles (the *why*).
  Unchanged; this doc honors it.
- **[orchestrator-style-directions.md](orchestrator-style-directions.md)** — the per-principle directions +
  the consolidated open-question gate (the *exploration*). **This doc closes that gate.** Two reconciliations
  it owes back to that doc (bookkeeping, no behavior change): prune **OQ-3.1/3.2/6.1** from the bottom
  open-questions list (they are RESOLVED in its own Decisions section), and correct the stale D3.2 badge-order
  prose at `:139-140,:169` to "DONE (maintain)".
- **[orchestrator-synthesis-ui-style-guide.md](orchestrator-synthesis-ui-style-guide.md)** — the enforced
  *rules*. Section 5 maps every new rule/token into it.
- **Locked product contracts honored:** [Preview/Output Model](orchestrator-preview-output-model.md),
  [Operator Journey + Status-Ownership](orchestrator-operator-journey.md),
  [Preset Operator UX](orchestrator-preset-operator-ux.md),
  [Player Live ADR](orchestrator-player-live-decision.md) (Option A adopted 2026-06-04 — Local Preview
  terminal; Options B and C dropped, C only behind a fresh ADR).
- **CI guards referenced:** `orchestratorColorAudit.test.ts`, `orchestratorStatusOwnership.test.ts`,
  `orchestratorPresentationModel.ts` (the `FORBIDDEN_PREVIEW_TERMS` + reserved truth-union guard).

> **Retire the superseded draft.** The untracked
> `docs/architecture/orchestrator-visual-style-directions.md` is an older parallel draft (a ~00:05 sibling of
> the committed `orchestrator-style-directions.md`) that re-opens questions resolved here. It should be
> **deleted** (or git-ignored and not committed) so the pipeline has exactly one decisive direction doc —
> this one — feeding the style guide.
