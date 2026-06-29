# Handoff: jambonz Call Monitor (Room Supervision)

## Overview
A desktop web application for an operations supervisor to monitor live **rooms** on a
jambonz system. A room is a conference that may contain one or more participants. The
supervisor sees every live room, selects one to view its participants, and can **listen**
in silently, **coach** the agents privately, or **enter the room** as a full participant.
A live, speaker-labelled **transcript** can be toggled on per room, independently of
listening.

This is a single-account tool: after connecting, the supervisor sees the rooms scoped to
one jambonz account.

## About the Design Files
The files in `prototype/` are a **design reference built in HTML** — a working prototype
that demonstrates the intended look, layout, copy, and interaction model. They are **not
production code to copy directly**, and the audio, transcripts, room data, and
authentication in them are all **simulated** (random mock data on a timer).

The task is to **recreate this design in the target codebase's environment** — a real
front end (React, Vue, etc.) talking to a real jambonz back end — using that project's
established patterns and the jambonz UI Kit. If no front-end environment exists yet,
choose the most appropriate framework and implement there.

> The prototype is the specification for *appearance and behavior*. The real data,
> media, and auth must be implemented against jambonz.

## Fidelity
**High-fidelity.** Colors, typography, spacing, component styling, and interaction states
are final and come from the **jambonz UI Kit** design system (bundled under
`prototype/_ds/`). Recreate the UI faithfully using that design system's tokens and
components. Exact token values are listed under **Design Tokens** below.

---

## Screens / Views

### 1. Login / Connect  (`screenshots/login.png`)
**Purpose:** The supervisor connects the app to a jambonz system before anything else.

**Layout:** Full-screen dark (`--dark`) backdrop, a single centered white card
(max-width 440px, radius 16px, padding ~34px). Logged-out state only; on success the
card is replaced by the console.

**Fields** (all required; Connect is blocked until every field is non-empty, showing an
inline error otherwise):
- **Connection** section:
  - **Base URL** — the jambonz system to connect to (e.g. `https://api.jambonz.cloud`).
  - **Account SID** — scopes which rooms/calls are shown.
  - **API key** (masked) — used to authenticate REST API calls that query live calls.
- **Credentials** section:
  - **Username** (plain).
  - **Password** (masked).
- Primary **Connect** button (filled magenta, full width) with a wifi/connect icon.
- Footnote: secrets are used only to authenticate with the jambonz system.

**Behavior / persistence:** In the prototype, the non-secret fields (Base URL, Account
SID, Username) and an "authenticated" flag persist in `localStorage`; the **API key and
password are never stored**. In production, follow the target app's auth/session
conventions — do not persist secrets in `localStorage`.

### 2. Console — Room list + Detail  (`screenshots/01-room-with-agents-idle.png`)
The authenticated app. A fixed top bar over a two-pane body.

**Top bar** (height 64px, `--dark` background, white text):
- jambonz wordmark ("jam" in magenta) + a divider + "Call Monitor".
- Live room count: `<N> live calls`.
- Right side: **Sign out** (text button), divider, the signed-in **username** and
  **Account SID** (SID truncated), and a circular magenta avatar with initials.

**Left rail — "Rooms"** (width 380px, white, right border):
- Header "Rooms" + a pill badge with the room count.
- Scrollable list. Each **room row** (≈68px tall, bottom divider):
  - 40px rounded-square **purple** icon (a "people/group" glyph) — all rooms use this.
  - **Room name** (medium weight) on the left; **duration** (tabular, right-aligned).
  - Second line: **"<x> agents · <y> others"** — the agent count is colored teal
    (`--teal`) when ≥1, grey when 0.
  - When this room is the selected one **and** the supervisor is connected to it
    (listening/coaching/in room), a small animated 3-bar **equalizer** shows at the right.
  - Selected row: pale-magenta background (`--pink`) + a 3px magenta left border.

**Right pane — Detail** (fills remaining width): see next section.

