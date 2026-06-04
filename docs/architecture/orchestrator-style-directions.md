# Orchestrator Style Directions

> **Purpose.** This is the concrete companion to [orchestrator-visual-system.md](orchestrator-visual-system.md). The visual-system doc states the nine *principles* (what the Orchestrator is). This doc expands each principle into *implementable style directions* — repo-grounded, guideline-cited, and tagged with their landed/open status — plus the open questions that still gate adoption. The directions here are the raw material the [Synthesis UI Style Guide](orchestrator-synthesis-ui-style-guide.md) turns into enforced *rules*; think of the pipeline as **principle → direction (this doc) → rule (style guide) → test (audit/render-test)**.
>
> **How to read it.** One section per principle. Each section has: **Interpretation** (the app-specific reading); **Style directions** (each tagged `DONE` / `PARTIAL` / `OPEN` against current HEAD, with its guideline source); **Open questions** (well-formed decisions for the user, with candidate options); **Guideline references** (specific HiG/WCAG/NN-g/Material locators); and **Where it applies** (file anchors). A consolidated open-questions list and a deduped source index close the doc.
>
> **Status discipline.** This doc was re-audited against repository HEAD. Several directions that read as "future work" in earlier drafts have **already landed** during the Gate 3 closeout and are reframed as *landed; maintain via test* — they are recorded so the doc does not propose work that is done, and so the guarding test is named. Genuinely-open items stay as directions/questions.
>
> **Locked constraints honored throughout.** Solarized-only tokens (enforced by `orchestratorColorAudit.test.ts`, which now also flags undefined `--orch-*` refs); the local Hydra preview is an approximate **Local Preview**, never Live / Player Output / Now Playing / On Display (`FORBIDDEN_PREVIEW_TERMS`); the one-owner-per-label cross-surface status table; owner/admin live-code authority vs collaborator preset-only; **Option A (Local Preview is the terminal truth) is adopted (owner decision 2026-06-04)** — the Local Preview is the final preview object in the Orchestrator and **no Player-Output snapshot surface is reserved** (Options B and C are dropped; C remains only theoretically possible behind a fresh future ADR). The real Player still has audience output; the Orchestrator declines to surface a copy of it. The `FORBIDDEN_PREVIEW_TERMS` guard (the Local Preview must never claim to be Live / Player Output / Now Playing / On Display) is therefore **permanent, not transitional**. Local Nix Chromium e2e is BLOCKED (no authenticated screenshots), so directions bias toward statically verifiable checks (token audit, render-test, source grep).

---

## Decisions & early-HiG red-team resolutions (2026-05-31)

Two shape decisions were made and red-teamed against the early (1987/1992) Macintosh HiG canon (full record: [`docs/analysis/orchestrator_shape_redteam_early_hig_2026_05_31.md`](../analysis/orchestrator_shape_redteam_early_hig_2026_05_31.md)). **Verdict: both keep-with-mitigations — sound under early HiG; the rejected alternatives lose more ground.**

- **Preset object = dense row + state badges** (over card/split-lane). **OQ-3.1 RESOLVED → dense row.** Surviving early-HiG debt = *perceived stability* (badges reflow rows mid-set). Mitigations (keep the shape): **reserved fixed-height badge lane** (no wrap, elide overflow — row geometry constant); cap + reorder badges strongest-truth-first per **D3.2** (incl. the accessible-name order); **decouple Select from Load** (single = Select, explicit Load button = Load) — **OQ-3.2 RESOLVED**; paint **Gallery on the row** (close the WYSIWYG identity gap).
- **Status placement = header strip** (over on-frame chips/hybrid; chips breach the locked bright-Hydra readability rule). Surviving early-HiG debt = *feedback-and-dialog* for the non-host Operator (row-Send has no local ack; worse cross-tab on mobile). Mitigations (keep the strip): **row-local NON-textual send ack** on the sent row (strip keeps the `Synced`/`Failed` text — one-owner preserved) — **OQ-6.1 RESOLVED (option a)**; **mobile Presets-tab dot** for pending/failed row-Send; fix the **`Camera live`/`Camera Live` double-label** (relabel cameraPipeline as source/binding + extend the ownership audit in the same slice, **D6.2 — DONE, phase-18 `ec60f820`**: labels now `Source bound`/`Source binding partial`/`Source: no camera`); document the CodeEditor inline send-pill as intentional per-surface co-location (D6.5).

New sub-directions to fold into the principle sections: **D3.x — the preset row's state region is a reserved fixed-height lane (no reflow), badge-count-capped**; **D6.x — Operator preset-row Send gets a row-local non-textual ack while the strip retains the status text.**

---

## Cross-principle reconciliations (read first)

Two topics surface in more than one principle. To keep this doc internally consistent, they are resolved **once** here and referenced elsewhere:

- **Elevation / depth.** Appears in Principle 2 (Local Preview elevation) and Principle 7 (calm, low ornament). **Resolution:** under Option A the Local Preview is the single preview object; there is no second Player-Output peer to rank against it. The preview frame is distinguished by **border style, shape, and label — never by shadow.** Shadow (`--orch-shadow`) is reserved for true popovers/modals **and** the **transient drag-lift** on reorder (`.folderDragging`/`.presetDragging`, `PresetTree.css:191,196` — a legitimate momentary elevation, the one exception at HEAD); it is **never** applied to the preview frame, the docks, or any static chrome. This is stated firmly; shadow is **not** an option for the preview frame. A named `--orch-z-*` scale is defined (`OrchestratorView.css:73-80`; Principle 2, D2.1 — DONE) and referenced from Principle 7.
- **Contrast.** Appears in Principle 7 (legible) and Principle 8 (Solarized semantic). **Resolution:** the contrast *targets* are **LOCKED** (≥4.5:1 text, ≥3:1 large-text / UI-component / border / focus indicator). They are presented as fixed directions in both principles. The only thing still open is the *enforcement mechanism* (today the audit is regex-only; true computed contrast is blocked by the e2e issue) — that single question lives in Principle 8.

---

## Principle 1 — An operator workstation, not a dashboard or landing page

### Interpretation
The Orchestrator route opens directly into a working surface a returning operator already understands: no hero, splash, welcome, metric tiles, or marketing chrome to clear before acting. The shell is a fixed two-axis CSS grid that is always populated (`OrchestratorView.css:74-83`), and entry defaults land on work (`useOrchestratorWorkspace.ts` defaults: `activeDesktopPanel='presets'`, `activeMobileTab='stage'`), so the standing browse→load→preview→send→confirm loop is one step away at all times. "Workstation" also means persistent visible controls over hidden menus, status reported in place rather than aggregated into a dashboard, and expert accelerators (the existing Ctrl/Cmd-Enter send in `CodeEditor.tsx`) treated as first-class — while still meeting the locked five-second learnability bar.

### Style directions

