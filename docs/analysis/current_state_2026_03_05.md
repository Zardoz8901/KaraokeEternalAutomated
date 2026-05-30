# Current State - Karaoke Hydra

> Canonical state tracker. Referenced from AGENTS.md.
> Update this file when completing work. Create a new dated copy when the file grows stale.

---

## Completed (reverse chronological)

| Date | Change | Scope | Key Files | Ref |
|------|--------|-------|-----------|-----|
| 2026-05-30 | Gate 3 a11y state exposure: existing Orchestrator status labels now reach assistive tech via polite live regions, status-pill accessible names, buffer selector state, and PresetTree row badge state in row names without relabeling or behavior changes | Standard | `OrchestratorView.tsx`, `OrchestratorStatusStrip.tsx`, `CodeEditor.tsx`, `HydraPreview.tsx`, `StagePanel.tsx`, `PresetTree.tsx`, tests | `docs/analysis/orchestrator_a11y_state_exposure_2026_05_30.md` |
| 2026-05-30 | Orchestrator HiG Product Interpretation & Visual System (style direction): 9 product-interpretation principles (workstation-not-dashboard, Preview vs Player Output as distinct objects, presets as stateful objects, code as a role-weighted instrument, visible/immediate/modeless controls, status near subject, dense/calm/legible/low-ornament, Solarized as semantic system, HiG→testable rules) each with exploratory criteria, plus lower-level system specs to define | Docs | `docs/architecture/orchestrator-visual-system.md`, `ARCHITECTURE.md`, style-guide | (commit 019091b7) |
| 2026-05-30 | Gate 3d Orchestrator token application: spacing/focus tokens applied across Orchestrator CSS, PresetTree focus rings restored, ApiReference undefined tokens fixed, reduced-motion and compact hit-slop fixes added, and color audit now catches unresolved `--orch-*` refs | Standard | `OrchestratorView.css`, Orchestrator component CSS, `orchestratorColorAudit.test.ts` | `docs/analysis/orchestrator_token_application_2026_05_30.md` |
| 2026-05-30 | HiG-grounded UI/UX backlog (investigation): 17 opportunities, 0 locked-decision conflicts — 3 correctness bugs (ApiReference undefined tokens; PresetTree focus-ring suppression; reduce-motion shimmer loop), a11y state-exposure items mapped to Gate 3b/3c, system items to 3a-ii/3d; meta-finding that orchestratorColorAudit does not resolve var()/measure contrast | Docs | (investigation; no runtime change) | `docs/analysis/orchestrator_hig_ux_backlog_2026_05_30.md` |
| 2026-05-30 | Gate 3a-ii Orchestrator spacing/focus contract: durable spacing scale, focus-ring token contract, raw-value migration mapping, and CSS-source density/hierarchy audit for Stage header, PresetTree rows, status pills, and controls | Docs | `orchestrator-synthesis-ui-style-guide.md` | `docs/analysis/orchestrator_ux_spacing_focus_tokens_2026_05_30.md` |
| 2026-05-30 | Gate 3c Preset row + notice alignment: PresetTree badge and remote-banner labels promoted to shared constants, PresetBrowser notice copy single-sourced, and the ownership test now derives PresetTree/PresetBrowser/banner labels from real producers | Standard | `orchestratorPresentationModel.ts`, `PresetTree.tsx`, `PresetBrowser.tsx`, `OrchestratorView.tsx`, ownership tests | `docs/analysis/orchestrator_preset_row_notice_alignment_2026_05_30.md` |
| 2026-05-30 | Gate 3b Stage-strip + preview reconciliation: executable cross-surface status-ownership test added; Remote-update pill remains status-only, banner owns Apply/Dismiss; preview reserves the future Player Output snapshot slot without adding runtime state | Standard | `orchestratorStatusOwnership.test.ts`, `OrchestratorStatusStrip.test.tsx`, `HydraPreview.test.tsx`, `OrchestratorView.test.tsx` | `docs/analysis/orchestrator_stage_strip_reconciliation_2026_05_30.md` |
| 2026-05-30 | Gate 3a-i UX contract: operator/host journey map (adds the edit + recover legs) and a cross-surface status-ownership table (one owner per label; resolves the Remote-update pill-vs-banner overlap) with a reserved Player Output (snapshot) slot per Option B | Docs | `docs/architecture/orchestrator-operator-journey.md`, `ARCHITECTURE.md`, style-guide | `docs/analysis/orchestrator_ux_journey_status_ownership_2026_05_30.md` |
| 2026-05-30 | Decommissioned `refactor/redux-modernization` (Gate 3 prerequisite): 187 behind / 2 ahead, not an ancestor; both unique commits already on main (API-lab `0478af47`≈`087e3e83`; send-ack `f0614609` superseded by `orchestratorSendState.ts`). Removed record + deleted local/origin branch; serialize-ahead constraint retired | Chore | `docs/plans/active-slices.yaml` | `docs/analysis/redux_modernization_decommission_2026_05_30.md` |
| 2026-05-30 | Gate 2 (Player Live decision): docs-first ADR decides the Orchestrator Player Live boundary — Option B (periodic Player-output snapshot) is the target; A (local-only) is the zero-cost fallback; C (live mirror) deferred behind triggers. No runtime change | Docs | `docs/architecture/orchestrator-player-live-decision.md`; preview/output, style-guide, operator-ux refs reconciled | `docs/analysis/orchestrator_player_live_decision_2026_05_30.md` |
| 2026-05-30 | Gate 1 (control-plane cleanup): removed 11 stale worktrees + 18 merged local branches, pruned merged slice records; `slices:check` now 0 WARN. redux-modernization untouched | Chore | `docs/plans/active-slices.yaml` | `docs/analysis/control_plane_cleanup_2026_05_30.md` |
| 2026-05-30 | Orchestrator presentation truth hardening: Local Preview now has an explicit neutral status class, and Player MP4 preview copy waits for decoded shadow video frames before Hydra mounts | Standard | `HydraPreview.tsx`, `HydraPreview.css`, `orchestratorPresentationModel.ts`, tests | `docs/analysis/orchestrator_presentation_truth_hardening_2026_05_30.md` |
| 2026-05-29 | Orchestrator status truth vocabulary: shared Local Preview, Broadcast ready, and Applied on Player label constants; idle broadcast copy/tone now avoids Preview/live wording | Standard | `orchestratorPresentationModel.ts`, `orchestratorStatus.ts`, `PresetTree.tsx`, tests | `docs/analysis/orchestrator_status_truth_vocabulary_2026_05_29.md` |
| 2026-05-28 | Orchestrator Presentation Truth Model + Stage Preview UI: Local Preview labels now reflect source/audio truth, shadow MP4 creation is limited to initVideo patches, and HydraPreview CSS is Solarized-audited | Standard | `HydraPreview.tsx`, `orchestratorPresentationModel.ts`, tests | `docs/analysis/orchestrator_presentation_truth_model_2026_05_28.md` |
| 2026-05-21 | Orchestrator preview/output mental model documented: Local Preview stays approximate, Applied on Player is runtime confirmation, Player Output is audience truth, and Player Live is reserved for future mirroring | Docs | `docs/architecture/orchestrator-preview-output-model.md`, Orchestrator UX docs | `docs/analysis/orchestrator_preview_output_model_2026_05_21.md` |
| 2026-05-19 | Work-control slice plane: added active slice/worktree YAML, validator command, tests, CI enforcement, and branch cleanup tracking | Standard | `docs/plans/active-slices.yaml`, `scripts/check-active-slices.mjs`, `package.json`, CI | - |
| 2026-05-03 | Queue rotation sphere UX experiment proposal documented as an alternate, flagged queue view rather than a replacement for the existing list | Docs | `docs/analysis/queue_rotation_sphere_experiment_2026_05_03.md` | - |
| 2026-04-30 | VideoProxy M-1 closure: proxy fetches now validate DNS answers and pin outbound HTTPS connections to the validated public IP while preserving original host/SNI; cache prewarm uses the same resolved fetch path | Security | `server/VideoProxy/resolvedFetch.ts`, `server/VideoProxy/router.ts`, `server/VideoProxy/cache.ts`, tests | - |
| 2026-04-29 | Auth crypto dependency portability: replaced native `bcrypt` package with pure JS `bcryptjs` wrapper while preserving bcrypt hash compatibility; added `isLegacy` helper for a later argon2 migration pass | Security | `server/lib/bcrypt.ts`, `server/lib/bcrypt.test.ts`, `package.json`, `package-lock.json` | - |
| 2026-04-29 | Backend DB portability: replaced native `sqlite`/`sqlite3` runtime wrapper with `node:sqlite` compatibility layer while preserving migrations, WAL/foreign_keys/busy_timeout, legacy double-quoted string behavior, and sqlite3 constraint error codes | Standard | `server/lib/Database.ts`, `server/lib/Database.test.ts` | - |
| 2026-04-29 | VideoProxy SSRF reassessment and M-2 status/FFT authorization: scheduled Firefox nightly disabled; DNS-resolution guard added for proxy fetches/cache prewarm; player status and FFT emits restricted to room owner/admin | Security | `.github/workflows/e2e-nightly.yml`, `server/VideoProxy/router.ts`, `server/VideoProxy/cache.ts`, `server/Player/socket.ts`, tests | - |
| 2026-04-25 | Quality gate consolidation: lint cleanup, CI lint job, app-managed OIDC docs refresh | Standard | `.github/workflows/ci.yml`, docs, lint-touched source/tests | - |
| 2026-03-05 | M-3: Media path traversal guard (`isWithinBasePath`) | Security | `server/Media/router.ts`, `server/Media/router.test.ts` | - |
| 2026-03-05 | Remove `VISUALIZER_STATE_SYNC_REQ` dead code | Standard | `server/Player/socket.ts`, `shared/actionTypes.ts`, `playerVisualizer.ts`, `socketRateLimit.ts`, tests | - |
| 2026-03-05 | Remove stale `@todo` emit comments | Trivial | `server/Player/socket.ts` | - |
| 2026-02-20 | Fix duplicate ephemeral rooms via UNIQUE constraint | Standard | - | `ea40e5b0` |
| 2026-02-20 | Fix account creation room password typo | Standard | - | `80b2e748` |
| 2026-02-20 | Fix star count badges in Queue view | Standard | - | `6bceb700` |
| 2026-02-20 | Fix startingPresetId idle room cleanup race | Standard | - | `5d5a648a` |
| 2026-02-19 | Fix starting preset auto-init race + Firefox initVideo | Standard | - | `e4347556` |
| 2026-02-19 | Phase 2 readiness: telemetry sink, SLO pipeline, runbook | Standard | - | `e2ae9a78` |
| 2026-02-18 | Close KI-1, KI-2, M-1: admin demotion, SSRF denylist, bootstrap retry | Security | - | `a863baa2` |
| 2026-02-18 | KI-3: Camera subscriber pinning | High-Risk | `server/Player/socket.ts`, tests | `64febcf8` |
| 2026-02-18 | KI-4, H-1, H-2, H-4: Payload guards + socket rate limiter | Security | `server/lib/payloadGuards.ts`, `server/lib/socketRateLimit.ts`, `server/Player/socket.ts` | `ffe355dc` |
| 2026-02-17 | Telemetry PII hardening + session correlation | Security | `shared/telemetry.ts`, `server/lib/Telemetry.ts`, `src/lib/telemetry.ts` | `814f1325` |
| 2026-02-17 | Reliability infrastructure: telemetry, CI, E2E | Standard | - | `9e2f50dc` |
| 2026-02-16 | Firefox player reliability (mouse shims, timer recovery, proxy) | Standard | - | `d3224d22` |
| 2026-02-15 | Firefox video proxy fixes (CORS, idle timeout, two-phase bind) | Standard | `server/VideoProxy/router.ts` | multiple |