### 3. Detail pane (per selected room)
**Header:**
- 48px rounded-square purple room icon.
- **Room name** (bold, ~1.4rem).
- Count summary line: **"<x> agents · <y> others"** (agents teal when present).
- Right: large **duration**, and an "Active" status dot (green).
- **Participant chips** row: one chip per participant showing a colored dot + the
  participant's label. The label is the **caller ID when we have one, otherwise the bare
  phone number** (both are valid and expected). Agent participants additionally show a
  small uppercase **"AGENT"** tag and a teal-tinted chip. A final **"You · <role>"** chip
  shows the supervisor's own current state (not listening / listening / coaching / in room).

**Control bar** — the three monitoring actions plus status:
- **Listen** — connect and listen silently; neither party hears the supervisor. (Internally
  this mode is `monitor`.)
- **Coach** — speak privately to the **agents only**; other participants do not hear it.
  **This button is only shown when the room has at least one agent.** In a room with zero
  agents, only **Listen** and **Enter Room** appear (`screenshots/05-room-no-agents.png`).
- **Enter Room** — join as a full participant; **everyone in the room hears the supervisor.**
  (Internally `enter`.)
- The active mode's button is filled with its color (Listen = blue, Coach = purple,
  Enter Room = magenta); inactive buttons are hollow/grey.
- While connected: an animated equalizer + a status line (e.g. "Monitoring silently — the
  participants cannot hear you" / "Coaching — only the agents hear you" / "In the room —
  everyone can hear you"), and a **Stop** button (reads **"Leave room"** when in Enter
  Room mode) to disconnect back to idle.

**Speak input** (appears only in Coach or Enter Room mode):
- **Coach** (`screenshots/03-coaching.png`): purple-tinted bar, lock icon, hint
  "Coaching the agents privately — other participants will not hear this", text field +
  Send. Sent lines appear in the transcript labelled "You · Supervisor · 🔒 private to agents".
- **Enter Room** (`screenshots/04-enter-room.png`): magenta-tinted bar, hint "You are in
  the room — everyone can hear you", text field + Send. Sent lines appear labelled
  "You · Supervisor · live to all".
- *(In the prototype this is a text box standing in for the supervisor's microphone /
  spoken audio. In production, Coach/Enter Room are audio operations — the text input is
  a prototype affordance, not a required UI element.)*

**Transcript** (`screenshots/06-transcript-on.png`):
- A header row "LIVE TRANSCRIPT" with an **On/Off toggle** (magenta when on) on the right.
- **Transcription is per-room and on-demand** — it is NOT generated for all rooms in the
  background. It runs only for the selected room while the toggle is On, and it is
  **independent of listening** (you can transcribe without listening and vice versa).
- **Off state:** a centered empty state with a document icon, "Transcript is off", an
  explanatory line, and a "Turn on transcript" button.
- **On state:** a red live dot next to the header; a scrolling list of speaker lines, each
  with a circular avatar (initials, or **"#"** for phone-number participants), the speaker
  label colored to match their participant dot, a timestamp (`m:ss`), and the text.
  Supervisor coach/enter messages appear inline with their private/all-hear note. The list
  auto-scrolls to the newest line.

### 4. Empty state (no rooms)
When there are no live rooms, the rail shows a centered "No active calls" empty state with
a pulsing headphones badge and "Watching for new calls". (Toggle in the prototype via the
`emptyFloor` prop / Tweaks panel.)

---

## Interactions & Behavior
- **Selecting a room** populates the detail pane only. It does **not** auto-connect and
  does **not** auto-transcribe — both Listen/Coach/Enter and the transcript are explicit,
  opt-in actions. Switching to a different room resets the supervisor to idle and the
  transcript to off, so each room is engaged intentionally.
- **One active engagement at a time:** the supervisor is in exactly one of {idle, listen,
  coach, enter} for the selected room. Switching modes is immediate.
- **Coach is gated on agent presence.** If a room has no agents, Coach is unavailable; if
  the supervisor were somehow in coach mode and the agents leave, fall back to listen.
