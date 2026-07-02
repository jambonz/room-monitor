# Room Monitor — Architecture

A desktop web application for an operations supervisor to monitor live **rooms**
(conferences) on a jambonz system for a single account. The supervisor sees every
live room, selects one, and can **Listen** silently, **Coach** the agents
privately, or **Enter the room** as a full participant. A live, speaker-labelled
**transcript** can be toggled per room, independently of listening.

The UI specification (look, layout, copy, interaction states) lives in
[`docs/design-reference/`](./design-reference/) — a high-fidelity HTML prototype
built from the jambonz UI Kit. This document covers how that UI is wired to a
real jambonz back end.

> The prototype is the spec for *appearance and behaviour*. Everything below is
> about real data, media, and control against jambonz.

---

## 1. Domain mapping

| UI concept | jambonz reality |
|---|---|
| **Room** | a jambonz **conference** (the `conference` verb; a server-side mixing object on MediaJam). Identified by name, keyed in Redis as `conf:{accountSid}:{name}`. |
| **Participant** | a call leg that is a member of the conference. |
| **Agent** | a member carrying `memberTag: "agent"`. **Agents are tagged by whatever application created the conference** — the monitor only *reads* the tag. A room may have zero agents. |
| **Other** | any member without the `agent` tag. |
| **Listen** (`monitor`) | supervisor leg joined **muted** — hears the mix, heard by no one. |
| **Coach** (`coach`) | `conferenceParticipantAction { action: "coach", tag: "agent" }` + unmute → supervisor audio heard **only by agents**. Gated on agent presence. |
| **Enter Room** (`enter`) | `conferenceParticipantAction { action: "uncoach" }` + unmute → heard by everyone. |
| **Transcript** | a **conference-level listen-fork** (MediaJam conf-bot) streaming the room mix to the backend, which runs diarized STT. Independent of the supervisor's leg. |

The three monitoring modes are **one supervisor leg** whose participant-action
changes — switching modes is a mid-call command, never a re-dial.

Coach is governed by agent presence: if a room has no agents the Coach control is
hidden; if the supervisor is coaching and the agents all leave, fall back to
Listen.

---

## 2. Two independent pipelines

The system is deliberately split into two pipelines that share nothing but the
React app's data WebSocket and the room's name.

### Pipeline A — Supervisor media + control

```
React (WebRTC SDK) ──SIP/WebRTC media──▶ jambonz SBC ──▶ supervisor's call leg
React (data WS) ──"set mode" intent──▶ Room Monitor backend
                                          │
                                          ├─ owns the supervisor leg (@jambonz/sdk ws app):
                                          │    conference({ name, joinMuted: true, memberTag: "supervisor" })
                                          │    captures the leg's call_sid
                                          └─ mode change ──▶ conferenceParticipantAction
                                               (injected over the leg's own ws session)
```

- The supervisor authenticates the **WebRTC SDK** (`@jambonz/client-sdk-web`,
  SIP-over-WebSocket) with a provisioned jambonz **client (SIP user)** credential
  and places a call that jambonz routes to the Room Monitor's dedicated
  application. The target room + initial mode travel as custom SIP headers
  (`X-Room`, `X-Mode`).
- The backend's `@jambonz/sdk` **websocket app** answers that call, joins it to
  the conference muted/tagged, and remembers the `call_sid`. The frontend never
  sees the `call_sid`; it sends room-scoped intents ("room X → coach") and the
  backend maps them to the live supervisor leg.
- Mode changes use `conf:participant-action` (`coach`/`uncoach`) plus
  `conf:mute-status`, **injected over the supervisor leg's own websocket
  session**. The same actions are dual-surfaced over REST
  (`PUT /Calls/{sid}`), but the in-session inject is used deliberately: it
  reaches the exact feature-server process that owns the leg by construction,
  so the app works on deployments where multiple FS instances share one HTTP
  port (the stock single-box config) and leg-scoped REST cannot be routed to a
  specific instance.

### Pipeline B — Transcription (no `@jambonz/sdk`, no supervisor leg)