---

## Security Audit Remediation (source: `security_audit_full_2026_02_12.md`)

| ID | Severity | Finding | Status | Resolution |
|----|----------|---------|--------|------------|
| RT-2 | ~~CRITICAL~~ | SQL injection in HydraPresets.update | **Resolved** (pre-audit) | All queries use sqlate tagged templates |
| RT-3 | ~~CRITICAL~~ | Guest bypass on HydraPresets routes | **Resolved** (pre-audit) | `nonGuest: true` on all mutating routes |
| H-1 | HIGH | WebRTC relay payloads unvalidated | **Closed** | Type guards + 64KB size cap (`payloadGuards.ts`) |
| H-2 | HIGH | Hydra code broadcast no size limit | **Closed** | `isValidHydraCode` + `isValidPayloadSize` guards |
| H-3 | HIGH | Camera subscriber pinning missing | **Closed** | `roomCameraSubscribers` Map, directed relay, disconnect cleanup |
| H-4 | HIGH | No socket rate limiting | **Closed** | Token bucket rate limiter (`socketRateLimit.ts`) with per-action thresholds |
| M-1 | MEDIUM | Video proxy DNS rebinding / IP denylist gaps | **Closed** | Hostname/IP denylist plus DNS-resolution validation before proxy fetches and background cache prewarm; outbound HTTPS requests now pin connection lookup to the validated public IP while preserving original host/SNI. |
| M-2 | MEDIUM | FFT/status lack auth checks | **Mitigated** | `PLAYER_EMIT_STATUS` and `PLAYER_EMIT_FFT` now require room owner/admin authority via `canManageRoom`; collaborator sockets can no longer poison `_lastPlayerStatus` replay or broadcast FFT. |
| M-3 | MEDIUM | Media path traversal (DB-sourced paths) | **Closed** | `isWithinBasePath()` guard + 6 regression tests |
| M-4 | MEDIUM | Admin prefs broadcast leaks raw prefs | **Accepted** | Admins are trusted; no secrets in room prefs |
| L-1 | LOW | Guest join rate limiter in-memory | **Accepted** | Fine for single-instance deployment |
| L-2 | LOW | No explicit CORS config | **Accepted** | Reverse proxy handles CORS |

