# Orchestrator UX — journey + status-ownership — analysis — 2026-05-30

> Gate 3a-i of the Orchestrator UX architecture pass. Slice: `orchestrator-ux-journey-and-status-ownership` (mo 180).
> Durable contract: [`docs/architecture/orchestrator-operator-journey.md`](../architecture/orchestrator-operator-journey.md).

## Context

Before the Gate 3b–3f implementation slices touch the Orchestrator UI, they need a single
authoritative contract for (a) the operator/host workflow and (b) which surface owns each
status label. Phase 9 unified the label *wording*; this slice unifies label *ownership* across
surfaces and adds the missing journey legs.

## Decision

- **Journey map** covering browse → load → edit → preview → send → confirm → recover for Host,
  Operator, and Browse-only. Adds the **edit** (host live-code) and **recover** (failed-send
  resend, remote-update conflict) legs that the preset-operator UX spec did not cover.
- **Cross-surface status-ownership table** assigning every current label to exactly one owning
  surface, with no cross-surface duplication.

## Key resolutions

- **`Remote update` overlap:** the Stage **broadcast pill** owns the compact *status*; the
  `OrchestratorView` **remote banner** owns the *action* (Apply/Dismiss). Distinct jobs, not
  duplication — Gate 3b keeps the pill action-free.
- **`live` wording:** `Host live coding` (authority) and `Camera live` (camera connection)
  legitimately carry "live"; the preview stays forbidden from it (`FORBIDDEN_PREVIEW_TERMS`).
- **Player Output (snapshot) reserved slot:** per the [Player Live ADR](../architecture/orchestrator-player-live-decision.md)
  decision (Option B), the preview overlay reserves a future, not-yet-implemented
  `Player Output (snapshot)` slot adjacent to `Local Preview`. Gate 3 must **not** finalize
  `Local Preview` as the terminal preview truth.

## Inventory (verified 2026-05-30)

- Stage strip (`orchestratorStatus.ts`): authority {Host live coding, Preset operator, Browse only, Policy blocked}; broadcast {Sending, Synced, Failed, Local edits, Broadcast ready, Remote update}; camera {Camera connecting, Camera live, Camera error, Camera idle}.
- Preview overlay (`orchestratorPresentationModel.ts`): primary {Local Preview}; secondary {Visualizer off, Waiting for Player media, Preview using Player MP4, Preview uses preset video source, Player audio reactive, Simulated audio}.
- PresetTree badges (`PresetTree.tsx`): {Gallery, Selected, Loaded in preview, Applied on Player, Start, Cam}.
- PresetBrowser (`PresetBrowser.tsx`): policy/party-folder panel notice + empty-state copy.
- Remote banner (`OrchestratorView.tsx`): "Remote update available (×N)" + Apply/Dismiss.

## Consequences

Gate 3b reconciles the Stage strip + preview overlay (incl. pill/banner split + reserved slot);
Gate 3c aligns PresetTree badges + PresetBrowser notice. Gate 3a-ii (separate) owns spacing/focus
tokens. No runtime code changed in this slice.

## Rollback

`git revert <merge-sha>` — docs-only, fully reversible.
