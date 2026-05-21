# Orchestrator Preset Operator UX

This spec defines the Preset operator and Browse-only experience for the Orchestrator. It is the implementation contract for the next runtime UI slice. It does not change backend authority, socket contracts, room policy, or player state.

The goal is to make preset control feel intentional for party operators and guests. A collaborator should understand what is on their local Stage, what they can send to the room, why a control is unavailable, and how to return to Library without knowing Hydra code or the `/orchestrator` URL.

## Modes

The Orchestrator has three user-facing workspace modes:

| Mode | User authority | Primary task | Workspace |
| --- | --- | --- | --- |
| Host | Room owner or admin | Live-code, manage presets, configure visual policy, and send arbitrary Hydra code. | Presets/API plus Stage plus Code. |
| Preset operator | Collaborator or guest with Orchestrator access and saved-preset send policy enabled. | Browse, locally audition, and send allowed saved DB presets. | Presets plus expanded Stage. No Code/API. |
| Browse-only | Collaborator or guest with Orchestrator access but saved-preset send policy disabled. | Browse and locally audition allowed presets without room broadcast. | Presets plus expanded Stage. No Code/API. |

The Player is not an Orchestrator user mode. It is a runtime display role that renders the room visualizer state.

Guest users inherit either Preset operator or Browse-only workspace mode from room policy, but they also have stricter management limits. Guests must not see preset creation, folder creation, rename, move, delete, starting preset, or player preset folder controls.

## Phase 6 Runtime Decision

Phase 6 intentionally narrows non-host runtime management: Preset operator and Browse-only workspaces hide `New Folder`, `Save Preset`, gallery `Save copy`, rename, move, delete, set start, and set player folder controls, even when a non-host user authored a preset. These workspaces are audition/send surfaces, not reduced host tools.

Party-folder restriction limits what non-host users can send, not what they can locally browse or audition. Rows outside the party folder remain visible for local preview and explain the blocked Send action with `Not in party folder`.

Author/admin preset management for non-host users remains technically possible but is deferred to a later Host/preset-management slice. Do not restore those controls in Operator or Browse-only runtime UI without a new design decision.

## Action Matrix

Definitions:

- **Show** means the control is visible and enabled.
- **Hide** means the control is not rendered.
- **Disabled** means visible but unavailable with a short reason near the action.
- **Protocol-dependent** means do not implement until player/socket state can prove the state.

### Toolbar Actions

| Toolbar action | Host | Preset operator | Browse-only | Guest constraint |
| --- | --- | --- | --- | --- |
| New Folder | Show | Hide unless the user is non-guest and has preset-management authority | Hide | Always hide |
| Save Preset | Show | Hide unless the user is non-guest and has preset-management authority | Hide | Always hide |
| Search presets | Show | Show | Show | Show |
| Clear search | Show when query exists | Show when query exists | Show when query exists | Show when query exists |
| Policy notice | Show only when policy affects available action | Show when send scope is restricted or unavailable | Show when sends are blocked | Show same policy wording as current mode |

### Gallery Preset Rows

| Gallery action | Host | Preset operator | Browse-only | Guest constraint |
| --- | --- | --- | --- | --- |
| Load | Show | Show | Show | Show |
| Send | Show | Hide | Hide | Hide |
| Save copy | Show | Hide unless the user is non-guest and has preset-management authority | Hide | Always hide |
| Set start | Hide | Hide | Hide | Hide |
| Move | Hide | Hide | Hide | Hide |
| Rename | Hide | Hide | Hide | Hide |
| Delete | Hide | Hide | Hide | Hide |

Gallery presets are bundled client assets. They are not valid collaborator broadcast payloads until a server-validatable gallery source exists. For non-host users, gallery presets are local audition material only.

### Saved DB Preset Rows

