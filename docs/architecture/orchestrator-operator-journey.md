# Orchestrator Operator & Host Journey + Status-Ownership Contract

> Gate 3a-i UX contract. Feeds the Gate 3b/3c implementation slices, which reconcile the
> runtime surfaces to the [status-ownership table](#cross-surface-status-ownership-table).
> Companion to the [Synthesis UI Style Guide](orchestrator-synthesis-ui-style-guide.md),
> [Preset Operator UX](orchestrator-preset-operator-ux.md), [Preview/Output Model](orchestrator-preview-output-model.md),
> and the [Player Live decision ADR](orchestrator-player-live-decision.md) (superseded 2026-06-04 by Owner Decision — Option A: Local Preview is the terminal Orchestrator surface; no Player-output copy is surfaced).
>
> This is a docs contract. It changes no runtime code.

## 1. Modes

| Mode | Who | Capability |
| --- | --- | --- |
| **Host** | room owner/admin | live-code authority: edit + send arbitrary Hydra code |
| **Operator** | collaborator (policy-permitting) | send saved DB presets only; no raw-code send |
| **Browse-only** | guest / restricted | audition (Load locally) only; no send |

## 2. Operator & Host journey map

Each leg lists what the user does, the runtime truth it produces, and which surface owns the feedback.

| Leg | Host | Operator | Browse-only |
| --- | --- | --- | --- |
| **Browse** | scan Presets/API + gallery | scan saved presets | scan saved presets |
| **Load** | open a preset into the editor / Stage preview | Load = local Stage preview + select only (no broadcast) | Load = local preview only |
| **Edit** | edit code; preview reflects edits; status → `Local edits` | n/a (no raw-code) | n/a |
| **Preview** | Local Preview (approximate); may borrow Player MP4 (waiting → using); audio simulated or Player-reactive | same | same |
| **Send** | broadcast code; status → `Sending` | broadcast allowed saved preset; `Sending` | disabled, with policy/party-folder reason |
| **Confirm** | `Synced` (echo) → `Applied on Player` (Phase 7A run-id proof) | same | n/a |
| **Recover** | send `Failed` → resend; `Remote update` from another host → review/apply/dismiss | `Failed` → resend; remote update → apply/dismiss | n/a |

**New legs this contract adds** (beyond preset-operator-ux, which covered browse/load/send/confirm):

- **Edit** (Host-only): live-code editing → `Local edits` broadcast state; preview is the truth surface, not the Player.
- **Recover**: the failure/conflict paths — `Failed` resend, and the `Remote update` conflict (another host broadcast newer code) with its review → apply/dismiss affordance.

## 3. Cross-surface status-ownership table

**Rule:** every label has exactly **one** owning surface. A concept must not be rendered as the same wording on two surfaces. Verified inventory (2026-05-30).

| Label / concept | Owning surface | Tone | Notes |
| --- | --- | --- | --- |
| `Host live coding` / `Preset operator` / `Browse only` / `Policy blocked` | **Stage strip — authority pill** | primary / neutral / neutral / danger | role truth; `live coding` is authority, not preview |
| `Sending` / `Synced` / `Failed` / `Local edits` / `Broadcast ready` | **Stage strip — broadcast pill** | warning / success / danger / warning / neutral | broadcast flow; never uses Preview/Live wording |
| `Remote update` (compact) | **Stage strip — broadcast pill** | warning | **status only** — "newer code exists" |
| `Remote update available (×N)` + Apply/Dismiss | **OrchestratorView — remote banner** | — | **actionable affordance** — owns the verb; the pill must NOT duplicate the action |
| `Camera connecting` / `Camera live` / `Camera error` / `Camera idle` | **Stage strip — camera pill** | warning / live / danger / neutral | connection truth; `Camera live` legitimately uses the `live` tone |
| `Local Preview` (primary) | **Preview overlay** | — | the only "what this surface is" label for the preview |
| `Visualizer off` / `Waiting for Player media` / `Preview using Player MP4` / `Preview uses preset video source` | **Preview overlay — secondary** | — | source truth; never claims Player Output |
| `Player audio reactive` / `Simulated audio` | **Preview overlay — secondary** | — | audio truth |
| `Selected` / `Loaded in preview` / `Start` / `Cam` / `Gallery` | **PresetTree — row badge** | — | per-row state; `Loaded in preview` is the row mirror of the preview's Load |
| `Applied on Player` | **PresetTree — row badge** | — | Phase 7A applied-truth, per exact preset/gallery match; the strongest current Player-truth claim |
| preset-policy / party-folder / empty-state copy | **PresetBrowser — panel notice** | — | one notice surface; rows show disabled Send, the panel explains why |

### Overlaps resolved

- **`Remote update` pill vs `Remote update available` banner:** the **pill** owns the compact *status* ("newer code exists"); the **banner** owns the *action* (Apply/Dismiss). They are intentionally different surfaces with different jobs — not duplication. Gate 3b should keep the pill action-free.
- **`live` wording:** `Host live coding` (authority) and `Camera live` (camera connection) legitimately contain "live"; the preview is forbidden from it. Already enforced by `FORBIDDEN_PREVIEW_TERMS`.
- **`Loaded in preview` (badge) vs `Local Preview` (overlay):** the badge marks *which row* is loaded; the overlay marks *the surface*. Distinct, kept.

## 4. Terminal preview surface — no Player-output copy

Per the Owner Decision (2026-06-04), a live image of what is playing is not required. The Orchestrator adopts **Option A: `Local Preview` is the terminal preview-overlay surface.** The preview overlay surfaces no copy of the Player's audience output.

- The real Player still renders audience output; the Orchestrator simply does not mirror or snapshot it. No `Player Output (snapshot)` slot is reserved in the preview overlay, and no second preview-overlay surface is held open for one.
- `Player Output` and `Player Live` remain forbidden as labels on `Local Preview`, enforced by `FORBIDDEN_PREVIEW_TERMS`. Under Option A this guard is permanent, not transitional.
- A continuous mirror or periodic snapshot (Option C) is no longer a roadmap item. It would require a fresh future ADR before any preview-overlay surface is reserved.

## 5. Downstream

- **Gate 3b** reconciles the Stage strip + preview overlay to this table (incl. the pill/banner split). `Local Preview` is terminal; no snapshot slot is reconciled.
- **Gate 3c** aligns PresetTree row badges + PresetBrowser notice to this table.
- **Gate 3a-ii** (separate slice) defines spacing/focus tokens + the density audit; this contract is layout-agnostic.
