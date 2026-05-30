# ADR: Orchestrator Player Live boundary — local preview vs snapshot vs mirror

- **Status:** Accepted (2026-05-30) — **Option B** (periodic Player-output snapshot) is the target; **A** remains the zero-cost fallback; **C** (live mirror) is deferred behind explicit triggers.
- **Date:** 2026-05-30
- **Supersedes:** the unregistered "player-live-mirroring-architecture-spec" follow-on note in the Phase 9/10 slice records, which pre-assumed mirroring. This ADR reframes that as a neutral decision.
- **Related:** [Orchestrator Preview/Output Model](orchestrator-preview-output-model.md)

## Context

Phases 8–10 made the Orchestrator's **Local Preview** honest: its labels now match reality and its own truth claims are tested. But the preview is still a *local approximation* — a second Hydra runtime rendering in the operator's browser, not the Player's actual output. Operators naturally compare the Orchestrator preview to the Player window and ask "is this what the audience sees?" The Preview/Output Model reserves **Player Output** for the real audience display and **Player Live** for a *future* mirror/stream/snapshot of it.

Before any Orchestrator UX polish (the Gate 3 architecture pass), we must decide whether Player Live will ever exist, because that decision determines whether the UX must reserve a status slot and screen real estate for a "Player Output / Player Live" surface, or finalize "Local Preview" as the terminal truth. This ADR frames that decision. **It implements nothing.**

### What exists today (verified against code)

- The Player renders Hydra to a real `<canvas>` (`HydraVisualizer.tsx:803`, `canvasRef`), so `canvas.captureStream()` is technically available for a mirror.
- There is a working **reverse-direction WebRTC relay** with subscriber pinning for camera (`server/Player/socket.ts`: `CAMERA_OFFER_REQ`/`CAMERA_ANSWER_REQ`, `roomCameraSubscribers` Map, KI-3) — a reusable transport/signaling pattern.
- There is a **pinned Player identity** `{socketId, playerInstanceId}` (`isPinnedPlayerIdentity`, `server/Player/socket.ts:305`) already used to gate `PLAYER_EMIT_VISUALIZER_APPLIED`. Any Player-output surface should bind to this same identity to resolve multi-Player ambiguity.
- The presentation model's player-output truth is `OrchestratorPlayerOutputTruth = 'noPlayer' | 'playerPresentNotMirrored'` (`orchestratorPresentationModel.ts:10`). This two-state union is exactly correct for Option A and is the extension point for B/C.

## Decision drivers

Engineering cost · security/authz surface · latency & bandwidth · failure/degraded states (and whether the degraded state is *honestly labelable*) · multi-Player ambiguity · browser constraints (autoplay, tainted canvas, mobile battery).

## Options

### Option A — Stay a local approximate preview (status quo, done)

- **Mechanism:** none. Keep labeling Local Preview honestly (Phases 8–10 already do this).
- **Cost:** zero — shippable today.
- **Security:** none added.
- **Failure modes:** none new; the preview can visually diverge from Player output, but it never *claims* to be the output.
- **Truth-model extension:** none. `'noPlayer' | 'playerPresentNotMirrored'` stays correct.
- **Cost of being wrong:** if operators genuinely need to see audience output, A doesn't deliver it — but nothing is built that must be torn down.

### Option B — Periodic snapshot / poster of Player output

- **Mechanism:** the Player periodically captures a low-frequency still (e.g. `canvas.toDataURL()`/`captureStream` single frame, every N seconds) and publishes it to authorized operators; the Orchestrator shows it as a clearly-timestamped "Player Output (snapshot, Xs ago)" poster distinct from Local Preview.
- **Cost:** moderate. New emit + authz check + a small Orchestrator surface; no continuous media pipe.
- **Security:** smaller surface than C — a still image, not a live stream. Still must be gated to authorized receivers (see open decision on who may receive Player output).
- **Latency/bandwidth:** low — one small image every few seconds; negligible Player battery cost.
- **Failure modes:** **honestly labelable** — a stale poster reads as "Xs ago"; a missing one reads as "no recent snapshot". This is B's key advantage: degradation degrades *honestly*.
- **Truth-model extension:** add e.g. `'playerOutputSnapshot'` (and a `staleness` field carried separately), distinct from any "live" claim.
- **Browser constraints:** if the Player Hydra canvas ever composites cross-origin `initVideo` media without CORS, `toDataURL`/`captureStream` can throw on a tainted canvas — must be handled as a degraded state, not a crash.

