# Orchestrator shape decisions — early-HiG red-team — 2026-05-31

> Adversarial review of two user shape decisions against the **early** Apple HiG canon (1987/1992
> Macintosh Human Interface Guidelines), with a steelman, via a fan-out workflow (`wf_0e5ca335-773`).
> Records the verdict + mitigations and resolves several style-directions open questions.
> Companion to [orchestrator-style-directions.md](../architecture/orchestrator-style-directions.md).

## The decisions reviewed

- **D1 — preset object = "dense row + state badges"** (one line per preset, state as trailing text badges), chosen over a split-row state-lane and over a card/tile.
- **D2 — status placement = "header strip (current)"** (authority/broadcast/camera pills above the preview frame), chosen over on-frame chips and over a hybrid.

## Verdict: both **keep-with-mitigations**. Neither warrants reconsideration.

The attacks landed on **implementation gaps, not the chosen shapes**, and the steelman confirmed the rejected alternatives each lose **more** early-HiG ground (a card breaks at-rest scan/perceived-stability; on-frame chips breach the locked "chrome readable over bright Hydra output" rule).

### D1 — dense row
- **Holds:** genuine *direct manipulation* + *see-and-point* — the row is `role=button`/`tabIndex=0`/`aria-pressed`, selection paints a persistent blue rail, and Load/Send are persistent, non-hover-gated verbs (`PresetTree.tsx:310-365`; `.actions` has no opacity gate, unlike `.folderActions`). Redundant color+text badges satisfy WYSIWYG/recognition.
- **Surviving objection — *perceived stability* (HIGH):** badges render inline in a `flex-wrap` `.presetMeta` (`PresetTree.css:257-261`) inside a flex-column `.presetMain` above a conditional `.rowNotice`, with `.presetRow min-height` a *floor* only (`:205,341`). State changes mid-set make rows grow/wrap and shift every row below — the click target moves under the operator.
- **Mitigations (keep the shape):**
  1. **Reserved fixed-height badge lane** — `.presetMeta` becomes a single non-wrapping row with a fixed height (badges elide rather than wrap); row geometry never changes on state churn. (`PresetTree.css:257-261`, `.presetRow` height.)
  2. **Cap + reorder badges strongest-truth-first** per the FIRM D3.2 (`Applied → Loaded → Selected → Start → Cam → Gallery`), and apply the same order to the accessible-name composition (`PresetTree.tsx:282-291`, today leads with `Loaded in preview`).
  3. **Decouple Select from Load** — single click/Enter = Select (binds the rail), explicit Load button/double-click = Load. Removes the silent-auto-Load modeless seam (`PresetTree.tsx:315`). **Resolves OQ-3.2.**
  4. **Gallery on the row** — paint `GALLERY_BADGE_LABEL` on gallery preset rows (today only on the folder header) so read-only gallery ≠ saved at the row level. Closes the WYSIWYG identity gap.

### D2 — header strip
- **Holds:** the strip is the *right* owner of cross-cutting Stage governance and the best answer to the locked "chrome readable over bright/arbitrary Hydra output" rule (Principle 7 / D6.3) — on-frame chips/hybrid breach it. Authority stays a persistent visible pill (no hidden mode).
- **Surviving objection — *feedback-and-dialog* for the non-host Operator (HIGH):** the Operator's primary action is a preset-row **Send** (`PresetTree.tsx:350-365`) with **zero row-local feedback**; `Synced`/`Failed` appears only in the Stage-header strip — a different dock, and on mobile a different **tab** (the cross-tab dot is keyed only to the *editor* send, `OrchestratorView.tsx:166-167`).
- **Mitigations (keep the strip):**
  1. **Row-local NON-textual send ack** — on `onSend(preset)` show a brief spinner/✓/✗ glyph on that row only; the strip keeps sole ownership of the `Synced`/`Failed` **text** (one-owner-per-label preserved). Feedback now appears at the point of action. **Resolves OQ-6.1 (option a).**
  2. **Mobile Presets-tab dot** for pending/failed row-Send, so action and result aren't on different screens (`OrchestratorView.tsx:143-181`).
  3. **Fix the camera double-label** (genuine consistency bug, present regardless of D2): `Camera live` (strip, relay connection) vs `Camera Live` (cameraPipeline, source-binding) collide and the one-owner audit only sees the strip pill. Relabel the pipeline as *source/binding* and extend `orchestratorStatusOwnership.test.ts` **in the same slice** (D6.2), or the guard self-trips.
  4. **Reconcile the Host-path duplication** — the CodeEditor inline `Synced`/`Send failed` pill (`CodeEditor.tsx:503-509`) is intentional per-surface co-location (D6.5); document in the ownership table that the editor-send-region owns the *editor* ack while the strip broadcast pill owns *room broadcast state*.

## What this settles

- **OQ-3.1 (card vs dense row) → dense row, settled.** The reserved fixed-height lane answers the density-vs-richness tension without a card.
- **Resolves OQ-3.2 and OQ-6.1; executes the FIRM D3.2 and D6.2.** On-frame status stays rejected (locked readability constraint). Reopens nothing structural.
- Net: the shapes are early-HiG-sound; they need a **reserved badge lane** (D1) and a **row-local Send ack** (D2) to close the two debts.

## Rollback
Docs-only; `git revert <sha>`.
