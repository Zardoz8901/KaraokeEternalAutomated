# Orchestrator Synthesis UI Style Guide

This guide governs Orchestrator-first UI work for Karaoke Hydra. It is a product and implementation guide for interfaces that drive synthesis engines: Hydra visual code, saved presets, camera sources, live preview, and future VST-like parameter surfaces.

The goal is not to make the Orchestrator look like a plugin rack. The goal is to make live visual control safe, legible, fast, and learnable while preserving expert depth.

## Source Principles

This guide adapts these references:

- Nielsen Norman Group, [10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/)
- Nielsen Norman Group, [Menu Design: Checklist of 15 UX Guidelines](https://www.nngroup.com/articles/menu-design/)
- Nielsen Norman Group, [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- Nielsen Norman Group, [Complex Application Design](https://www.nngroup.com/articles/complex-application-design/)
- W3C WAI-ARIA Authoring Practices, [Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/)
- Ethan Schoonover, [Solarized](https://ethanschoonover.com/solarized/)
- Figma Learn, [Overview of variables, collections, and modes](https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes)
- Figma Learn, [The difference between variables and styles](https://help.figma.com/hc/en-us/articles/15871097384471)
- Apple Human Interface Guidelines archival references: [1987 Open Library record](https://openlibrary.org/books/OL7406922M/Apple_Human_Interface_Guidelines?show_page_status=1), [1992 Macintosh Human Interface Guidelines PDF](https://vintageapple.org/inside_r/pdf/Human_Interface_Guidelines_1992.pdf), and [archived Apple controls guidance](https://leopard-adc.pepas.com/documentation/UserExperience/Conceptual/AppleHIGuidelines/XHIGControls/XHIGControls.html)

## Product Model

The Orchestrator has three user-facing workspace modes plus one Player runtime role:

1. **Host mode:** owner/admin users can live-code, save/manage presets, configure room visual policy, and broadcast arbitrary Hydra code.
2. **Party operator mode:** collaborators and guests can browse and send server-valid saved presets allowed by room policy.
3. **Browse-only mode:** collaborators and guests can inspect the Visuals workspace when Orchestrator access is allowed but room policy blocks visual sends.

**Player runtime role:** the display receives visualizer state, renders it, and should not require editing knowledge. It is not an Orchestrator workspace mode.

Design work must show the current mode clearly. Do not rely on server rejection as the main user experience. If a control is unavailable because of room policy or authority, hide it when the absence is obvious, or show it disabled with a short policy reason when discovery matters.

Preset operator and Browse-only runtime UI work must follow the [Orchestrator Preset Operator UX](orchestrator-preset-operator-ux.md) decision spec.

Preview, Player-applied state, and future Player Live work must follow the [Orchestrator Preview/Output Model](orchestrator-preview-output-model.md). That model is the durable source of truth for Local Preview, Preview using Player MP4, Applied on Player, Player Output, and Player Live labels.

## Preview/Output Mental Model

The Orchestrator preview is a fast local Hydra render. It can borrow the Player MP4 media source and clock, but it is still a local approximation. It is not the Player's rendered output and must not be labeled as Live, Player Output, Now Playing, or On Display.

Use this split:

- **Local Preview:** immediate edit and preset-audition feedback in this browser.
- **Applied on Player:** runtime confirmation that the Player evaluated and ticked the accepted visualizer run.
- **Player Output:** the actual audience display rendered by the Player.
- **Player Live:** future mirror, stream, or snapshot of Player Output. Do not use this label until that feature exists.

Source binding should be visible when it changes the user's expectation: Preview using Player MP4, Preview waiting for Player media, or Fallback external source. These labels should stay near the preview or the affected preset action, not in detached instructional text.

This follows the archival HIG principles that product state should be visible, modes should not be hidden, direct actions should produce immediate feedback, and labels should match the behavior users can observe.

## Product Layout Contract

Visuals is a first-class app area, not a hidden endpoint. The app-level bottom navigation uses visible icon-plus-label items in this order: **Library**, **Queue**, **Visuals**, **Account**. The Visuals item routes to `/orchestrator` only when the shared route-access helper allows the current user and room context. Labels are visible UI, not only `aria-label` or `title`.

The Orchestrator shell has two intentional workspace layouts:

- **Host workspace:** desktop uses Library escape plus Presets/API in the left rail, Stage in the top-right, and Code in the bottom-right. Mobile uses a Library escape plus Stage/Code/Presets tabs.
- **Operator and browse workspace:** desktop uses Library escape plus Presets in the left rail and an expanded Stage across the full right column. Code and API are not visible primary surfaces. Mobile uses a Library escape plus Stage/Presets tabs.

The Library escape is global navigation, not a workspace tab. Desktop places it at the start of the left rail, visually separated from Presets/API. Mobile places it in a fixed-width slot beside a separate tablist; the wrapper around the Library escape and tabs must not itself be `role="tablist"`.

Visual acceptance for this surface requires that a first-time collaborator can identify within five seconds: where the live Stage is, what presets they can browse, whether they can send visuals, and how to return to Library.

## Core UX Rules

- **Make state visible.** Distinguish local preview, unsent edits, sending, synced, rejected, remote update available, camera binding, and player-applied visual state.
- **Match synthesis language.** Use terms that map to the domain: preset, source, buffer, stage, preview, send, live, synced, camera, sensitivity, mode.
- **Keep user control explicit.** Randomize, format, load, save, send, and camera activation must be separate actions. Loading a preset into the editor must not silently broadcast it.
- **Prefer recognition over recall.** Show presets, snippets, parameter names, defaults, and valid ranges near the control. Do not require users to memorize Hydra syntax before they can operate visuals.
- **Prevent high-impact mistakes.** Destructive preset actions require confirmation. Broadcast actions must communicate audience and authority.
- **Support expert speed.** Keyboard shortcuts, search, command-like snippets, and dense lists are appropriate when visible controls still exist for discovery.
- **Reduce clutter by sequencing.** Use progressive disclosure for advanced APIs, generated code, automation, and low-frequency management actions.

## Color System

Pin Orchestrator color work to Solarized. Use Solarized Dark as the default synthesis workspace because the Orchestrator is a live visual, code, and stage-control surface. Use Solarized Light only for documentation, print-like views, or long-form text panels where light reading is intentional.

Canonical palette:

| Token | Hex | Use |
|-------|-----|-----|
| `base03` | `#002b36` | Primary dark app background |
| `base02` | `#073642` | Raised panels, editor gutters, selected dark surfaces |
| `base01` | `#586e75` | Muted text, disabled labels |
| `base00` | `#657b83` | Secondary text |
| `base0` | `#839496` | Primary text on dark surfaces |
| `base1` | `#93a1a1` | High-emphasis text on dark surfaces |
| `base2` | `#eee8d5` | Light panel background |
| `base3` | `#fdf6e3` | Primary light background |
| `yellow` | `#b58900` | Warning, pending, caution |
| `orange` | `#cb4b16` | Active edit, unsent, destructive-adjacent caution |
| `red` | `#dc322f` | Error, destructive confirmation |
| `magenta` | `#d33682` | Special state, rare accent |
| `violet` | `#6c71c4` | Reference/API accent |
| `blue` | `#268bd2` | Primary action, link, focus |
| `cyan` | `#2aa198` | Synced, camera/live signal |
| `green` | `#859900` | Success, valid, ready |

Color rules:

- Do not introduce new palette families for Orchestrator surfaces without updating this guide.
- Replace ad hoc aqua/glass/neon colors with Solarized tokens as UI work touches those components.
- Use blue for primary actions, cyan for live/synced signal, green for ready/success, yellow/orange for pending or caution, and red only for error or destructive action.
- Do not use color as the only status signal. Pair color with text, icon shape, placement, or control state.
- Keep live preview visuals visually separate from UI chrome. UI chrome should remain Solarized even when the Hydra output is bright or arbitrary.
- Preserve contrast. If Solarized token combinations are too low-contrast at a given size, adjust weight, surface, or label placement before adding a new color.

Implementation contract:

- The Orchestrator token source lives on `src/routes/Orchestrator/views/OrchestratorView.css` in the `ORCH_SOLARIZED_TOKENS_START` / `ORCH_SOLARIZED_TOKENS_END` block.
- Child Orchestrator components consume semantic `--orch-*` variables. Raw `#hex`, `rgb()`, `rgba()`, `hsl()`, and `hsla()` values are not allowed outside the token block for audited Orchestrator files.
- CodeMirror is not an exception. The editor chrome in `CodeEditor.tsx` and the Hydra syntax colors in `hydraHighlightStyle.ts` must use Solarized variables.
- Figma library work should mirror this structure: primitives map to Solarized, semantic variables map to Orchestrator usage, and mode-specific values stay behind variable aliases rather than being painted directly on components.
- The deterministic check is `src/routes/Orchestrator/components/orchestratorColorAudit.test.ts`. Update its audited file list deliberately when expanding the Orchestrator visual surface.

## Progressive Synth UI

The default Orchestrator surface should answer three questions without explanation:

1. What is on stage now?
2. What can I send next?
3. Am I allowed to edit live code or only send presets?

Use this hierarchy:

- **Stage first:** preview and live state stay prominent.
- **Preset second:** party-safe selection and send workflows stay one action away.
- **Code third:** live editing is available to host/admin users and advanced workflows, not required for basic operation.
- **API/reference last:** reference material appears in a stable panel or tab, not as blocking onboarding text.

Advanced controls should be disclosed when they are relevant: show camera binding controls when code uses a camera source, show room preset policy affordances to room managers, and show code diagnostics when sending or editing.

## Stage Header Contract

The Stage header owns immediate operational status. It is not a marketing banner, help strip, or alert drawer.

Desktop order:

1. Left group: Stage label and preset picker.
2. Center group: Orchestrator status strip.
3. Right group: camera pipeline and preview buffer controls.

The center status group must be width-limited and truncate labels before it crowds camera or buffer controls. The right group remains the home for camera/buffer controls; do not move those into the status strip.

Mobile order:

1. Stage label and preset picker wrap to the first row.
2. Status strip wraps to the second row.
3. Camera pipeline and buffer controls wrap to the third row, with touch-sized controls.

The remote-update banner remains a fixed high-priority room-state affordance above the shell. It may shift the Stage/Code docks down, but it should not consume the Stage header row or displace camera/buffer controls.

## Menuing And Navigation

Desktop Orchestrator should use visible navigation for primary work areas. Mobile may use stable tabs, but each tab must keep its purpose obvious:

- **Stage:** preview, camera state, buffer/source status, and current live/pending state.
- **Code:** editor, lint/send state, format/random/camera actions, and live-send controls for users with authority.
- **Presets:** search, folders, send/load actions, and management actions when permitted.

Menu guidance:

- App bottom navigation uses compact icon-over-label items with a minimum 44px touch target. Four items must fit without horizontal clipping.
- Put primary actions in visible controls, not overflow menus.
- Use tabs for switching major views, segmented controls for modes, menus for finite option sets, and disclosure for advanced or infrequent actions.
- Keep labels stable. Avoid renaming the same action across surfaces.
- Group actions by intent: audition, edit, send, manage, configure.
- Do not hide destructive or policy-changing actions beside casual playback controls.

## Synthesis Controls

Future synthesis-engine controls must be designed as parameter controls, not decorative knobs.

- Use **sliders** for continuous values such as sensitivity, mix, speed, gain, threshold, and crossfade. Include min/max semantics, current value, unit when meaningful, keyboard control, and accessible labels.
- Use **steppers or numeric inputs** when exact values matter.
- Use **toggles** for binary state such as camera allowed, visualizer enabled, auto-reactive on/off.
- Use **segmented controls** for mutually exclusive modes such as preview buffer or source mode.
- Use **menus/selects** for large finite sets such as source, preset folder, or device.
- Use **buttons** for commands with side effects such as Send, Save, Random, Format, Start Camera, Stop Camera.
- Avoid unlabeled knob banks. Dense controls are acceptable only when each parameter has a readable label, value, and reset/default behavior.

Parameter controls should preserve these VST-style expectations:

- show the active value while dragging;
- support reset to default where useful;
- avoid accidental large jumps on touch;
- keep related parameters spatially grouped;
- make automation or live-reactive behavior visible if present.

## Presets And Authority

The backend now enforces a clear authority boundary. The UI must mirror it:

- Owner/admin users may broadcast arbitrary live Hydra code.
- Collaborators and guests may send only saved DB presets that the server validates against room policy.
- Gallery presets are host/admin-only for broadcast until gallery entries become server-validatable.
- Collaborators should not see arbitrary-code send affordances as usable controls.
- A rejected send must produce visible feedback, not a silent timeout.

For detailed Preset operator and Browse-only behavior, including the action matrix, local Load definition, state-truth model, and copy matrix, use the [Orchestrator Preset Operator UX](orchestrator-preset-operator-ux.md) spec.

Preset rows should make source and capability legible:

- gallery vs saved folder;
- selected vs currently live when available;
- camera-using presets;
- starting preset;
- party/player preset folder eligibility;
- actions available to the current user.

Orchestrator modal rule: modal dialogs launched from `PresetBrowser` must receive the scoped Orchestrator modal class. Shared app-wide `Modal` defaults are not the source of truth for this surface.

## Feedback And Failure States

Every live-control surface must make the system status visible:

- **Preview state:** local-only, unsent edits, debounced preview.
- **Broadcast state:** sending, synced, failed, resend available.
- **Remote state:** update available, apply, dismiss, count of missed updates.
- **Camera state:** idle, connecting, active, error, missing source binding.
- **Policy state:** not allowed, restricted to party folder, preset unavailable.

Use color, text, and placement together. Color alone is not enough. Status text should be short and tied to the control that caused it.

## Accessibility And Input

- All interactive controls need visible focus states.
- Icon-only controls need accessible names and hover/focus titles when helpful.
- Tree, tab, menu, and slider controls must follow expected keyboard behavior.
- Touch targets should be at least 44px in mobile Orchestrator surfaces.
- Keep text readable over live visuals; do not depend on low-contrast overlays.
- Preserve keyboard access for expert workflows: send, search, navigate presets, undo/redo, format, and completion navigation.

## Implementation Checklist

Before merging Orchestrator UI work, verify:

- The screen answers stage/current state, next action, and authority mode.
- Primary actions are visible and grouped by intent.
- Advanced controls are progressively disclosed without blocking expert access.
- Preset send behavior matches server authority.
- Local preview and room broadcast state cannot be confused.
- Local preview, Applied on Player, Player Output, and future Player Live labels follow the Preview/Output Model.
- Failure states are visible and recoverable.
- Keyboard and touch interactions are covered.
- Labels, values, units, and defaults are visible for synthesis parameters.
- The change preserves mobile Stage/Code/Presets navigation.
- The deterministic Orchestrator color audit passes.
- Authenticated desktop and mobile screenshots are captured when a login harness is available; otherwise record manual visual QA with exact viewport sizes.