### Option C — Live stream / mirror of Player output

- **Mechanism:** Player `canvas.captureStream()` → reverse-WebRTC relay (reusing the camera-relay + pinned-subscriber pattern) → Orchestrator renders a live "Player Live" surface.
- **Cost:** heaviest — a full **Security-Sensitive** runtime slice (relay/transport) requiring TDD + High-Risk Change Protocol + full Red-Team Pass + the camera/player Validation Matrix.
- **Security:** largest surface. Critically, the Player canvas can composite a **guest-sourced camera feed** (the existing camera relay binds remote camera into Hydra) — mirroring Player output back to operators can **re-broadcast that guest camera**, a genuine privacy/authz concern beyond the existing one-way relay.
- **Latency/bandwidth:** continuous media pipe; real bandwidth and **mobile-Player battery** cost per subscribed operator.
- **Failure modes:** a dropped stream is **not** honestly labelable as "live" — it requires explicit connecting/stalled/failed states, exactly the failure-state design the Preview/Output Model warns must precede any "live" label.
- **Truth-model extension:** add e.g. `'playerOutputMirrorConnecting' | 'playerOutputMirrored' | 'playerOutputMirrorStalled'`, all bound to the pinned Player identity.

## Evaluation summary

| Criterion | A (local) | B (snapshot) | C (mirror) |
| --- | --- | --- | --- |
| Engineering cost | none | moderate | high (Security-Sensitive) |
| Security/authz surface | none | small (still image) | large (re-broadcasts guest camera) |
| Latency / bandwidth / battery | n/a | low | continuous / high |
| Degraded state honesty | n/a | honest ("Xs ago") | needs explicit failure states |
| Closes "is this the audience view?" gap | no | mostly | fully |
| Truth-union change | none | additive | additive (multi-state) |

## Recommendation (not a decision)

**Lean B as the pragmatic target, A as the zero-cost fallback, C deferred behind explicit triggers.** Rationale:

- A is already true and shippable; it costs nothing and remains the honest default.
- B closes the real product gap operators name — an actual, low-frequency "this is what the audience sees" — at far lower cost and risk than C, and it degrades *honestly*.
- C is architecturally feasible (the canvas, transport pattern, and pinned identity all exist) but carries the heaviest cost and a real guest-camera re-broadcast privacy concern. Defer it behind named triggers, e.g. *"operators report snapshots are insufficient for live VJ-style timing."*

## Decision

**Accepted 2026-05-30: Option B (periodic Player-output snapshot) is the target.** A remains the honest zero-cost fallback (and ships today); C (live mirror) is deferred behind explicit triggers (e.g. "operators report snapshots are insufficient for live VJ-style timing") and would require a Security-Sensitive runtime slice with a full red-team of the guest-camera re-broadcast surface.

This is a **target, not an implementation**. No runtime or truth-model change happens in this slice. A future B runtime slice will implement the snapshot publish/receive path (bound to the pinned Player identity) and extend `OrchestratorPlayerOutputTruth` with a snapshot state (e.g. `'playerOutputSnapshot'` plus a staleness field), distinct from any "live" claim.

**Deferred sub-decision (resolve when the B runtime slice is planned):** who may receive Player-output snapshots — recommended default is room owner/admin plus operators with Orchestrator access, gated server-side, consistent with the existing room-authority model.

## Consequences

- **Gate 3 (UX architecture pass) consumes this decision.** Only the preview↔Player-output truth tier and the Stage-strip layout depend on it (~20% of the status vocabulary); the rest of Gate 3a can be drafted in parallel. If A: finalize "Local Preview" as terminal and reserve no slot. If B/C: reserve a "Player Output" status slot and screen real estate adjacent to Local Preview, and pre-allocate ownership of "Player Output" vs "Local Preview" in the cross-surface status table.
- **No runtime/truth-model change in this slice.** Any `OrchestratorPlayerOutputTruth` extension above is a design artifact only.
- The reserved **Player Live** label remains forbidden on the local preview until the chosen feature actually exists.