---

## Open Items

### Remaining audit findings
- None open from the tracked security audit. M-4, L-1, and L-2 remain accepted risks.

### Manual actions required
- **Authentik policy** `set-guest-expiry-and-room` is only required if the deprecated Authentik-managed guest enrollment path is re-enabled. Current app-managed guest join uses `/api/guest/join`.

### Deferred telemetry items (from `redteam_remediation_2026_02_17.md`)
- RT-7: Client telemetry kill-switch not wired (low urgency, local-only telemetry).
- N-4: Client session ID not transmitted to server (operational improvement, no security impact).

### Architecture follow-ups
- Native `sqlite`/`sqlite3` packages are removed from runtime dependencies; keep an eye on CI install output for any remaining native build pressure.
- Native `bcrypt` is removed from runtime dependencies; existing bcrypt hashes remain valid through `bcryptjs`.
- VideoProxy now owns a custom HTTPS fetch path for IP-pinned proxying; monitor proxy playback after deploy for redirect, range request, and host/SNI compatibility with real upstream media hosts.
- Upstream's Node `crypto.argon2` direction remains worth evaluating, but local Node 22 lacks `crypto.argon2` and this repo has no `shell.nix` / `default.nix`; verify under a real Node 24 toolchain before changing password hash format.

---

## Conventions

- Update this file when completing work.
- Each entry should reference a commit hash or analysis doc.
- When this file grows stale, create a new `current_state_{YYYY_MM_DD}.md` and update the pointer in AGENTS.md.
