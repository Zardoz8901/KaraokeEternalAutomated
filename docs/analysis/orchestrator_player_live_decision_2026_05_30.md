# Orchestrator Player Live decision — analysis — 2026-05-30

> Gate 2 of the Orchestrator UI/UX roadmap. Slice: `orchestrator-player-live-decision` (merge_order 170).
> Durable ADR: [`docs/architecture/orchestrator-player-live-decision.md`](../architecture/orchestrator-player-live-decision.md).

## Context

After Phases 8–10 closed the Local Preview clarity track, the open architecture
question before any Orchestrator UX polish (Gate 3) is the **Player Live
boundary**: does the Orchestrator stay an honest local-approximate preview, or
will it eventually show actual Player output via snapshot (B) or live mirror (C)?
The Gate 3 status language and Stage-strip layout cannot be finalized until this
is decided. This is a docs-first decision; it implements nothing.

## Decision

Drafted a neutral A/B/C decision ADR (Status: **Proposed**, decision pending
user review), with a documented lean toward **B** (snapshot) as the pragmatic
target, **A** (local-only) as the zero-cost fallback, and **C** (live mirror)
deferred behind explicit triggers. The final A/B/C choice is the user's to make
at review; this slice produces the framing, not the decision.

## Verified technical foundations (so the ADR is grounded, not hand-waved)

- Player renders Hydra to a real `<canvas>` — `HydraVisualizer.tsx:803` (`canvasRef`); `canvas.captureStream()` is therefore feasible for B/C.
- Reverse-direction WebRTC relay with subscriber pinning already exists — `server/Player/socket.ts` (`CAMERA_OFFER_REQ`/`CAMERA_ANSWER_REQ`, `roomCameraSubscribers`, KI-3): a reusable transport/signaling spine for C.
- Pinned Player identity `{socketId, playerInstanceId}` (`isPinnedPlayerIdentity`, `server/Player/socket.ts:305`) already gates `PLAYER_EMIT_VISUALIZER_APPLIED`; any Player-output surface should bind to it to resolve multi-Player ambiguity.
- Player-output truth is `OrchestratorPlayerOutputTruth = 'noPlayer' | 'playerPresentNotMirrored'` (`orchestratorPresentationModel.ts:10`) — correct for A, the extension point for B/C (design artifact only in this slice).
- **Key security finding for C:** the Player canvas can composite a guest-sourced camera feed (the camera relay binds remote camera into Hydra). Mirroring Player output back to operators can **re-broadcast that guest camera** — a real privacy/authz concern that makes C a Security-Sensitive runtime slice (full red-team + High-Risk protocol).

## Consequences

- Gate 3a (UX architecture pass) consumes the recorded decision. Only ~20% of the status vocabulary (the preview↔Player-output truth tier + Stage-strip layout) depends on it; the rest can be drafted in parallel.
- No runtime or truth-model change in this slice. The per-option `OrchestratorPlayerOutputTruth` extensions in the ADR are design artifacts only.
- Reconciled the canonical "Player Live" references (preview/output model, synthesis style guide, preset-operator UX) plus the architecture index to point at the neutral ADR, superseding the earlier unregistered "player-live-mirroring-architecture-spec" note that pre-assumed mirroring.

## Rollback

`git revert <merge-sha>` removes the ADR + reconciliation; docs-only, fully reversible.