- **Stop / Leave room** returns to idle (disconnects the supervisor's media).
- **Durations** display as seconds under one minute (`0:57`) and **whole minutes above**
  (`3m`, `9m`). Transcript line timestamps use precise `m:ss`.
- **Auto-scroll:** the transcript pins to the latest line as new lines arrive.

## State Management
Per the prototype, the meaningful client state is:
- **Session/auth:** `authed`, `baseUrl`, `accountSid`, `apiKey` (in-memory only),
  `username`, `password` (in-memory only), `loginError`.
- **Rooms:** the list of live rooms, each with `id`, `title` (room name), `participants[]`
  (`{ label, tag }` where `tag === "agent"` marks an agent), and `duration`.
- **Selection & engagement:** `selectedRoomId`, `listenMode` ∈ `idle | monitor | coach |
  enter`, `transcriptOn` (boolean, per selected room).
- **Transcripts:** keyed by room id; each line is `{ speaker, text, timestamp }` for
  participants or `{ kind: "supervisor", channel: "coach" | "enter", text, timestamp }`
  for supervisor messages.

In production, rooms and transcripts come from jambonz (live), not a timer. Derived values
(agent count, "others" count, whether Coach is available) are computed from `participants`.

## jambonz Integration (high-level)
*Kept intentionally high-level — the developer's Claude Code environment has access to the
jambonz MCP server and can drill into exact endpoints, payloads, and media operations.*
- **Authenticate** against the supplied Base URL using the username/password and/or API key.
- **List live calls/rooms** scoped to the Account SID via the jambonz REST API (using the
  API key), and keep the list live (poll or subscribe as the platform supports).
- **Resolve room participants** and their tags; an `agent` tag identifies agents (drives the
  agent/other counts and whether Coach is offered).
- **Listen / Coach / Enter** map to jambonz call-monitoring media operations
  (silent monitor, whisper-to-agent coaching, and full barge/join respectively). Confirm
  the exact operations and parameters via the jambonz docs/MCP.
- **Transcript** maps to jambonz real-time transcription for the selected call/room,
  started and stopped on demand.

## Design Tokens (jambonz UI Kit)
Use the bundled design system (`prototype/_ds/`) — load `styles.css` + `_ds_bundle.css`
and reference these CSS custom properties rather than hard-coding values.
- **Brand / palette:** `--jambonz` `#da1c5c` (magenta), `--blue` `#006dff`,
  `--teal` `#30beb0`, `--purple` `#9662b2`, `--green` `#008a1a`, `--red` `#e10e22`,
  `--dark` `#231f20`, plus `--white`, `--grey`, `--grey-light`, `--pink` (pale magenta).
- **Role colors in this design:** Listen = `--blue`, Coach = `--purple`,
  Enter Room = `--jambonz`, agent accents = `--teal`, selected room = `--pink`.
- **Type:** Objectivity family via `--font-regular` / `--font-medium` / `--font-bold`.
  Sizes used: room/section titles ~1.05–1.4rem, body 0.95–0.96rem, meta 0.72–0.85rem.
- **Radius:** controls/inputs 9–10px, room/avatar squares 11–14px, chips 8px, pills 20–23px.
- **Spacing:** rail width 380px, top bar 64px, control bar min-height 62px, card/section
  padding ~14–24px.

## Assets
- **jambonz UI Kit** design system — bundled at `prototype/_ds/` (fonts, compiled CSS,
  component bundle). Use the project's own copy of `@jambonz/ui-kit` in production.
- **Icons** are inline Feather-style SVGs (headphones, mic, users, log-in, file-text,
  arrows, etc.). Use the target codebase's icon library (e.g. `react-feather`) for
  equivalents — no bespoke icon assets are required.
- No photographic or raster assets.

## Files
- `prototype/CallCenterSupervisor.dc.html` — the top-level app: login, top bar, room list,
  mock data + live-transcript engine, and all state/handlers.
- `prototype/CallDetail.dc.html` — the detail pane: header, participant chips, the
  Listen/Coach/Enter control bar, the speak input, and the transcript with its toggle.
- `prototype/_ds/` — the jambonz UI Kit design system (tokens, fonts, components).
- `prototype/support.js` — runtime for the prototype's component format; **not** part of
  the design to reproduce.
- `screenshots/` — rendered reference images of each screen and state.

> Note on history: this design went through earlier directions (a call-center agent tool,
> then a general call monitor). This README and the bundled files describe **only the
> current room-supervision design** — disregard any other framing.