```
Room Monitor backend ──POST /Conferences/{name}/listen { wsUrl }──▶ api-server
   api-server ──(home FS from conf:{sid}:{name} Redis hash)──▶ feature-server
      feature-server ──MediaServer.startConferenceFork(name, { wsUrl })──▶ MediaJam
         MediaJam ──room.fork.start (conf-bot, room mix)──▶ dials our wsUrl
MediaJam ──L16 PCM (room mix)──▶ Room Monitor WS sink ──▶ Deepgram (diarize) ──▶ React (data WS)
```

- jambonz's responsibility ends at *"attach a Listen WebSocket to this conference
  and stream its mixed audio to `wsUrl`."* It has **no concept of transcription**.
- The fork is MediaJam's **conf-bot**: a WebSocket-fork member with no caller
  endpoint, excluded from the real participant count, never keeps the room alive,
  and reaped automatically when the room ends (self-tears-down on
  disconnect/connect-failure). So the tap is invisible to the UI's counts and
  cannot leak.
- The audio path is a straight line MediaJam → backend → Deepgram. Only the
  **start/stop control** rides the REST → api-server → FS path.
- **Lifecycle** (all backend-driven): transcript toggled **on** → start the fork;
  transcript **off**, **switch room**, or **logout/disconnect** → stop the fork.
  Room ends on its own → MediaJam reaps the conf-bot.
- **Diarization** runs on the mono room mix, so speaker labels are vendor-diarized
  (`speaker N`) with best-effort mapping to participants. The design's coloured
  speaker labels degrade gracefully to generic speaker labels.

---

## 3. Components

### Frontend — `apps/web`
- React + Vite, styled with the jambonz UI Kit (`@jambonz/ui-kit`) tokens; icons
  via `react-feather`.
- `@jambonz/client-sdk-web` for the supervisor's media leg (register, call the
  monitor app, mute/unmute, hangup).
- A **data WebSocket** to the backend for: live room list, transcript lines, and
  supervisor-leg state; and for sending room-scoped intents (select / mode /
  transcript on-off).
- Holds no secrets beyond what the SDK needs to register. API key and password
  are never persisted.

### Backend — `apps/server`
- Node + TypeScript. Responsibilities:
  1. **`@jambonz/sdk` websocket app** — handles the supervisor's inbound WebRTC
     call, joins it to the conference, captures `call_sid`, drives mode changes.
  2. **`@jambonz/sdk` REST client** — room discovery (enriched `/Conferences`),
     mode changes (fallback), and the conference listen-fork start/stop.
  3. **WS sink + Deepgram** — receives the room-mix PCM fork and runs diarized
     STT.
  4. **Data WS server** — fans room list + transcript + state to the frontend.

### Shared — `packages/shared`
- TypeScript types shared by frontend and backend: the data-WS message contract,
  room/participant/transcript shapes, mode enum.

---

## 4. Data-WS message contract (frontend ⇄ backend)

Provisional; finalized in `packages/shared`.

**Server → client**
- `rooms` — full/delta list: `{ id, name, durationSec, participants: [{ callSid, label, isAgent }] }[]`
- `supervisorState` — `{ roomId, mode: "idle"|"monitor"|"coach"|"enter" }`
- `transcript` — `{ roomId, line: { speaker, text, tsMs, channel?: "coach"|"enter" } }`
- `transcriptState` — `{ roomId, on: boolean }`

**Client → server**
- `select` — `{ roomId }`
- `setMode` — `{ roomId, mode }`
- `transcript` — `{ roomId, on: boolean }`

Derived values (agent count, "others" count, Coach availability) are computed
from `participants`, never sent denormalized.

---

## 5. Platform-side changes

The monitor reuses stock jambonz wherever possible. Four small, well-scoped
additions are needed, each its own PR. They make the conference Listen-fork and
room discovery addressable by **conference**, not by a member call leg.