- **D1.1 — Lock the "no hero/landing/dashboard" state with a static guard. `OPEN`.**
  Entry renders only the populated working grid; keep the locked entry defaults so first paint shows Stage + a browsable preset list. Verified against HEAD: `OrchestratorView.tsx` contains **no** `hero`/`landing`/`welcome`/`onboard`/`dashboard`/`splash` markup today (grep clean) — but there is **no guard** preventing regression. Add a grep-style static assertion to the audit suite (the same pattern that catches `FORBIDDEN_PREVIEW_TERMS` and undefined `--orch-*` refs) so this good state is CI-protected. *(Apple HiG Deference; NN/g #8 Aesthetic & Minimalist.)*
- **D1.2 — Make the standing loop reachable in one action on entry, without stealing focus. `OPEN`.**
  Give the Presets search input (`PresetBrowser.tsx`) an entry *accelerator* (e.g. `/` or Cmd-F), not `autoFocus` — auto-focusing a text input on route load changes the screen-reader landmark/reading order. The repo does neither today, so any choice is a deliberate new behavior (see OQ-1.1). Keep search/Load/Send as separate explicit actions (Load never broadcasts). *(NN/g #7 Flexibility & Efficiency; WCAG 2.2 SC 3.2.1 On Focus, Level A.)*
- **D1.3 — Treat expert keyboard accelerators as a first-class, discoverable, role-scoped layer. `PARTIAL`.**
  The one accelerator that exists (Ctrl/Cmd-Enter send, `CodeEditor.tsx:295-302`) is Host-editor-scoped but invisible. Surface it via a visible hint/title on the Send control, gate it to Host live-code authority, and document any accelerator in the style guide's accelerator list (so it is not folklore). The Operator/Browse-only path must remain fully completable with mouse/touch and no keyboard knowledge. *(Archival 1992 Mac HIG "see-and-point", no hidden modes; modern HiG Keyboards; NN/g #6 Recognition over Recall.)*
- **D1.4 — Keep the Library escape framed as global navigation, never a workspace tab or "home". `DONE` (maintain).**
  Verified at HEAD: Library escape is visually separated on desktop and sits in a dedicated mobile slot whose wrapper is **not** `role='tablist'`. There is no redundant "Orchestrator home" destination. Maintain this; a future change must not demote Library into a tab or invent a dashboard home. *(Style guide Product Layout Contract; WCAG 2.2 SC 4.1.2 Name, Role, Value.)*
- **D1.5 — Render empty/sparse states as working states, not landing prompts. `PARTIAL`.**
  The Presets panel empty/policy notices use the locked copy matrix wording and are tied to the panel (`PresetBrowser.tsx`). Codify the visual treatment (still open per the backlog): the empty region reads as "this list is empty/restricted, here is why" and must never become a centered hero CTA or block the Stage. The Stage stays fully operable with an empty preset list. *(NN/g #1 Visibility of System Status; style guide Feedback And Failure States.)*

### Open questions
- **OQ-1.1 — Desktop entry focus target.** See consolidated list.
- **OQ-1.2 — Persist last working context across visits?** See consolidated list.
- **OQ-1.3 — Global command affordance (palette) vs per-surface controls + documented shortcuts?** See consolidated list.

### Guideline references
- Apple HiG, Foundations › Design principles — Clarity, Deference, Depth. https://developer.apple.com/design/human-interface-guidelines/foundations
- Apple HiG (archival), 1992 Macintosh HIG — see-and-point, visible state, no hidden modes. https://vintageapple.org/inside_r/pdf/Human_Interface_Guidelines_1992.pdf
- Apple HiG, Patterns › Keyboards. https://developer.apple.com/design/human-interface-guidelines/keyboards
- WCAG 2.2 SC 3.2.1 On Focus (Level A). https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html
- WCAG 2.2 SC 4.1.2 Name, Role, Value (Level A). https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html
- NN/g, 10 Usability Heuristics (#6, #7, #8). https://www.nngroup.com/articles/ten-usability-heuristics/
- NN/g, Complex Application Design. https://www.nngroup.com/articles/complex-application-design/

### Where it applies
- `src/routes/Orchestrator/views/OrchestratorView.tsx` (always-populated grid; Library escape as global nav; no hero markup)
- `src/routes/Orchestrator/views/useOrchestratorWorkspace.ts` (entry defaults `presets`/`stage`)
- `src/routes/Orchestrator/views/OrchestratorView.css:74-83` (desktop grid)
- `src/routes/Orchestrator/components/StagePanel.tsx:78-124` (persistent visible Stage controls)
- `src/routes/Orchestrator/components/PresetBrowser.tsx` (toolbar + search as the browse instrument; in-panel empty/policy notices)
- `src/routes/Orchestrator/components/CodeEditor.tsx:295-302` (Mod-Enter accelerator)
- `src/routes/Orchestrator/components/orchestratorColorAudit.test.ts` (audit-as-guardrail pattern to extend with the no-hero/landing grep)

---

## Principle 2 — Local Preview is the terminal preview object

### Interpretation
The fast in-browser Hydra render (`HydraPreview.tsx`) is an approximate operator working view — **Local Preview** — and under Option A (owner decision 2026-06-04) it is the **terminal preview object**: the Orchestrator does not surface a copy of the audience display. The real Player still produces audience output; the Orchestrator simply declines to mirror it. The Local Preview renders as a single black `.container` (`HydraPreview.css:1-7`) carrying a `Local Preview` capsule and no "approximate" framing distinct from the surrounding Stage chrome. The principle's work is the visual grammar of that one object (frame/border treatment and a persistent "approximate" affordance) so that the operator's approximation never reads as audience truth — reinforcing `FORBIDDEN_PREVIEW_TERMS` visually, not by text alone. **No adjacent Player-Output slot is reserved.** The `OrchestratorPlayerOutputTruth` model stays a 2-value stub (`'noPlayer' | 'playerPresentNotMirrored'`), which is correct for Option A: it records that a Player may be present but is not mirrored here.

### Style directions

- **D2.1 — Define a named Orchestrator elevation scale and migrate ad-hoc z-index onto it. `DONE` (maintain).**
  Shipped (phase-11 token layer). The `--orch-z-*` scale is defined in the `.container` block (`OrchestratorView.css:73-80`) as `--orch-z-dock: 10` / `-resize: 11` / `-picker: 20` / `-scrim: 90` / `-sheet: 95` / `-toolbar: 100` / `-banner: 110` / `-modal: 120`, and every Orchestrator z-index now consumes a token; no raw z-index magic number survives in Orchestrator CSS (audit-checked). **Note:** the shipped token names differ from the names proposed below (`--orch-z-shell`/`-overlay`/`-popover` were not adopted; `--orch-z-modal: 120` is reserved for true popovers/modals). The original migration map is retained for trace:
  | Current value (file:line) | Role | Named tier |
  | --- | --- | --- |
  | `OrchestratorView.css:93` = 10 | refPanel | `--orch-z-shell: 1` / `--orch-z-dock: 10` |
  | `OrchestratorView.css:210` = 11 | resize separator | `--orch-z-resize: 11` |
  | `OrchestratorView.css:418` = 94 | mobile refPanel **backdrop** | `--orch-z-overlay: 90` |
  | `OrchestratorView.css:406` = 95 | mobile refPanel **sheet** | `--orch-z-banner: 95` |
  | `OrchestratorView.css:237` = 100 | toolbar | `--orch-z-toolbar: 100` |
  | `OrchestratorView.css:336` = 110 | popover | `--orch-z-popover: 110` |
  | `PresetPicker.css:33` = 20 | picker popover | `--orch-z-popover` (raise to popover tier) |
  | `HydraPreview.css:26` = 10 | preview status overlay | `--orch-z-dock` |
  | (reserved) modal | — | `--orch-z-modal: 120` |
  Note: do **not** leave the bare value 94 unassigned — it is the mobile refPanel backdrop and must map to a real tier (`--orch-z-overlay`). Under Option A the Local Preview is the single preview object, so there is no second preview surface to share a tier with. *(Apple HiG Depth; every new `--orch-z-*` token must be defined in the `.container` block or the audit's resolvable-refs check fails.)*
- **D2.2 — Give Local Preview a persistent "approximate" frame treatment. `OPEN`.**
  Keep the always-mounted `Local Preview` primary label and add a **non-color** redundant cue to the frame itself — a contrast-reduced / dashed inner hairline using `--orch-border-subtle`. **Frame style and label — never shadow — carry the "approximate working view" reading** (see Cross-principle reconciliation: shadow is popover/modal-only). Frame shape survives color-blindness and bright Hydra output bleeding to the frame edge. Under Option A there is no authoritative snapshot frame to contrast against; the dashed/contrast-reduced cue still earns its place by marking the preview as an approximation rather than audience truth. *(WCAG 2.2 SC 1.4.1 Use of Color, Level A; SC 1.4.11 Non-text Contrast, Level AA — the hairline is a UI-component boundary and must clear 3:1 against base03.)*
- **D2.3 — Treat `.stageFrame` / HydraPreview `.container` as the terminal single-object layout. `DONE` (maintain).**
  Under Option A the Stage body holds the Local Preview as the sole preview object; **no adjacent Player-Output slot is reserved**. Do not author a second preview grid track or a collapsed snapshot slot. If a live audience mirror is ever revisited it requires a fresh ADR and its own layout slice — it is not a standing reservation here. *(operator-journey §4 — single preview object; preview-output-model Placement Rules.)*
- **D2.4 — Keep the "approximate" qualifier visible on mobile. `DONE` (maintain).**
  Verified at HEAD: `.stageHint` ("Preview") no longer has a `display:none`-until-≥980px rule — it renders a compact `· Preview` qualifier via `::before` on all widths (`StagePanel.css:59-71`). Backlog #10 is satisfied. Maintain the exact locked vocabulary; the phone never reads as if the local frame were audience output. *(preview-output-model; NN/g #1 Visibility of System Status.)*
- **D2.5 — Non-pointer-blocking accessible live region on the Local Preview overlay. `DONE` (maintain).**
  Verified at HEAD: the overlay (`HydraPreview.tsx:325-330`) now carries `role='status'` and `aria-live='polite'`, composing the locked `Local Preview` + secondary source/audio labels. Maintain via render-test. *(WCAG 2.2 SC 4.1.3 Status Messages, Level AA; SC 1.3.1 Info and Relationships.)*

### Open questions
- **OQ-2.1 — Snapshot desktop geometry. RESOLVED → Option A (no snapshot).** The owner decided (2026-06-04) the Orchestrator does not surface a Player-Output snapshot, so no snapshot geometry is chosen. See consolidated list (#4).
- **OQ-2.2 — Does borrowing Player MP4 change the "approximate" frame?** See consolidated list.

### Guideline references
- Apple HiG, Foundations › Materials / Layout (depth conveys hierarchy, not decoration). https://developer.apple.com/design/human-interface-guidelines/foundations
- Apple HiG (archival 1992 Mac HIG) — labels/representations match observable behavior. https://vintageapple.org/inside_r/pdf/Human_Interface_Guidelines_1992.pdf
- WCAG 2.2 SC 1.4.1 Use of Color (Level A). https://www.w3.org/TR/WCAG22/#use-of-color
- WCAG 2.2 SC 1.4.11 Non-text Contrast (Level AA, 3:1). https://www.w3.org/TR/WCAG22/#non-text-contrast
- WCAG 2.2 SC 4.1.3 Status Messages (Level AA). https://www.w3.org/TR/WCAG22/#status-messages
- NN/g, 10 Usability Heuristics (#1, #2). https://www.nngroup.com/articles/ten-usability-heuristics/
- Material Design 3 (comparative only) — dark-theme elevation via surface tint rather than shadow. Cited only as supporting evidence for a tint/border-first depth approach; Material's palette/shadow ramp is **not** adopted. https://m3.material.io/styles/elevation/overview

### Where it applies
- `src/routes/Orchestrator/components/HydraPreview.tsx:323-355` (single preview object under Option A; overlay status)
- `src/routes/Orchestrator/components/HydraPreview.css:1-7,26,44-60` (frame; ad-hoc z-index; source-tint classes)
- `src/routes/Orchestrator/components/StagePanel.tsx:78-138` (single centered frame — terminal single object under Option A)
- `src/routes/Orchestrator/components/StagePanel.css` (`.stageBody`/`.stageFrame` single-object centered layout)
- `src/routes/Orchestrator/components/orchestratorPresentationModel.ts` (`OrchestratorPreviewTruth` + the 2-value `OrchestratorPlayerOutputTruth` stub `'noPlayer' | 'playerPresentNotMirrored'`, correct for Option A; `LOCAL_PREVIEW_LABEL`, `FORBIDDEN_PREVIEW_TERMS` — permanent guard, do not extend with snapshot terms)
- `src/routes/Orchestrator/views/OrchestratorView.css:22-58` (token block — home for new `--orch-z-*`/elevation tokens) and z-index lines `93,210,237,336,406,418`
- `docs/architecture/orchestrator-operator-journey.md:55,63-69` (single preview object under Option A; no reserved Player-Output slot — the prior §4 adjacent-slot reservation is dropped)

---

## Principle 3 — Presets as manipulable objects with state, not just list rows

### Interpretation
A preset is a direct-manipulation object whose identity includes its condition relative to the operator's session and the room. The row IS the thing you act on, and it must render four orthogonal facts simultaneously: (1) **what it is** — saved vs `Gallery`, `Cam`-using, `Start`; (2) **session-local condition** — `Selected` (highlight-only) vs `Loaded in preview` (this client's Stage renders it), which the State Truth Model forbids collapsing; (3) **room-truth condition** — `Applied on Player`, only on exact Phase 7A run/preset/gallery match; (4) **affordances the current authority grants** — Load always, Send only when `rowUx.sendEnabled`, management gated by role. The status-ownership table is the object's state vocabulary; the row may never borrow strip-owned or overlay-owned wording. Every cue survives color-blindness because color is never the sole signal.

### Style directions

- **D3.1 — Redundant (color + text/shape) encoding for every row-state cue, composed into the accessible name. `DONE` (maintain).**
  Badges already pair a Solarized tint with text (`Selected`, `Loaded in preview`, `Applied on Player`, `Start`, `Cam`). Verified at HEAD: the row accessible name now composes badge state — `PresetTree.tsx:282-291` builds `accessibleBadgeLabels` and joins them into `presetAriaLabel` (`Preset ${name}, Loaded in preview, Applied on Player, …`), wired at `:313`. Backlog #8 is satisfied. **Rule to maintain:** any *new* row state ships a text/shape token alongside its `--orch-*` color and is composed into the accessible name. *(WCAG 2.2 SC 1.4.1 Use of Color, Level A; SC 4.1.2 Name, Role, Value, Level A; style guide Color Rules.)*
- **D3.2 — Badge order is strongest-truth-first. `DONE` (maintain).**
  Per-row badge order mirrors the strip's **LOCKED** authority-first ordering. **Verified at HEAD:** both the badge render (`PresetTree.tsx:364-369`) and the accessible-name composition (`accessibleBadgeLabels`, `PresetTree.tsx:291-298`) lead with `Applied on Player → Loaded in preview → Selected → Start → Cam → Gallery`, so the visual and AT reading orders match and the strongest claim is first-read. CI-guarded: `PresetTree.test.tsx:640` (badges render in strongest-truth order) and `:694` (accessible name exposes the states). **Rule to maintain:** any *new* row state slots into this order in BOTH the render and the accessible-name array — presentation order only, no label/owner/color change. *(Apple HiG Clarity; NN/g #4 Consistency & Standards; the locked status-ownership table already fixes strongest-truth-first for the strip.)*
- **D3.3 — Express the three interaction conditions as three distinct, layerable cues; focus ring survives selection. `DONE` (maintain).**
  (a) hover/focus = cyan wash + the focus ring `box-shadow: inset 0 0 0 var(--orch-focus-ring-width) var(--orch-focus)`; (b) `Selected` = persistent 3px inset blue rail + `--orch-surface-strong`; (c) `Loaded in preview` = the blue badge. Verified at HEAD: the compound selector layers ring over rail (`PresetTree.css:234` = `inset 3px 0 0 var(--orch-blue), inset 0 0 0 var(--orch-focus-ring-width) var(--orch-focus)`), and the focus-ring restoration is **CI-asserted** (`orchestratorColorAudit.test.ts:98-106`). Backlog #2 closed. Keyboard focus and selection are never represented by the same single cue. Maintain. *(WCAG 2.2 SC 2.4.7 Focus Visible, Level AA — the indicator EXISTS; SC 1.4.11 Non-text Contrast, Level AA — focus/state indicator ≥3:1; Material 3 state-layers cited COMPARATIVELY for the separation-of-layers idea only — Material overlays/opacities not adopted.)*
- **D3.4 — Disabled affordances teach, in-context, not silently. `DONE` (maintain).**
  When `rowUx.sendEnabled` is false, Send stays visible with `sendDisabledMessage` as its `title` AND, for the party-folder case, an inline `rowNotice` (`Not in party folder`). Verified at HEAD: `rowNotice` renders at `PresetTree.tsx:332`; Send `title` at the button. **Rule to maintain:** a disabled object-action carries its reason adjacent to the action, never only in a detached panel and never as a silent no-op. The panel notice explains the room-wide rule; the row explains THIS object. *(NN/g #9 Error recovery, #5 Error Prevention; style guide "status text tied to the control that caused it".)*
- **D3.5 — Single-pointer, keyboard-operable equivalent for every drag-reorder/move. `PARTIAL`.**
  `@hello-pangea/dnd` drag is used for reorder and the drag handle is `tabIndex={-1}` (`PresetTree.tsx:319`), so keyboard/precision-limited users cannot reorder via drag. The `Move to folder` button is the correct single-pointer alternative and must remain visible and focusable. **Rule:** drag is an accelerator, never the sole mechanism for a state-changing object operation. *(WCAG 2.2 SC 2.5.7 Dragging Movements, Level AA, new in 2.2; SC 2.1.1 Keyboard, Level A; failure technique F108.)*
- **D3.6 — Load and Send are stable, labeled text buttons; icon-only verbs stay subordinate. `DONE` (maintain).**
  Load = secondary text button, Send = primary text button, grouped together (`PresetTree.tsx:335-355`); management glyphs (start/rename/clone/delete/move) carry both `aria-label` and `title` and are visually subordinate. **Rule to maintain:** the object's two core verbs are always labeled text buttons; symbol-only controls are reserved for lower-frequency management and must carry an accessible name. *(NN/g #6 Recognition over Recall, #2 Match real world; style guide "use buttons for commands with side effects… avoid unlabeled knob banks".)*

> **Citation correction note:** earlier drafts cited **SC 2.5.3 Label in Name** here. That SC concerns the visible-text/accessible-name relationship; for D3.6 the load-bearing SCs are SC 4.1.2 (Name, Role, Value) and recognition heuristics. SC 2.5.3 is dropped from this principle.

### Open questions
- **OQ-3.1 — Card vs dense row at higher density** (and whether a thumbnail can ever exist without implying output truth). See consolidated list.
- **OQ-3.2 — Does selecting a row keep auto-Loading it, or should Select and Load become separable?** See consolidated list.
- **OQ-3.3 — How to treat a STALE `Applied on Player` (superseded) vs drop the badge instantly?** See consolidated list.

### Guideline references
- Apple HiG, Foundations — Clarity, Deference, Depth. https://developer.apple.com/design/human-interface-guidelines/foundations
- Apple HiG (archival 1992 Mac HIG) — direct manipulation / provide feedback. https://vintageapple.org/inside_r/pdf/Human_Interface_Guidelines_1992.pdf
- WCAG 2.2 SC 1.4.1 Use of Color (A); SC 4.1.2 Name, Role, Value (A). https://www.w3.org/TR/WCAG22/
- WCAG 2.2 SC 2.4.7 Focus Visible (AA) — indicator exists. https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- WCAG 2.2 SC 1.4.11 Non-text Contrast (AA, 3:1 for state/focus indicators). https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- WCAG 2.2 SC 2.5.7 Dragging Movements (AA, new in 2.2) + F108. https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements
- NN/g, 10 Usability Heuristics (#1, #2, #4, #6, #9). https://www.nngroup.com/articles/ten-usability-heuristics/
- Material Design 3 (comparative only) — state layers as separate per-state overlays. https://m3.material.io/foundations/interaction/states/state-layers

### Where it applies
- `src/routes/Orchestrator/components/PresetTree.tsx:282-291,300-333` (row object, accessible-name composition, badge cluster)
- `src/routes/Orchestrator/components/PresetTree.tsx:364-369` (badge render, strongest-truth order — D3.2 DONE; guarded by `PresetTree.test.tsx:640,694`)
- `src/routes/Orchestrator/components/PresetTree.tsx:335-426` (actions: Load secondary + Send primary + icon manage verbs)
- `src/routes/Orchestrator/components/PresetTree.tsx:319` (drag handle `tabIndex={-1}` — D3.5 gap) and `Move to folder` single-pointer alternative
- `src/routes/Orchestrator/components/PresetTree.css:55-87,223,234` (badge tints; focus-ring; ring-survives-selection compound selector)
- `src/routes/Orchestrator/components/presetOperatorUx.ts` (`getPresetRowUx`: showLoad/showSend/sendEnabled/sendDisabledReason/rowNotice; `getAppliedPresetKey` exact-match → Applied on Player)
- `src/routes/Orchestrator/components/orchestratorPresentationModel.ts` (locked badge label constants + `FORBIDDEN_PREVIEW_TERMS`)
- `src/routes/Orchestrator/components/orchestratorColorAudit.test.ts:98-106` (focus-ring CI guardrail)

---

## Principle 4 — Code is an expert instrument, not the center of every workflow

### Interpretation
The Hydra `CodeEditor` is a Host-only power instrument that must never out-rank the Stage in layout or default focus, and must be entirely **absent** (not merely disabled) for Operator and Browse-only roles. The hard role boundary is enforced correctly: `getOrchestratorShellModel()` only exposes `code` for Host, and the code dock is mounted only when `workspaceModel.canShowCodePanel` is true (`OrchestratorView.tsx:131`), so non-Hosts have no editor in the DOM. The unmet half is **visual weighting within the Host layout**.

### Style directions

- **D4.1 — In Host desktop layout, Stage owns the dominant flexible row; Code is bounded. `DONE` (maintain).**
  Shipped (phase-12 spatial host-row). The host split grid is now `grid-template-rows: minmax(0, 1fr) clamp(12rem, 30dvh, 22rem)` (`OrchestratorView.css:106`) — Stage takes the `1fr` growth share and Code is clamped, so growing the viewport grows the *Stage* (OQ-4.1 option b). Operator/Browse continue to give Stage the full column via `.stageDock { grid-row: 1 / 3 }`. **Invariant to maintain:** Stage row ≥ Code row at every desktop height. *(Apple HiG Layout + Deference; style guide Progressive Synth UI "Stage first… Code third".)*
- **D4.2 — Default entry focus lands on the Stage/preset path, never inside the editor. `DONE` (maintain).**
  `defaultDesktopTab='presets'`, `defaultMobileTab='stage'` in the shell model; the `EditorView` is constructed with no `.focus()` call. Make "no editor autofocus on mount" an explicit maintained rule so a future change can't call `view.focus()` on init. *(NN/g #6 Recognition over Recall, #7 Flexibility; Apple HiG Deference.)*
- **D4.3 — Host mobile: Code tab stays peer-ranked AFTER Stage, not default; keep the unsent-edits dot. `DONE` (maintain).**
  Mobile tablist order is Stage, Code, Presets with `defaultMobileTab='stage'`; the unsent-edits dot on the Code tab (`OrchestratorView.tsx:166-168`) is the lightweight "instrument has pending state" cue. Maintain rather than promoting Code to a persistent panel. *(Apple HiG Tab bars — order by importance, primary tab default; NN/g #1.)*
- **D4.4 — Host Code dock reads as a subordinate instrument panel via surface, not shadow. `PARTIAL`.**
  The codeDock uses recessed `var(--orch-bg)` while the editor footer uses `var(--orch-surface-raised)` (`CodeEditor.css:26`) — already pointing the right way. Codify the rule: **Code dock surface stays at or below shell-base elevation, never above the Stage** (Stage ≥ Code). Per the Cross-principle reconciliation, depth here is **border/surface only — no shadow** (shadow is popover/modal-only). Defer exact border/surface values to the elevation scale (D2.1). *(Apple HiG Depth; Material 3 dark-theme tint-led elevation cited COMPARATIVELY only.)*
- **D4.5 — Instrument affordances stay co-located and authority-gated; never make the editor read-only to express lost send rights. `DONE` (maintain).**
  Send/Resend are disabled-with-reason for Host when `canSend` is false — verified at HEAD: `disabled={!canSend}` at `CodeEditor.tsx:498` (Send) and `:525` (Resend), with `title='Raw code send requires room owner or admin'`; the hint swaps to "Preset sends only". Local editing/audition (Format, Undo/Redo, Random, the editor body) stays live. **Rule to maintain:** only room-broadcasting verbs gate on authority; never disable the editor body as a way to express lost authority. *(Style guide "keep user control explicit"; NN/g #5 Error Prevention; Apple HiG avoid hidden modes.)*

### Open questions
- **OQ-4.1 — Exact Stage:Code row ratio / Code min-max** once Stage is dominant (and whether to add a keyboard-operable vertical splitter). See consolidated list.
- **OQ-4.2 — Prominence of "pending edits" on mobile tab-away beyond the dot.** See consolidated list.

### Guideline references
- Apple HiG, Foundations › Layout. https://developer.apple.com/design/human-interface-guidelines/foundations/layout/
- Apple HiG, Foundations — Deference. https://developer.apple.com/design/human-interface-guidelines/foundations
- Apple HiG (archival 1992 Mac HIG) — visible state; no hidden modes. https://vintageapple.org/inside_r/pdf/Human_Interface_Guidelines_1992.pdf
- NN/g, 10 Usability Heuristics (#6, #7). https://www.nngroup.com/articles/ten-usability-heuristics/
- NN/g, Progressive Disclosure. https://www.nngroup.com/articles/progressive-disclosure/
- WCAG 2.2 SC 2.4.7 Focus Visible (AA). https://www.w3.org/TR/WCAG22/
- WCAG 2.2 SC 2.5.8 Target Size (Minimum) (AA, 24×24 CSS px). https://www.w3.org/TR/WCAG22/#target-size-minimum  *(The 44px mobile control floor is the stricter Apple HiG / style-guide `--orch-touch-target`, not the WCAG AA minimum.)*
- Material Design 3 (comparative only) — elevation tint + motion easing/duration tokens. https://m3.material.io/styles/motion/easing-and-duration/tokens-specs

### Where it applies
- `src/routes/Orchestrator/views/OrchestratorView.css:106` (Host split grid — Stage-dominant `minmax(0,1fr) clamp(12rem,30dvh,22rem)`, D4.1 fixed); Operator stage-expanded via `.stageDock { grid-row: 1 / 3 }`
- `src/routes/Orchestrator/views/orchestratorShellModel.ts` (Host-only `code`; `defaultMobileTab='stage'`, `defaultDesktopTab='presets'`; preset-only models omit `code`)
- `src/routes/Orchestrator/views/OrchestratorView.tsx:131-135` (codeDock mounted only when `canShowCodePanel`); `:143-182` (mobile tablist order; unsent dot `166-168`)
- `src/routes/Orchestrator/components/CodeEditor.tsx` (`EditorView` constructed with no `.focus()`; `:498` Send disabled, `:525` Resend disabled; hint "Preset sends only")
- `src/routes/Orchestrator/components/CodeEditor.css:26` (footer raised vs codeDock recessed)
- `src/routes/Orchestrator/views/OrchestratorView.tsx` (existing horizontal refPanel resize separator — pattern a vertical Stage/Code splitter would mirror)
- `src/routes/Orchestrator/views/orchestratorShellModel.test.ts` (locks the host split — new ratio must not break it)

---

## Principle 5 — Controls visible, immediate, and modeless where possible

### Interpretation
Every side-effecting command (Load, Send, Save, Set start, Set player folder, Delete, buffer-select, camera toggle, Apply/Dismiss remote) is a persistent, labeled control sited next to its subject — not hover-revealed, color-only, or modally-trapped — and every tap/keypress is acknowledged immediately in **two channels** (a visible state change AND an assistive-tech announcement). The legitimate modes (authority, active buffer, camera relay state) are always-visible, redundantly-encoded indicators, never states discovered only by attempting a rejected action.

### Style directions

- **D5.1 — Buffer selector is an explicit single-select segmented control with a non-color active cue. `DONE` (maintain) / `PARTIAL` (redundant cue).**
  Verified at HEAD: the row is wrapped `role='radiogroup'` with `aria-label='Preview output buffer'`, each button `role='radio'` + `aria-checked={buffer === option.key}` + `aria-label` (`StagePanel.tsx:108-121`). The role/state half of backlog #5 is **landed**. **Remaining (PARTIAL):** the active state still leans on color (`.bufferButtonActive`); add a persistent non-color marker (weight/inset/checkmark) so "which buffer is active" is never color-only. Keyboard semantics depth is OQ-5.1. *(WCAG 2.2 SC 1.4.1 Use of Color, Level A; WAI-ARIA APG Radio Group; Apple HiG Segmented controls.)*
- **D5.2 — Desktop PresetTree folder actions discoverable without hover. `OPEN`.**
  Verified at HEAD the anti-pattern persists: `.folderActions` are `opacity:0` + `pointer-events:none` until hover on desktop (`PresetTree.css:89-106`), while mobile already renders them `opacity:1`/`pointer-events:auto`. Folder Delete and Set-player-folder are high-impact, low-frequency commands that are hover-only on desktop (backlog #14) — the exact anti-pattern Principle 5 names. Make them persistently present (quiet-by-default, hover/focus-intensified, mirroring the mobile rule) so the controls exist in layout and for AT. Authority gating (which decides whether the control exists at all) is untouched. Density-vs-directness is OQ-5.2. *(Archival 1992 Mac HIG see-and-point; NN/g #6 Recognition over Recall; style guide "primary actions in visible controls".)*
- **D5.3 — Assistive-tech acknowledgement on the three status surfaces. `DONE` (maintain).**
  Verified at HEAD: (a) `OrchestratorStatusStrip` container has `aria-live='polite'` + per-pill name prefix (`Authority:` / `Broadcast:` / `Camera:`) at `OrchestratorStatusStrip.tsx:18-49`; (b) CodeEditor send pills wrapped in `role='status' aria-live='polite'` (`CodeEditor.tsx:503`); (c) remote-update banner has `role='status' aria-live='polite'` (`OrchestratorView.tsx:111`). Backlog #4/#6/#7 satisfied; attribute-only, no relabel, owners preserved. Maintain via render-test. *(WCAG 2.2 SC 4.1.3 Status Messages, Level AA; operator-journey status-ownership table.)*
- **D5.4 — PresetPicker popover becomes a conformant, escapable disclosure. `OPEN`.**
  Verified at HEAD: the toggle/panel have **no** `aria-haspopup`, `aria-expanded`, `role`, Escape, or focus-return (grep clean for these in `PresetPicker.tsx`). It is a mode a keyboard/AT user can get stuck in (backlog #15) — the exact "modes a user can get stuck in" Principle 5 forbids. Add `aria-haspopup` + `aria-expanded`-bound-to-open on the toggle; a role + accessible name on the panel; Escape-to-close; focus into the panel on open and back to the toggle on close; keep pointerdown-outside dismissal; apply `--orch-focus-ring` tokens. Semantics + escape-hatch pass only, no layout rebuild. *(Apple HiG Popovers — dismissible, returns focus; WAI-ARIA APG Disclosure / Menu Button; NN/g #3 User Control & Freedom.)*
- **D5.5 — Immediacy budget: visible in-flight state within ~100ms, never a frozen pending; reduce-motion-safe. `PARTIAL`.**
  Send already shows "Sending…" and camera shows "Cam…"/"Connecting…". Extend the same in-flight pattern to Apply/Dismiss on the remote banner, pair it with the live region from D5.3 (dual-channel), and honor `prefers-reduced-motion` for any spinner (the reduce-motion guards exist for PresetTree/PresetBrowser; see Principle 7 for the blanket contract). The numeric budget and its non-e2e verification are OQ-9.1. *(NN/g Response Times — 0.1s feels instantaneous; Apple HiG progress indicators keep moving / prefer determinate; WCAG 2.2 SC 2.3.3 Animation from Interactions, **Level AAA**; Material 3 motion duration tokens COMPARATIVE only.)*

### Open questions
- **OQ-5.1 — Buffer selector: full APG radiogroup roving-tabindex vs attribute-only role/aria-checked.** See consolidated list.
- **OQ-5.2 — Folder actions: persistently-visible-quiet vs an always-visible overflow ("More") trigger.** See consolidated list.

### Guideline references
- Apple HiG, Foundations › Accessibility; Components › Segmented controls; Components › Popovers. https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple HiG (archival 1992 Mac HIG) — see-and-point, immediate feedback. https://vintageapple.org/inside_r/pdf/Human_Interface_Guidelines_1992.pdf
- WCAG 2.2 SC 4.1.3 Status Messages (AA). https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WCAG 2.2 SC 1.4.1 Use of Color (A). https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- WCAG 2.2 SC 2.4.7 Focus Visible (AA) and SC 2.4.11 Focus Not Obscured (Minimum, AA — reserved for clipped/obscured focus only). https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- WCAG 2.2 SC 2.5.8 Target Size (Minimum) (AA, 24×24 CSS px). https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- WCAG 2.2 SC 2.3.3 Animation from Interactions (**AAA**). https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- W3C WAI-ARIA APG — Radio Group, Disclosure, Menu Button. https://www.w3.org/WAI/ARIA/apg/patterns/radio/
- NN/g, 10 Usability Heuristics (#1, #3, #6) + Response Times. https://www.nngroup.com/articles/ten-usability-heuristics/
- Material Design 3 (comparative only) — motion duration tokens (~100ms short2, ~300ms medium2). https://m3.material.io/styles/motion/easing-and-duration/tokens-specs

### Where it applies
- `src/routes/Orchestrator/components/StagePanel.tsx:108-121` (buffer radiogroup — role/state landed); `StagePanel.css` `.bufferButtonActive` (color-only active — D5.1 remaining)
- `src/routes/Orchestrator/components/stagePanelUtils.ts` (`BUFFER_OPTIONS` Auto/o0..o3)
- `src/routes/Orchestrator/components/PresetTree.css:89-106` (folder actions hover-only on desktop — D5.2); `:355-364` (mobile persistent — the model to mirror)
- `src/routes/Orchestrator/components/OrchestratorStatusStrip.tsx:18-49` (aria-live + per-pill prefix — landed)
- `src/routes/Orchestrator/components/CodeEditor.tsx:493-531` (send group; live region landed; in-flight text)
- `src/routes/Orchestrator/views/OrchestratorView.tsx:110-122` (remote banner — live region landed; extend in-flight on Apply/Dismiss)
- `src/routes/Orchestrator/components/PresetPicker.tsx:56-117` (popover — no aria-expanded/Escape/focus-return — D5.4)

---

## Principle 6 — Status lives near the thing it describes

### Interpretation
"Near" is the spatial enforcement of the one-owner-per-label table: each status string renders on the surface whose subject it describes, at minimum reading distance from the control or object it concerns, never as a detached banner. Concretely: per-preset state and the row's blocked-Send reason render in that row; preview "what-this-surface-is" + source/audio truth render in the HydraPreview overlay on the frame; cross-cutting governance of the Stage (authority, broadcast, camera-connection) lives in the Stage-header strip because the header governs the Stage immediately below it; the Remote-update banner owns the apply/dismiss verb at shell level. The principle is satisfied when no status string is rendered by two surfaces that both sit near the Stage.

### Style directions

- **D6.1 — Row-specific policy reasons render on the row; scope-wide reasons render in the panel notice. `DONE` (maintain) + codify the rule of thumb.**
  Row reason (`Not in party folder`) renders in the row's `rowNotice` (`PresetTree.tsx:332`); scope-wide reasons live in the PresetBrowser panel notice. Codify the rule of thumb in the style guide: **if the reason is a function of the individual preset, it belongs on the row; if it is a function of the user's mode or the whole list, it belongs in the panel notice.** *(NN/g #1, #6; Apple HiG Feedback "at the point where people need it".)*
- **D6.2 — Resolve the camera-status proximity collision in the Stage header. `DONE` (maintain).**
  Shipped in phase-18 (merge `ec60f820`). The `OrchestratorStatusStrip` camera pill (`Camera connecting/live/error/idle`) owns **relay connection** truth; the StagePanel `cameraPipeline` block owns **camera-source-binding-into-Hydra** truth and is now lexically differentiated as source/binding, not a second "Camera <state>": labels are `Source bound` / `Source binding partial` / `Source: no camera` (`hydraPreviewUtils.ts:13-15`, `formatCameraPipelineLabel`). The block renders as a `role='status'` `aria-live='polite'` region (`StagePanel.tsx:189-196`). The one-owner audit was extended in the same slice: `orchestratorStatusOwnership.test.ts` now derives a separate `stageCameraBinding` surface set (`:165,:245`) and asserts the binding labels are disjoint from the strip-pill `stageCamera` set (`:263-277`). The relabel and the audit extension landed together, as required. **Rule to maintain:** the strip pill owns relay connection; the cameraPipeline block owns source-binding and must never read as a second "Camera <state>". *(operator-journey one-owner-per-label table; WCAG 2.2 SC 1.4.1 Use of Color; Apple HiG Consistency.)*
- **D6.3 — Source-binding + audio truth stays physically ON the preview. `DONE` (maintain).**
  The HydraPreview overlay is the sole home for `Local Preview` + secondary source/audio labels and uses `pointer-events: none` so it overlays without blocking the canvas. **Rule to maintain:** forbid moving any `Preview using Player MP4` / `Waiting for Player media` / `Fallback external source` / `Simulated audio` / `Player audio reactive` string into the Stage strip, a tooltip, or instructional body text. *(preview-output-model Placement Rules; archival Mac HIG; NN/g #1.)*
- **D6.4 — Proximity-spacing contract using the existing `--orch-space-*` scale. `DONE` (maintain).**
  Status that annotates an object uses the micro/inner steps; status that separates groups uses larger steps. The Stage-header proximity rhythm is already tokenized (`--orch-space-xl` between groups, `--orch-space-md`/`sm` inside; overlay `--orch-space-2xs`/`xs`). **Rule:** a status label's gap to its subject must be a *smaller* step than the gap separating it from unrelated controls, so Gestalt proximity does the explaining. *(Gate 3a-ii spacing scale; Apple HiG Layout grouping/proximity.)*
- **D6.5 — Co-locate announcements with their status element; do not centralize into one page-level live region. `DONE` (maintain).**
  Each of the strip, preview overlay, and CodeEditor send region has its **own** adjacent live region (see D5.3) — none funnel into a shared region elsewhere in the shell. **Rule to maintain:** the non-visual analogue of "near" is "the announcement is owned by the same component as the visual status." *(WCAG 2.2 SC 4.1.3 Status Messages, AA; Apple HiG Accessibility.)*
- **D6.6 — No Player-Output status slot is reserved on the frame. `DONE` (maintain — Option A).**
  Under Option A (owner decision 2026-06-04) the Orchestrator surfaces no Player-Output snapshot, so there is no sibling label-slot to reserve in the overlay region. The overlay owns only Local Preview + source/audio truth (D6.3). The `FORBIDDEN_PREVIEW_TERMS` guard stays a **permanent, surface-independent** rule: the literal `Player Output` substring (`orchestratorPresentationModel.ts:41`) is forbidden as a label anywhere in the Orchestrator preview surface — it never becomes a permitted "snapshot object name", because no such object exists. A live audience mirror would require a fresh ADR and is not a standing reservation. *(operator-journey §4; `FORBIDDEN_PREVIEW_TERMS`.)*

### Open questions
- **OQ-6.1 — Where does broadcast/send status live for a non-Host Operator** whose Send trigger (a preset row) is far from the Stage-header broadcast pill? See consolidated list.
- **OQ-6.2 — Should the cameraPipeline (source-binding) block move onto the preview frame**, given source binding is preview-source truth? See consolidated list.
- **OQ-6.3 — Mobile: how to keep status near its subject** when vertical stacking pushes the strip away from the preview and risks hiding buffer controls below the fold at 390px? See consolidated list.

### Guideline references
- NN/g, 10 Usability Heuristics (#1, #6). https://www.nngroup.com/articles/ten-usability-heuristics/
- Apple HiG, Foundations › Feedback. https://developer.apple.com/design/human-interface-guidelines/feedback
- Apple HiG, Foundations › Layout (grouping/proximity). https://developer.apple.com/design/human-interface-guidelines/layout
- Apple HiG (archival 1992 Mac HIG) — see-and-point, state is visible. https://vintageapple.org/inside_r/pdf/Human_Interface_Guidelines_1992.pdf
- WCAG 2.2 SC 4.1.3 Status Messages (AA). https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WCAG 2.2 SC 1.4.1 Use of Color (A). https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- WCAG 2.2 SC 1.4.11 Non-text Contrast (AA, 3:1). https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- Material Design 3 (comparative only) — supporting/status text placement beneath its control. https://m3.material.io/foundations/layout/understanding-layout/overview

### Where it applies
- `src/routes/Orchestrator/components/OrchestratorStatusStrip.tsx:18-49` (strip pills near the Stage; aria-live landed)
- `src/routes/Orchestrator/components/orchestratorStatus.ts` (`getCameraStatus` — strip pill connection truth)
- `src/routes/Orchestrator/components/StagePanel.tsx:99-107` (cameraPipeline block — second camera renderer, source-binding truth)
- `src/routes/Orchestrator/components/hydraPreviewUtils.ts` (cameraPipeline label values Off/Partial/Live)
- `src/routes/Orchestrator/components/HydraPreview.tsx:323-337` (overlay owns Local Preview + secondary labels, on the frame; `pointer-events:none`)
- `src/routes/Orchestrator/components/PresetTree.tsx:325-332` (presetMeta badge cluster; rowNotice — row-local policy reason)
- `src/routes/Orchestrator/views/OrchestratorView.tsx:110-128` (remote banner owns Apply/Dismiss; StagePanel receives statusStrip as prop)
- `src/routes/Orchestrator/components/orchestratorStatusOwnership.test.ts` (one-owner audit; D6.2 coverage gap CLOSED — separate `stageCameraBinding` surface set at `:165,:245`, asserted disjoint from the strip-pill `stageCamera` set at `:263-277`)

---

## Principle 7 — Visual hierarchy favors repeated live operation: dense, calm, legible, low ornament

### Interpretation
The Orchestrator is tuned for a returning operator running a long live set on a phone or laptop. Four things must hold simultaneously: **dense** (the `--orch-space-*` scale + compact control heights, with hit-slop reconciling density against the 44px touch floor); **calm** (Solarized chrome stays a separate plane from arbitrary Hydra output, motion restrained and reduce-motion-safe, emphasis from semantic color/type not ornament); **legible** (a stated minimum readable size and a real ramp — today ~16 sub-floor font literals sit below `--text-xs`); **low ornament** (nothing decorative-only; the leftover `--aqua-*` aliases, already neutralized to `none`, are the removal target).

### Style directions

- **D7.1 — Orchestrator type ramp with a stated minimum readable size; migrate the sub-floor literals up. `DONE` (maintain).**
  Shipped (phase-15 typography ramp). The `--orch-text-*` tokens are defined over the existing raw values with a stated 0.75rem floor (`OrchestratorView.css:99-102`): `--orch-text-meta: var(--text-xs)` (0.75rem floor — metadata/pills/badges), `--orch-text-body: var(--text-sm)`, `--orch-text-control: var(--text-md)`, `--orch-text-title: var(--text-lg)` (binds the formerly-unused `--text-lg` to the Stage title, so the ramp has no dead rung). The sub-floor literals (StagePanel camera label/detail, the ApiReference 0.58–0.69rem cluster, PresetPicker) were raised to the floor, asserted by the font-size floor audit. **Floor policy** (hard vs two-tier) remains OQ-7.1. *(WCAG 2.2 SC 1.4.4 Resize Text, AA; SC 1.4.3 Contrast Minimum, AA; Apple HiG Typography / Dynamic Type.)*
- **D7.2 — Motion-token layer with one easing. `DONE` (maintain).**
  Shipped (phase-11 token layer). The four tokens are defined (`OrchestratorView.css:69-72`): `--orch-motion-fast: 120ms`, `--orch-motion-base: 180ms`, `--orch-motion-slow: 250ms`, `--orch-ease-standard: cubic-bezier(0.4, 0, 0.2, 1)`, and transitions consume them (CodeEditor, PresetTree, OrchestratorView). One curve for functional transitions; durations stay short. **Maintain** — route any new transition through the tokens rather than a raw duration. (A small set of raw-duration holdouts in PresetBrowser/PresetTree remains, tracked by the `motion-tokenize` forward slice.) *(Apple HiG Motion — purposeful, subtle; Material 3 motion tokens COMPARATIVE only — short ~100–250ms, standard easing — as a sanity range, not the Material visual language.)*
- **D7.3 — Blanket reduce-motion contract for the Orchestrator shell. `DONE` (maintain).**
  Shipped (phase-11 token layer). A single shell-scoped `@media (prefers-reduced-motion: reduce)` rule covers `.container *`, `.container *::before`, `.container *::after` (`OrchestratorView.css`), so any child gaining a transition is safe by default — files that previously had no per-file guard (ApiReference, StagePanel) are now covered. The blanket rule is CI-asserted (`orchestratorColorAudit.test.ts` checks for `@media (prefers-reduced-motion: reduce)` + `.container *`). *(WCAG 2.2 SC 2.3.3 Animation from Interactions, **Level AAA**; backlog #11.)*
- **D7.4 — Low-ornament as a removal contract; delete the `--aqua-*` shims as children migrate. `PARTIAL`.**
  The legacy `--aqua-*` aliases are neutralized (`--aqua-blur: none`, `--aqua-gloss: none`) but still present (`OrchestratorView.css:60-67`). Schedule their deletion as each consuming child migrates to direct `--orch-*` surface/border/shadow tokens, rather than leaving a permanent shim. Decoration that survives must carry meaning (a semantic role, a state, a grouping border) — never gloss/glass/neon residue. **Reminder (Cross-principle reconciliation): `--orch-shadow` is for popovers/modals and the transient drag-lift (`.folderDragging`/`.presetDragging`) only — never the preview frame, the docks, or static chrome.** *(Apple HiG Deference & Clarity; NN/g #8 Aesthetic & Minimalist.)*
- **D7.5 — Width-bounded, emphasis-ordered Stage strip; loudness only for warning/live/danger. `DONE` (maintain).**
  Verified against the density audit + HEAD: authority-first / broadcast-second / camera-third order, status slot `clamp(14rem, 34vw, 34rem)`, camera `min(18rem, 32vw)`, so a long room/preset label truncates before crowding buffer controls (esp. 390px). Express "authority pill stronger, signal pills quieter" through semantic Solarized tone + weight; reserve loud states for warning/live/danger; add no borders/shadows/size jumps for normal states. *(NN/g #1, #8; style guide Density And Hierarchy Audit; WCAG 2.2 SC 1.4.10 Reflow, AA.)*
- **D7.6 — Contrast targets are LOCKED for legibility. `OPEN` (enforcement only).**
  ≥4.5:1 for body text, ≥3:1 for large text / UI components / borders / focus indicators — fixed targets, not a question. (Enforcement mechanism is the single open item; see Principle 8 D8.4/OQ-8.1. The same numbers are stated there for the semantic layer — they are one set of targets, not two.) *(WCAG 2.2 SC 1.4.3 Contrast Minimum, AA; SC 1.4.11 Non-text Contrast, AA.)*

### Open questions
- **OQ-7.1 — Minimum-size policy:** hard 0.75rem floor everywhere vs a two-tier floor (0.75rem primary / ~0.69rem secondary-metadata-only). See consolidated list.
- **OQ-7.2 — 44px target reconciliation: hit-slop vs visual enlargement.** Note: hit-slop for the two smallest controls (buffer, resend) is **already landed and CI-asserted** (`orchestratorColorAudit.test.ts:122-125` requires `.bufferButton::before` and `.resendButton::before`); the open question is the policy for the remaining sub-44px controls. See consolidated list.

### Guideline references
- WCAG 2.2 SC 1.4.3 Contrast (Minimum) (AA). https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WCAG 2.2 SC 1.4.11 Non-text Contrast (AA). https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- WCAG 2.2 SC 1.4.4 Resize Text & SC 1.4.10 Reflow (AA). https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- WCAG 2.2 SC 2.3.3 Animation from Interactions (**AAA**). https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- WCAG 2.2 SC 2.5.8 Target Size (Minimum) (AA, 24×24 CSS px). https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html  *(Apple's ~44pt and Material's 48dp are the higher bars the app targets on touch via `--orch-touch-target`.)*
- Apple HiG, Foundations — Clarity/Deference/Depth; Typography; Motion. https://developer.apple.com/design/human-interface-guidelines/foundations
- Apple HiG (archival 1992 Mac HIG) — visible state, hierarchy through state not ornament. https://vintageapple.org/inside_r/pdf/Human_Interface_Guidelines_1992.pdf
- NN/g, 10 Usability Heuristics (#1, #8). https://www.nngroup.com/articles/ten-usability-heuristics/
- Material Design 3 (comparative only) — motion duration & easing tokens. https://m3.material.io/styles/motion/easing-and-duration/tokens-specs

### Where it applies
- `src/routes/Orchestrator/views/OrchestratorView.css:40-46` (`--orch-space-*` scale); `:50-53` (focus-ring tokens); `:69-72` (`--text-*` raw values; `--text-lg` unused); `:60-67` (`--aqua-*` shims — removal target); `:39` (`--orch-shadow` — popover/modal only)
- `src/routes/Orchestrator/components/StagePanel.css:86,94` (0.62rem / 0.58rem camera label+detail — busiest-surface legibility risk)
- `src/routes/Orchestrator/components/ApiReference.css` (cluster of 0.58–0.69rem sub-floor sizes — highest typography entropy)
- `src/routes/Orchestrator/components/PresetPicker.css` (11–13px sub-floor literals)
- `src/routes/Orchestrator/components/CodeEditor.css`, `PresetTree.css`, `PresetBrowser.css`, `OrchestratorView.css` (raw durations/easings — motion-token migration sites; existing reduce-motion guards)
- `src/routes/Orchestrator/components/orchestratorColorAudit.test.ts:116-125` (reduce-motion + hit-slop CI guards already in place)
- `src/routes/Orchestrator/components/OrchestratorStatusStrip.css` + `StagePanel.css` (width-bounded calm hierarchy)

---

## Principle 8 — Solarized as a working semantic system, not just a palette

### Interpretation
"Semantic system" means every color is consumed through a *named role token* whose name states its meaning (live, synced, ready, pending, error, reference, selected, applied), never through a raw Solarized hue picked at the point of use.

**Status superseded post-role-routing (phase-11 + phase-13):** the diagnosis below described the pre-migration HEAD and is no longer accurate. The role layer is now complete (`OrchestratorView.css:34-45`) and broadly consumed — at current HEAD, role tokens carry the status surfaces (`--orch-loaded` ~29×, `--orch-selected` ~25×, `--orch-synced` ~16×, `--orch-success` ~13×, `--orch-danger` ~12×, `--orch-warning` ~9×, `--orch-live` ~6×, `--orch-applied` ~4×, `--orch-primary` ~3×; counts are diagnostic and grep-methodology-dependent), and raw-hue refs in component CSS have collapsed from the original ~125 to a small residual (cyan ~9×, red ~1×; blue/yellow/green/violet 0×). The remaining residual is tracked and gated by D8.5. The original pre-migration diagnosis, retained only for trace, read: *"the status-color roles are barely consumed (`--orch-primary`/`--orch-live`/`--orch-danger` 0 consumers, `--orch-warning` 2); every other status surface reaches past the role layer to raw hues (`var(--orch-blue)` 41×, `var(--orch-cyan)` 34×, `var(--orch-yellow)` 27×, `var(--orch-red)` 14×, `var(--orch-green)` 6×, `var(--orch-violet)` 3×) — palette, not system."*

> **Scope correction (important):** the "consumed in only two places" claim is scoped to the **status-color role tokens** above. It does **not** apply to the focus role: `--orch-focus` has ~11+ references across 4 files (PresetTree, PresetBrowser, ApiReference, OrchestratorView) — the focus role IS adopted, consistent with the landed focus-ring work in Principles 3 and 5.

### Style directions

- **D8.1 — Complete the named semantic-role layer; forbid raw-hue refs outside the token block. `DONE` (maintain — enforcement is D8.5).**
  Shipped (phase-11 + phase-13 role-routing). The role layer is complete in the `.container` block (`OrchestratorView.css:34-45`): status roles `--orch-primary`/`-live`/`-success`/`-applied`/`-warning`/`-danger`, plus the §4.11 semantic aliases `--orch-loaded` (= primary/blue), `--orch-selected` (= warning/yellow), `--orch-synced` (= live/cyan), and `--orch-reference` (= muted). Per OQ-8.2, **`--orch-camera` is intentionally omitted** — camera shares `--orch-synced`/`--orch-live` cyan (explicit comment at `:45`). Components now consume the role, not the hue (loaded ~29×, selected ~25×, synced ~16×, danger ~12×, success ~13× at HEAD). The "forbid raw-hue refs outside the token block" enforcement is tracked under D8.5. *(Apple HiG Color — use color consistently/semantically; Material 3 token tiering COMPARATIVE only; NN/g #4 Consistency.)*
- **D8.2 — One tokenized "status tone recipe", applied everywhere. `DONE` (maintain — residual hand-mixed tints tracked by D8.5).**
  Shipped (phase-11 + phase-13). The three tint-strength tokens are defined (`OrchestratorView.css:66-68`): `--orch-tone-fill: 14%`, `--orch-tone-emphasis-fill: 22%`, `--orch-tone-border: 55%`. State/tone classes now express the recipe through `color-mix(... role-token var(--orch-tone-*) ...)` rather than hand-copied magic numbers (StatusStrip tone classes, PresetTree badge sets, the inline CodeEditor send mixes). **Residual:** a small set of still-hand-mixed cyan/red tints survives outside the routed state classes (see D8.5) — those drift values, not the recipe itself, are the remaining cleanup. *(Material 3 state-layer / tonal-opacity model COMPARATIVE; Apple HiG Color consistency; NN/g #8.)*
- **D8.3 — Redundant (non-color) encoding stays mandatory and checked. `DONE` (maintain).**
  Every status conveyed by a role token also carries text or icon/shape and placement; the PresetTree badges and StatusStrip pills never differ by color alone between two states an operator must distinguish (Selected vs Applied vs Loaded carry distinct text). This is already true at HEAD and feeds the landed accessible-name work (D3.1). Maintain. *(WCAG 2.2 SC 1.4.1 Use of Color, A; Apple HiG Accessibility; NN/g #1.)*
- **D8.4 — Tokenized contrast TARGETS, with a "fills are never text color" rule. `OPEN` (targets LOCKED; rule new).**
  Targets are **fixed**: text roles ≥4.5:1 against their resolved surface; large-text / UI-component / border / focus roles ≥3:1. Adopt the rule that any glyph uses a role's full-strength TEXT variant and the 14% fills are background-only (the decorative fills would fail as text), so a low-contrast text use cannot be authored even before automated contrast computation exists. Record the target pairs in the style guide's contrast-spec section; treat dark Solarized (base03) as the audited context. *(WCAG 2.2 SC 1.4.3 Contrast Minimum, AA; SC 1.4.11 Non-text Contrast, AA; Apple HiG Accessibility ≥4.5:1 body.)*
- **D8.5 — Extend the color audit with a "no raw hue past the role layer" static guard. `PARTIAL` (landed, staged warn-then-enforce).**
  The static guard (c) is implemented (phase-13): the audit flags raw-hue refs in component CSS outside the token block via a **file-wide enforced** sweep that asserts `collectFileWideRawHues()` is empty for migrated state surfaces, minus a deliberately narrow allowlist (neutral interaction chrome + the deferred PresetBrowser `.error`), plus a **warn-then-enforce ceiling** on raw-hue refs in state classes. It still (a) bans raw `#hex`/`rgb`/`hsl` and (b) verifies `var(--orch-*)` refs resolve. **Remaining for DONE:** route the residual hand-mixed tints (PresetBrowser/StagePanel/PresetTree cyan + the one PresetBrowser `.error` red — the residual measured well under the ceiling at HEAD) and the deferred PresetPicker/non-state tints, then flip the ceiling to a zero-gate. *(Apple HiG Color; NN/g #5 Error Prevention; Material 3 token tiering COMPARATIVE.)*

### Open questions
- **OQ-8.1 — Contrast enforcement mechanism/timing only** (the targets are locked): extend the audit now to compute contrast on the flat, non-`color-mix()` token pairs vs author the pass/fail matrix as a docs spec first vs documented review-checklist only. The blocker on full measurement is the BLOCKED Nix Chromium e2e / no screenshot harness; the audit is regex-only today. See consolidated list.
- **OQ-8.2 — Cyan overload:** **RESOLVED → one cyan "live signal" family** (synced + camera + applied, disambiguated by text/placement); no magenta `--orch-camera`. Implemented: `.badgeCam` routes `--orch-live` (= `--orch-synced`, cyan) (`PresetTree.css:124-126`); `--orch-camera` omitted (`OrchestratorView.css:45`). The former de-facto inconsistency (a blue `Cam` badge vs the cyan strip pill) is gone. See consolidated list.
- **OQ-8.3 — Tint strength on luminance-flat Solarized:** keep uniform ~14% fills vs raise alarm-role emphasis to ~22–28% vs add a full-strength left-border accent for alarm states. Cannot be validated empirically (e2e blocked) — a human visual call. See consolidated list.

### Guideline references
- WCAG 2.2 SC 1.4.3 Contrast (Minimum) (AA). https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WCAG 2.2 SC 1.4.11 Non-text Contrast (AA, 3:1). https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- WCAG 2.2 SC 1.4.1 Use of Color (A). https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- Apple HiG, Foundations › Color (use color consistently; don't rely on color alone). https://developer.apple.com/design/human-interface-guidelines/color
- Apple HiG, Accessibility (≥4.5:1 text; avoid color-only meaning). https://developer.apple.com/design/human-interface-guidelines/accessibility
- Material Design 3 (comparative only) — reference palette → system/role tokens; state-layer opacity model. https://m3.material.io/styles/color/the-color-system/color-roles
- NN/g, 10 Usability Heuristics (#1, #4). https://www.nngroup.com/articles/ten-usability-heuristics/
- Ethan Schoonover, Solarized — accents share near-equal lightness (why color-only separation is weak). https://ethanschoonover.com/solarized/

### Where it applies
- `src/routes/Orchestrator/views/OrchestratorView.css:22-39` (role/surface block — complete the role layer + tone-mix tokens); `:3-20` (raw-hue token block — the only allowed home for raw hues / audit boundary)
- `src/routes/Orchestrator/components/orchestratorColorAudit.test.ts:5-17,47-80` (audited files + the two existing static checks — extend with D8.5)
- `src/routes/Orchestrator/components/OrchestratorStatusStrip.css` (tone classes hand-deriving the recipe from raw hues)
- `src/routes/Orchestrator/components/HydraPreview.css:44-60` (`--orch-preview-*` tone sets duplicating the recipe)
- `src/routes/Orchestrator/components/PresetTree.css:55-87` (badge tints — cyan overload + blue-vs-cyan camera inconsistency)
- `src/routes/Orchestrator/components/CodeEditor.css` (send-state colors inline with raw hues — should consume success/danger/warning roles)
- `src/routes/Orchestrator/components/PresetBrowser.css` + `PresetTree.css` (the only two `--orch-warning` consumers — layer exists but bypassed)
- `docs/architecture/orchestrator-synthesis-ui-style-guide.md:81-117` (Solarized table + color rules — color table assigns cyan to synced AND camera)
- `docs/architecture/orchestrator-operator-journey.md:42-56` (status-ownership table owns the WORDS; this principle owns the HUES behind them)

---

## Principle 9 — Early HiG principles become app-specific rules for layout, feedback, and control behavior

### Interpretation
The abstract HiG canon — visible state, no hidden modes, immediate feedback, direct manipulation, labels-match-behavior, error prevention/recovery — must be discharged as concrete, statically-checkable Orchestrator rules. Because authenticated Nix Chromium e2e is blocked, the bias is toward rules a token audit, a render-test, or a source-grep can prove. The four HiG verbs land on four surfaces: layout = status-near-subject placement; feedback = sub-100ms acknowledgement + the aria-live regions (now landed); control behavior = no core/destructive action hover-only, authority a persistent visible pill; recovery = the 4000ms send-expiry/resend path as an announced, determinate-leaning lifecycle.

### Style directions

- **D9.1 — Add a "Verification mechanism" column to visual-system Principle 9's mapping; require each new PR to cite the rule id + how it's checked. `OPEN`.**
  Each of the six HiG verbs must have ≥1 rule whose verification is one of: an extension of `orchestratorColorAudit.test.ts`, a render-test asserting an ARIA attribute, the `orchestratorStatusOwnership.test.ts` duplicate-owner check, or a source grep. This converts the doc from prose into a checklist enforceable despite blocked e2e, and closes the meta-finding that "contrast is CI-enforced" was overstated. *(Apple HiG Clarity & consistency; NN/g #1, #4.)*
- **D9.2 — Feedback rule: every side-effecting command acknowledges within ~100ms AND via an AT channel. `DONE` (maintain) + extend.**
  The four status surfaces' live regions are landed (D5.3 / D6.5): remote banner, status strip, send pills, preview overlay. Maintain via render-tests. **Extend:** add the visible in-flight state to Apply/Dismiss on the remote banner (D5.5). *(WCAG 2.2 SC 4.1.3 Status Messages, AA; Apple HiG immediate-feedback.)*
- **D9.3 — Control-behavior rule: authority is always a persistent visible pill; no core/destructive action hover-only. `PARTIAL`.**
  Authority is a persistent pill on the Stage strip (owned per the status table) — maintain, and verify the always-present invariant with a render-test across all three modes. **Remaining:** restore the PresetTree desktop folder actions from `opacity:0`-until-hover to persistently visible/focusable (D5.2 / backlog #14), authority gating unchanged. Hover-only on touch is effectively a hidden mode. *(Archival Mac HIG — make modes visible; WCAG 2.2 SC 2.5.8 Target Size, AA; NN/g #6.)*
- **D9.4 — Layout rule: codify the status-ownership table as a placement contract, enforced two ways. `PARTIAL`.**
  (a) Keep the `orchestratorStatusOwnership.test.ts` one-owner-per-label duplicate check as the cross-surface guard. (b) Add the spatial corollary to the style guide: per-row state on the row; source-binding warnings in the HydraPreview overlay or on the affected preset action (never a detached banner); the centralized strip only for cross-cutting authority/broadcast/camera. New status text declares its owning surface and adjacency. (The camera connection-vs-binding second-renderer coverage gap, D6.2, is the concrete remaining work.) *(Apple HiG — status near its subject; NN/g #1; Gestalt proximity.)*
- **D9.5 — Recovery rule: the send lifecycle never presents a frozen indeterminate state. `PARTIAL`.**
  The 4000ms send-expiry timer (`useOrchestratorWorkspace.ts`) and the resend control exist; "Sending…" resolves to Synced / Failed (with resend), and the live region (D5.3) is landed. **Remaining:** guarantee the timeout moves the pill to a Failed/stalled state announced via the send-pill live region, and never morph a spinner into a bar. Verify by render-test on the sendState transitions. *(Apple HiG progress indicators — keep moving / prefer determinate / no shape-morph; NN/g #9; Material 3 determinate-vs-indeterminate COMPARATIVE only.)*
- **D9.6 — Labels-match-behavior rule: `FORBIDDEN_PREVIEW_TERMS` is the canonical guard; every claim-bearing label states its allowed claim. `DONE` (maintain).**
  Keep `FORBIDDEN_PREVIEW_TERMS` enforcement (`orchestratorPresentationModel.ts`) as the exemplar; generalize "every label declares its allowed claim" per the Preview/Output Model's allowed-claim column. The mobile-Stage qualifier fix (backlog #10) is **landed** (see D2.4): the phone shows the compact `· Preview` qualifier, not bare "STAGE". Maintain. *(Archival Mac HIG — labels match observable behavior; NN/g #2.)*

### Open questions
- **OQ-9.1 — Binding numeric acknowledgement budget and its non-e2e assertion.** See consolidated list.
- **OQ-9.2 — Per-pill aria-live name-prefix vocabulary: derive mechanically from the status labels vs author dedicated strings.** Note: the prefix is already implemented mechanically as `<prefix>: <label>` at HEAD (`OrchestratorStatusStrip.tsx:18-22`); the open question is whether to *lock* the derive-from-single-source approach as the rule vs allow authored phrasing. See consolidated list.
- **OQ-9.3 — No-hover-only rule: persistently visible on ALL pointer types vs forced-visible on touch/coarse + `:focus-within` while desktop keeps hover reveal.** See consolidated list.

### Guideline references
- Apple HiG, Foundations — Clarity/Deference/Depth; consistency/feedback patterns. https://developer.apple.com/design/human-interface-guidelines/
- Apple HiG (archival 1992 Mac HIG) — visible state, no hidden modes, immediate feedback, labels match behavior. https://vintageapple.org/inside_r/pdf/Human_Interface_Guidelines_1992.pdf
- WCAG 2.2 SC 4.1.3 Status Messages (AA). https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WCAG 2.2 SC 2.4.7 Focus Visible (AA) and SC 2.4.13 Focus Appearance (**AAA** — indicator size/quality). SC 2.4.11 Focus Not Obscured (Minimum, AA) applies only to clipped/obscured focus (e.g. inset offset on fixed tabs). https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- WCAG 2.2 SC 1.4.3 Contrast (Minimum) / SC 1.4.11 Non-text Contrast. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WCAG 2.2 SC 2.5.8 Target Size (Minimum) (AA, 24×24 CSS px). https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- NN/g, 10 Usability Heuristics (#1, #2, #6, #9). https://www.nngroup.com/articles/ten-usability-heuristics/
- Material Design 3 (comparative only) — progress indicators; motion duration/easing tokens. https://m3.material.io/styles/motion/easing-and-duration/tokens-specs

### Where it applies
- `docs/architecture/orchestrator-visual-system.md:98-104` (Principle 9 mapping — add the verification-mechanism column)
- `docs/architecture/orchestrator-synthesis-ui-style-guide.md:67-76` (Core UX Rules — where the HiG→rule mapping is expressed)
- `docs/architecture/orchestrator-operator-journey.md:38-55` (status-ownership table — layout/near-subject contract)
- `src/routes/Orchestrator/components/orchestratorStatusOwnership.test.ts` (one-owner duplicate guard — verification for D9.4)
- `src/routes/Orchestrator/components/orchestratorColorAudit.test.ts:47-125` (audit-as-verification — the model to extend)
- `src/routes/Orchestrator/components/orchestratorPresentationModel.ts` (`FORBIDDEN_PREVIEW_TERMS` — exemplar labels-match-behavior guard)
- `src/routes/Orchestrator/views/OrchestratorView.tsx:110-122` (remote banner — aria-live landed)
- `src/routes/Orchestrator/components/OrchestratorStatusStrip.tsx:18-49` (aria-live + per-pill prefix landed)
- `src/routes/Orchestrator/components/CodeEditor.tsx:493-531` (send/resend lifecycle; live region landed)
- `src/routes/Orchestrator/components/HydraPreview.tsx:323-337` (overlay live region landed)
- `src/routes/Orchestrator/views/useOrchestratorWorkspace.ts` (4000ms send-expiry — stalled-state/recovery surface)
- `src/routes/Orchestrator/components/PresetTree.css:89-106` (folder actions hover-only — D9.3)
- `src/routes/Orchestrator/components/StagePanel.tsx:108-121` (buffer radiogroup — landed)
- `src/routes/Orchestrator/components/StagePanel.css:59-71` (mobile `· Preview` qualifier — landed, D9.6)

---

## Open questions for the user (decisions that gate concrete adoption)

These are the genuinely-open product/design calls. Items already landed are excluded. **(Reconciliation 2026-06-01:** three items below — OQ-3.1 (#6), OQ-3.2 (#7), OQ-6.1 (#13) — were resolved by the early-HiG shape decisions + `orchestrator-visual-language.md` §3; they are marked **✅ RESOLVED in place** rather than renumbered, to keep list numbering and the decision trail stable.**)**

1. **OQ-1.1 Desktop entry focus target** — (a) no programmatic focus + a documented accelerator (`/` or Cmd-F) to jump to search on demand; (b) focus the Stage/preview region (a non-input landmark); (c) auto-focus the Presets search on desktop only (accept the AT tradeoff). *Tradeoff: expert speed vs calm/non-disruptive, AT-safe entry. Repo does neither today.*
2. **OQ-1.2 Persist last working context across visits?** — (a) persist only inert local view state (expanded folders, last buffer, panel width); (b) persist last selected preset as Selected-only, re-deriving applied truth fresh each session; (c) persist nothing beyond the existing ref-panel width. *Must never persist anything reading as Player/applied truth.*
3. **OQ-1.3 Global command affordance?** — (a) no palette, keep per-surface controls + an inline role-scoped shortcut hint; (b) a capability-filtered command palette (no raw-code entries for collaborators); (c) defer entirely.
4. **OQ-2.1 Snapshot desktop geometry** — **RESOLVED → Option A (no snapshot)** (owner decision 2026-06-04): the Orchestrator does not surface a Player-Output snapshot, so no snapshot geometry is adopted and no adjacent slot is reserved. The real Player still has audience output; the Orchestrator declines to mirror it. A live mirror (former Option C) is only theoretically possible behind a fresh future ADR — not a roadmap item. Options retained for trace: (a) side-by-side peers (1-up→2-up); (b) Local Preview large + snapshot inset; (c) segmented Local/Output swap.
5. **OQ-2.2 Does borrowing Player MP4 change the "approximate" frame?** — (a) frame constant, only the status-capsule tint signals source; (b) slightly strengthen the frame when using Player MP4; (c) frame constant + an explicit "approximate even when using Player media" secondary label.
6. **OQ-3.1 Card vs dense row at higher density** — **✅ RESOLVED → dense row + reserved fixed-height badge lane** (early-HiG shape decision; `orchestrator-visual-language.md` §3). Options retained for trace: (a) keep dense row only, invest richness in badges/notices; (b) code-snippet/parameter preview on hover/expand only (no thumbnail); (c) optional card density mode behind a toggle, deferred until a sanctioned non-output preview-capture exists; (d) defer until a visual-QA harness exists. *No thumbnail may imply output truth (`FORBIDDEN_PREVIEW_TERMS`).*
7. **OQ-3.2 Couple or separate Select and Load?** — **✅ RESOLVED → decouple** (single-click = Select, explicit Load button = Load; Enter = Select) (`orchestrator-visual-language.md` §3). Options retained for trace: (a) keep click = Select+Load (fast path), documented as intentionally coupled but distinct truths; (b) click = Select only, Enter/Load button decouples; (c) single-click = Select, double-click/Enter = Load; (d) per-mode default (Host couples, Browse-only decouples). *Space is already bound to Send.*
8. **OQ-3.3 Stale `Applied on Player`** — (a) binary only (drop instantly on mismatch); (b) a transient subordinate "recently applied" decay, paired with text, only if it can't read as a competing Player-truth claim; (c) leave superseded-state to the strip's `Remote update` ownership, row stays binary; (d) ~~defer until an Option B snapshot anchors a non-binary claim~~ — N/A under Option A (no snapshot; choose among a–c).
9. **OQ-4.1 Stage:Code row ratio / splitter** — (a) Stage `minmax(0,1fr)` + Code `minmax(14rem, 38dvh)`; (b) Stage `minmax(0,1fr)` + Code `clamp(12rem, 30dvh, 22rem)`; (c) add a keyboard-operable vertical splitter (mirroring the refPanel resize), persist the Host's choice, default Stage-dominant; (d) fixed Stage-dominant ratio now, defer the splitter.
10. **OQ-4.2 Pending-edits prominence on mobile tab-away** — (a) keep only the tab dot, rely on the strip `Local edits` pill; (b) keep the dot + an aria-live announcement on tab-away; (c) a one-time dismissable inline hint near the Code tab; (d) a count on the dot (risks duplicating strip ownership).
11. **OQ-5.1 Buffer keyboard semantics** — (a) full APG radiogroup with roving tabindex + arrow-key selection; (b) attribute-only `role='radio'`/`aria-checked`, keep tab-per-button (current state); (c) model as a single-select listbox/segmented toggle if the visual reads more like a toggle bar.
12. **OQ-5.2 Folder-action discoverability** — (a) quiet-by-default, hover/focus-intensified (mirror mobile, lowest cost); (b) always-visible per-folder overflow ("More") trigger (calmest header, adds a tap); (c) persistent full-emphasis buttons on desktop (most direct, highest density cost). *Also surfaces as OQ-9.3 — pointer-type scope.*
13. **OQ-6.1 Operator broadcast/send status placement** — **✅ RESOLVED → option (a)**: strip is sole text owner + row-local non-textual ack (`orchestrator-visual-language.md` §3). Options retained for trace: (a) strip pill remains sole owner; the row shows only a brief non-textual ack (spinner/checkmark) with no duplicated wording; (b) a row-local send-state line in `rowNotice` for the just-sent row, using DISTINCT row-owned wording; (c) keep strip-only and rely on aria-live + strip adjacency.
14. **OQ-6.2 Move the cameraPipeline (source-binding) block onto the preview frame?** — (a) keep it in the header right group but relabel as source/binding; (b) move source-binding onto the HydraPreview overlay, leaving only relay connection in the strip pill; (c) merge both camera renderers into one strip pill (connection primary, binding secondary). *Touches high-risk StagePanel/HydraPreview + camera relay.*
15. **OQ-6.3 Mobile status proximity at 390px** — (a) collapse non-critical pills into a tap-to-expand summary, keep critical states (Failed, Camera error, Sending) inline above the preview; (b) pin a minimal status line on the preview overlay on mobile, demote the full strip; (c) keep the three-row wrap, width-limit the camera card, accept the vertical distance.
16. **OQ-7.1 Minimum-size policy** — (a) hard 0.75rem floor everywhere (accept header re-layout, verify reflow by manual phone QA); (b) two-tier (0.75rem primary / ~0.69rem secondary-metadata-only) with an explicit exception list; (c) raise only the truly sub-readable cases (<0.65rem) to a 0.65rem secondary floor, leave 0.65–0.74rem for now.
17. **OQ-7.2 44px reconciliation policy (remaining controls)** — (a) hit-slop only on the smallest/most-missed controls on touch (buffer + resend already done), keep desktop visual size; (b) enlarge to 44px on touch viewports only; (c) document a per-control policy table and enforce effective ≥44px on touch in the density audit. *Owned by Gate 3a-ii/3f.*
18. **OQ-8.1 Contrast enforcement mechanism/timing** (targets are LOCKED) — (a) extend the audit now to compute contrast on flat (non-`color-mix`) token pairs, defer `color-mix` surfaces; (b) author the token-pair pass/fail matrix as a docs spec first, wire the audit later; (c) documented review checklist only until the matrix exists. *Full measurement blocked by the Nix Chromium e2e issue.*
19. **OQ-8.2 Cyan overload** — **RESOLVED → option (a)** (`orchestrator-visual-language.md` §6/OQ-8.2; phase-11 + phase-13): one cyan "live signal" role disambiguated by text/placement, no magenta `--orch-camera`. Implemented at HEAD: `.badgeCam` routes `--orch-live` (= `--orch-synced`, cyan) (`PresetTree.css:124-126`) and `--orch-camera` is intentionally omitted from the role layer (`OrchestratorView.css:45`); the prior blue-vs-cyan inconsistency is gone. Options retained for trace: (a) keep one cyan "live signal" role (synced + camera + applied), disambiguate by text/placement; (b) reserve cyan for broadcast synced/live, give camera its own role (magenta); (c) map camera to cyan but distinguish broadcast-synced with shape/icon + green success on confirm.
20. **OQ-8.3 Tint strength on luminance-flat Solarized** — (a) keep uniform ~14% fills, rely on full-strength text/border + label; (b) two-tier (quiet ~14% / alarm ~22–28%); (c) keep tints quiet + add a thin full-strength left-border accent on alarm states. *Cannot validate empirically — e2e blocked; human visual call.*
21. **OQ-9.1 Acknowledgement budget + non-e2e assertion** — (a) adopt ~100ms "feels instant" as a documented target, verified indirectly by render-tests that the ack element renders synchronously on dispatch; (b) 100ms visual ack + a separate ~1s budget before a determinate/stalled indicator must appear (aligning the 4000ms expiry under explicit tiers); (c) defer a numeric budget, ship only "acknowledge synchronously, never freeze".
22. **OQ-9.2 Per-pill aria-live vocabulary** — (a) lock the mechanical `<ownerCategory>: <existing label>` derivation as the rule (single source, guarded by the ownership test) — matches current implementation; (b) allow a dedicated authored string per pill, with a test asserting it contains the visible label as a substring; (c) drop the per-pill prefix, rely on the container aria-label + visible text.
23. **OQ-9.3 No-hover-only rule pointer scope** — (a) always visible on coarse-pointer/touch + `:focus-within` for keyboard, retain hover-fade on fine-pointer desktop only; (b) always visible on every pointer type (more desktop density); (c) keep hover reveal but add a persistent overflow/kebab exposing the same actions. *Overlaps OQ-5.2.*

---

## Guideline source index (deduped)

**Apple Human Interface Guidelines (modern; developer.apple.com pages are JS-rendered, cited from trained knowledge + WebSearch-confirmed specifics per the backlog method note):**
- Foundations — Clarity, Deference, Depth: https://developer.apple.com/design/human-interface-guidelines/foundations
- Foundations › Layout: https://developer.apple.com/design/human-interface-guidelines/foundations/layout/
- Foundations › Feedback: https://developer.apple.com/design/human-interface-guidelines/feedback
- Foundations › Color: https://developer.apple.com/design/human-interface-guidelines/color
- Foundations › Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Patterns › Keyboards: https://developer.apple.com/design/human-interface-guidelines/keyboards

**Apple Human Interface Guidelines (archival, cited by the style guide):**
- 1992 Macintosh HIG (PDF) — see-and-point, visible state, no hidden modes, immediate feedback, labels match behavior: https://vintageapple.org/inside_r/pdf/Human_Interface_Guidelines_1992.pdf
- 1987 Open Library record: https://openlibrary.org/books/OL7406922M/Apple_Human_Interface_Guidelines?show_page_status=1

**WCAG 2.2:**
- SC 1.4.1 Use of Color (A): https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- SC 1.4.3 Contrast (Minimum) (AA): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- SC 1.4.4 Resize Text (AA) / SC 1.4.10 Reflow (AA): https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- SC 1.4.11 Non-text Contrast (AA, 3:1): https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- SC 2.3.3 Animation from Interactions (**AAA**): https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- SC 2.4.7 Focus Visible (AA) / SC 2.4.11 Focus Not Obscured Minimum (AA, clipped/obscured only) / SC 2.4.13 Focus Appearance (**AAA**): https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- SC 2.5.7 Dragging Movements (AA, new in 2.2) + F108: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements
- SC 2.5.8 Target Size (Minimum) (AA, 24×24 CSS px): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- SC 3.2.1 On Focus (A): https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html
- SC 4.1.2 Name, Role, Value (A): https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html
- SC 4.1.3 Status Messages (AA): https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html

**W3C WAI-ARIA Authoring Practices (APG):**
- Radio Group / Disclosure / Menu Button: https://www.w3.org/WAI/ARIA/apg/patterns/radio/
- Slider (cited by the style guide for future parameter controls): https://www.w3.org/WAI/ARIA/apg/patterns/slider/

**Nielsen Norman Group:**
- 10 Usability Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- Progressive Disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- Complex Application Design: https://www.nngroup.com/articles/complex-application-design/

**Material Design 3 (COMPARATIVE REFERENCE ONLY — this app is HiG + Solarized, not Material; cited only for concrete adoptable numbers, never the Material visual language):**
- Elevation (dark-theme tint-led depth): https://m3.material.io/styles/elevation/overview
- Color system / token tiering: https://m3.material.io/styles/color/the-color-system/color-roles
- State layers: https://m3.material.io/foundations/interaction/states/state-layers
- Motion easing & duration tokens: https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
- Progress indicators: https://m3.material.io/components/progress-indicators

**Ethan Schoonover, Solarized (cited by the style guide):** https://ethanschoonover.com/solarized/