| Saved preset action | Host | Preset operator | Browse-only | Guest constraint |
| --- | --- | --- | --- | --- |
| Load | Show | Show | Show | Show |
| Send | Show when preset id is valid | Show only when room policy allows saved-preset sends and folder restrictions allow this preset | Disabled or hidden with policy reason | Show only under Preset operator policy and only for allowed saved DB presets |
| Set start | Show for room owner; admin only if backend API supports it | Hide | Hide | Hide |
| Move | Show for admin or author | Hide unless non-guest author/admin behavior is explicitly preserved in runtime slice | Hide | Hide |
| Rename | Show for admin or author | Hide unless non-guest author/admin behavior is explicitly preserved in runtime slice | Hide | Hide |
| Delete | Show for admin or author | Hide unless non-guest author/admin behavior is explicitly preserved in runtime slice | Hide | Hide |

Saved preset sends must require a real DB `presetId`. A raw code string is not a valid Preset operator send.

### Folder Rows

| Folder action | Host | Preset operator | Browse-only | Guest constraint |
| --- | --- | --- | --- | --- |
| Expand/collapse | Show | Show | Show | Show |
| Set player folder | Show for room owner; admin only if backend API supports it | Hide | Hide | Hide |
| Rename folder | Show for admin or author | Hide unless non-guest author/admin behavior is explicitly preserved in runtime slice | Hide | Hide |
| Delete folder | Show for admin or author | Hide unless non-guest author/admin behavior is explicitly preserved in runtime slice | Hide | Hide |
| Drag reorder | Show only where rename/move management is allowed | Hide | Hide | Hide |

## State Truth Model

The UI must not collapse these states into one label:

| State | Truth source | Meaning | Allowed claim |
| --- | --- | --- | --- |
| Selected | Local `PresetBrowser` state | The row currently highlighted in this client. | "Selected" |
| Loaded locally | Local Orchestrator workspace state after Load | This client's Stage preview uses the preset code. | "Loaded in preview" |
| Sent | Client dispatch of an allowed visualizer payload | A room broadcast request was made. | "Sending" |
| Synced | Current client observed remote Hydra code matching the last sent code | The broadcast echoed back to this client. | "Synced" |
| Applied on Player | Phase 7A Player-applied runtime ack with matching run/preset/gallery metadata | The Player evaluated and ticked the accepted run. This is not pixel-perfect Player Output proof. | "Applied on Player" |

`Load` is locked to this exact behavior: **set this client's local Stage preview and selected preset only; do not broadcast to the room; do not claim player-applied state.**

The current implementation can safely show Selected, Loaded locally, Sent, Synced, failed send, remote update available, and Applied on Player when the Player-applied metadata matches the preset or gallery key. It must not show "Live", "Now playing", "On Display", or "Player Output" for a preset unless a future Player-output mirror provides proof.

## State Copy Matrix

Use these short labels in the runtime slice:

| Situation | Primary copy | Secondary copy or placement |
| --- | --- | --- |
| Host authority | Host live coding | Stage status strip |
| Preset operator authority | Preset operator | Stage status strip |
| Browse-only authority | Browse only | Stage status strip |
| Policy blocked | Policy blocked | Stage status strip only when route/render defensively reaches blocked state |
| Local preset audition | Loaded in preview | Preset row or Presets panel, not Stage authority |
| Player applied ack | Applied on Player | Preset row only when applied metadata matches the preset/gallery key |
| Saved preset can send | Send | Primary row action |
| Saved preset blocked by room policy | Send disabled by room policy | Near disabled Send or Presets panel policy notice |
| Saved preset outside party folder | Not in party folder | Near disabled Send or row detail |
| Gallery cannot be sent by collaborator | Gallery presets are preview-only | Presets panel or row detail |
| No saved visuals | No saved visuals available for this room. | Empty Presets panel |
| Restricted folder empty | Party preset folder has no saved visuals. | Empty Presets panel |
| Search empty | No visuals match your search. | Empty Presets panel |
| Remote update | Remote update available | Fixed remote banner |
| Sent and awaiting echo | Sending | Stage status strip |
| Echo matched | Synced | Stage status strip |
| Send failed or rejected | Failed | Stage status strip plus resend when available |