### 5.1 `@jambonz/mrf` — room-level conference fork *(repo: jambonz/mrf)*
Add `MediaServer.startConferenceFork(room, opts)` / `stopConferenceFork(room, member)`
that issue **server-scoped** `room.fork.start`/`room.fork.stop` via
`this._connection.request(cmd, null, { room, ... })` — mirroring the existing
server-scoped `room.query`. The fork payload is already pure `{ room, wsUrl, … }`;
this just issues it over the media-server connection instead of a member endpoint.

### 5.2 MediaJam — server-scoped `room.fork` dispatch *(repo: jambonz/mediajam)*
In `internal/app/app.go`, add `room.fork.start`/`room.fork.stop` to the
**server-scoped** command switch (the `a.*` section, alongside `room.query` and
`room.play`), with an `a.roomForkStart` that passes a **connection-level emit** to
the already-`emit`-parameterized `Manager.RoomForkStart`. The fork engine is
unchanged. Precedent: `room.play` is already registered in both the server-scoped
and endpoint-scoped switches; fork lifecycle events route to the home FS's
media-server connection (more correct — they belong to the conference, not a
transient member).

### 5.3 feature-server — conference-level listen *(repo: jambonz/feature-server)*
- Add a **conference-scoped** HTTP route (no `CallSession` required) to
  start/stop a room listen-fork by `confName`, issuing it via the MediaServer-level
  `startConferenceFork` (5.1).
- Track the returned `botMemberId` in the **conference Redis hash**
  (`conf:{accountSid}:{name}`) rather than on a member's `Conference` task, making
  start/stop conference-addressed, member-independent, and idempotent; tear down on
  conference end.
- (Minor) add `conf_listen_status` to the REST `updateCall` dispatch for
  parity/back-compat — the call-scoped path exists over the websocket today but is
  not mapped in REST.

### 5.4 api-server — conferences endpoints *(repo: jambonz/api-server)*
- **Enriched listing**: `GET /Accounts/{sid}/Conferences?expand=participants` →
  rooms with `durationSec` and `participants[] { call_sid, callerId|number,
  memberTag }`. (Stock `GET /Conferences` returns only conference IDs.) Backs the
  room list, detail chips, and Coach-gating.
- **Conference listen control**: `POST` / `DELETE
  /Accounts/{sid}/Conferences/{name}/listen`, body `{ wsUrl, wsAuth?, mixType?,
  sampleRate? }`. Resolves the home FS from the `conf:{sid}:{name}` Redis hash
  (`sipAddress`) and forwards to the feature-server route (5.3); returns
  `{ botMemberId }`. Pure audio transport to a websocket — no STT vocabulary.

---

## 6. Authentication & provisioning

The login screen collects Base URL, Account SID, API key, Username, Password.

- **API key** → REST calls (room discovery, listen control). Held server-side;
  never sent to the browser or persisted.
- **Username / Password** → a provisioned jambonz **client (SIP user)** on the
  account, used by the WebRTC SDK to register against the SBC. Never persisted.
- Non-secret fields (Base URL, Account SID, Username) may persist per the target
  app's conventions; **secrets never go to `localStorage`**.

> **Open provisioning item:** confirm how the supervisor's webrtc-client
> credential is created on the account (manual vs. tool-provisioned).

---

## 7. Repo layout

```
room-monitor/
  apps/
    web/        React + Vite frontend (UI Kit, WebRTC SDK, data WS client)
    server/     Node + TS backend (@jambonz/sdk app + REST, WS sink + Deepgram, data WS)
  packages/
    shared/     shared TS types (data-WS contract, domain shapes)
  docs/
    ARCHITECTURE.md       (this file)
    design-reference/     the HTML prototype + screenshots (UI spec)
```

## 8. Status / sequencing

PRs land in dependency order:

1. `@jambonz/mrf` — room-level fork methods (5.1)
2. MediaJam — server-scoped `room.fork` dispatch (5.2)
3. feature-server — conference-level listen + REST `conf_listen_status` (5.3)
4. api-server — conferences endpoints (5.4)
5. room-monitor — backend + frontend against the contracts above

The frontend and backend skeletons can be built against the documented contracts
in parallel with the platform PRs.