Avoid all-uppercase copy except tiny metadata labels. Button labels use title case or sentence case consistently with existing Orchestrator controls.

## Placement Rules

- Presets panel owns preset availability, folder restrictions, search-empty states, and send policy explanations.
- Stage header owns authority mode, broadcast state, camera state, and buffer controls.
- The remote-update banner stays fixed above the shell and must not replace Presets panel policy text.
- Operator and Browse-only desktop layouts keep Presets left and expanded Stage right. Do not leave a dead Code area.
- Operator and Browse-only mobile layouts keep Library as an escape slot and Stage/Presets as the only tabs.
- Disabled Send may remain visible when it teaches why a saved preset cannot be sent. Hide actions that are irrelevant to the user's role, such as guest management actions.
- Icons may accompany actions, but action names must be discoverable through visible text, stable tooltip/title, or an adjacent label. Do not rely on arrow/star symbols alone for the next implementation.

## Capability Classification

The next runtime slice should classify work this way:

| Requirement | Classification |
| --- | --- |
| Hide guest `New Folder` and `Save Preset` toolbar actions | client-only |
| Hide Code/API in Operator and Browse-only mode | already implemented; preserve |
| Define Load as local Stage preview only | client-only |
| Show gallery as preview-only for non-host users | client-only |
| Disable or hide saved preset Send based on existing `canSendPreset` | client-only |
| Explain party-folder restriction in Presets panel or row detail | client-only |
| Separate Selected from Loaded locally in labels | client-only |
| Show exact player-applied preset | runtime-supported when Phase 7A applied metadata exactly matches the saved preset or gallery key |
| Show "currently live preset" for arbitrary code broadcasts | protocol-dependent |
| Let collaborators send bundled gallery presets | protocol-dependent |
| Let admins manage another room's visual policy through current own-room API | out-of-scope |

## Protocol Gaps

The current client receives enough state to mirror local send echo, remote code updates, and Phase 7A Player-applied runtime acknowledgements for exact preset/gallery matches. The older docs-first analysis treated "Applied on Player" as future-only; that point is superseded by Phase 7A. The historical analysis remains valid for the rest of its Preset operator decisions.

Applied on Player means the Player evaluated and ticked the accepted visualizer run. It does not prove that the local preview pixels match the Player, and it does not provide a live mirror of the audience display.

Do not implement these labels without a future Player-output mirror or equivalent protocol:

- "Live preset"
- "Now on display"
- "Currently playing visual"
- "Player Live"
- "Player Output" as a preview-panel label

A future Player Live slice may add a mirror, stream, snapshot, or equivalent Player-output proof. That is outside this spec unless explicitly planned.

## Acceptance Criteria

The next runtime implementation consuming this spec is acceptable when:

- A first-time Preset operator can identify within five seconds where Stage is, which saved presets are available, whether they can send, and how to return to Library.
- A Browse-only user can tell they are previewing locally and cannot broadcast.
- Guest users do not see preset/folder management controls that backend policy rejects.
- Load never broadcasts and never claims player-applied state.
- Send is available only for server-valid saved DB presets allowed by current capability and room policy.
- Gallery presets are clearly preview-only for non-host users.
- Selected, Loaded locally, Sent, Synced, and Applied on Player remain distinct in copy and tests.
- Mobile keeps Stage/Presets navigation clear without Code/API tabs for Operator and Browse-only modes.

## Out Of Scope

- Backend, socket, room policy, route guard, database, and player-applied ack changes.
- Runtime UI implementation in this docs-first slice.
- Redesigning the Host live-code workspace.
- Changing queue, library, account, player, camera relay, or shared modal defaults.
- Adding runtime dependencies, package scripts, Nix changes, or workflow changes.
