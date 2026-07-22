# Adapting Room Monitor for Your Own Application

Room Monitor is a **reference application**: it demonstrates jambonz's
conferencing feature range (silent monitor, coach/whisper, barge-in, on-demand
transcription) with a real UI and a real backend, wired the way we'd wire it.
It is intentionally small and readable so you can take it apart and rebuild it
into your own supervision, QA, or AI-observation product.

This document covers three things: the **stable jambonz contract** you build
against, the **demo shortcuts** you must replace before production, and the
**common adaptations** with pointers to the exact seams in the code.

---

## 1. The jambonz contract (the part you keep)

Everything the monitor does rides on five platform primitives. These are the
stable surface to build against — your version of this app can change everything
else.

| Capability | How |
|---|---|
| Discover live rooms + participants | `GET /Accounts/{sid}/Conferences?expand=participants` → rooms with `durationSec` and `participants[] { call_sid, label, memberTag, isAgent }` |
| Who is an "agent" | the **`memberTag`** on each conference member — set at join time by whatever application put them in the conference, or added/removed **mid-call** on a live participant (see §3.1) |
| Supervisor's engagement | one call leg into the conference; modes are mid-call commands on it (`conferenceParticipantAction {coach/uncoach/...}` + `conf_mute_status`) — **never a re-dial**. This app injects them over the leg's own websocket session (works on any FS topology); the REST equivalent (`PUT /Accounts/{sid}/Calls/{call_sid}`) needs per-instance HTTP routing, which stock single-box deployments don't have |
| Room audio out (for transcription, AI, recording…) | `POST` / `DELETE /Accounts/{sid}/Conferences/{name}/listen` `{url, sampleRate, wsAuth?, metadata?}` — jambonz streams the room mix (L16 PCM) to *your* WebSocket and knows nothing about what you do with it. Your `metadata` is delivered verbatim as the fork's first text frame. |
| Routing a WebRTC leg to your app | dial `app-<application_sid>` with an `X-Application-Sid` header (plus any custom `X-*` headers you want to read in your app) — no dial-plan config |

Two lifecycle guarantees worth knowing: the audio fork is a media-server-owned
"conf-bot" — it is **excluded from participant counts, never keeps a room
alive, and is torn down automatically when the room ends**; and coached audio
is never delivered to untagged members **including forks**, so a transcription
or recording tap cannot leak private coaching.

## 2. Demo shortcuts — replace these before production

Honesty section. Each of these was the right choice for a demo and the wrong
one for your product:

1. **No auth on the data WebSocket.** Anyone who can reach the backend's `/ws`
   can monitor calls. Put your operator authentication in front of it
   (`apps/server/src/data-ws.ts` is the seam — authenticate the WS upgrade or
   the `connect` message against your IdP/JWT).
2. **Credentials typed into the login screen — and persisted in
   localStorage.** All login fields, including the API key and SIP password,
   are remembered by the browser (`components/Login.tsx`, `PhonePage.tsx`) so a
   reload doesn't force re-typing — a deliberate demo-tool convenience. In
   production the backend should hold its jambonz credentials server-side
   (env/secret store) and your operators should log in with *their* identity,
   mapped to an account; nothing secret belongs in browser storage.
3. **The phone page and the caller/demo apps are test fixtures.** In your world,
   agents and callers arrive through your existing call flow — delete
   `PhonePage.tsx`, the `X-Role` branch in `jambonz-app.ts`, and
   `caller-app.ts`, or keep them only as testing tools.
4. **Polling for room state.** The backend polls the Conferences endpoint every
   2s per session — fine for a demo, chatty at scale. Consider conference
   `statusHook`/call-status webhooks to push changes, and share one poller
   across sessions.
5. **One transcript consumer per room.** The listen fork start is idempotent
   per conference, and transcript lines are delivered to the session that
   started it. If several supervisors watch the same room you'll want fan-out
   (see §3.4).
6. **Nothing is persisted.** Transcripts, room history, supervisor actions —
   all in-memory and gone on refresh. Add storage where your compliance/QA
   needs demand it.
7. **Single-box assumptions.** `FORK_SINK_URL` points MediaJam at one backend
   instance; run multiple backend instances and you need per-instance sink URLs
   or a shared audio-ingest tier, plus a bus (e.g. Redis pub/sub) for rooms and
   transcript events.
8. **Operational hardening** — data-WS/WebRTC reconnect on network blips,
   metrics, containerization, log shipping: all absent by design.

## 3. Common adaptations

### 3.1 Tag agents in *your* call flow (the one true integration point)

The monitor never decides who is an agent — it reads `memberTag`. Wherever your
existing application puts an agent into a conference, add the tag:

```js
session.conference({ name: room, memberTag: 'agent', ... });
```

**Tags are fully dynamic** — jambonz has primitives to add or remove a tag on a
participant who is *already in* a conference, so role changes mid-call need no
re-join. Two ways to do it with `@jambonz/sdk`:

**From the application controlling that leg** (websocket app) — inject the
`conf:participant-action` command on the live session:

```js
// promote a live participant to agent (e.g. warm transfer completed,
// trainee takes over, human joins an AI-handled call)
session.injectCommand('conf:participant-action', { action: 'tag', tag: 'agent' });

// demote — remove the tag
session.injectCommand('conf:participant-action', { action: 'untag' });

// a third argument targets another leg the same session controls (e.g. a dialed B-leg)
session.injectCommand('conf:participant-action', { action: 'tag', tag: 'agent' }, bLegCallSid);
```

**From anywhere else** (another service, an ops tool) — the REST client, which
types the full action set (`tag | untag | coach | uncoach | mute | unmute |
hold | unhold`):

```js
import { JambonzClient } from '@jambonz/sdk/client';

const client = new JambonzClient({ baseUrl, accountSid, apiKey });
await client.calls.update(callSid, {
  conferenceParticipantAction: { action: 'tag', tag: 'agent' },
});
// later: { action: 'untag' }
```

The system reacts to tag changes live: an active coach re-relates automatically
(the coaching member's audio starts/stops reaching the participant as their tag
changes), and this monitor's room list reflects the new agent/other counts —
and Coach-button gating — within a poll (~2s).

You can also use richer taxonomies — `speakOnlyTo` accepts any tag, so "coach
only the trainee" or "whisper to the interpreter" are the same mechanism with a
different tag. The UI's Coach gating (`coachAvailable()` in
`packages/shared/src/index.ts`) is one line to generalize.

### 3.2 Operator auth, tenancy, and scoping

Beyond authenticating the data-WS (§2.1–2.2): most real deployments scope which
rooms an operator may see. The seam is `SupervisorSession.poll()`
(`apps/server/src/session.ts`) — filter the room list by team/queue/tag before
sending it to the browser. Room metadata for scoping can travel in the
conference name convention or in call `tag` data your flow attaches.

### 3.3 Swap or extend the audio consumer

`apps/server/src/transcription.ts` is ~120 lines of "PCM in → Deepgram →
labelled fragments out". The fork feed is plain L16 PCM over a WebSocket, so
this is where you'd plug in:

- a different STT vendor (or your account's speech credentials);
- **AI supervision** — sentiment, compliance phrase detection, auto-summaries,
  agent-assist prompts pushed back to the agent;
- raw recording/archival (write the PCM to storage — note jambonz also has
  native conference recording if that's all you need).

### 3.4 Better speaker attribution / multi-viewer transcripts

The demo transcribes the mono room mix, so speakers are diarized as
"Speaker N". For true attribution, transcribe **per leg** (your conference
application can run `transcribe` on each member, or fork each leg) and merge by
`call_sid` — you own both sides of that trade-off (cost/complexity vs. named
speakers). For multiple simultaneous viewers, publish transcript fragments to a
bus keyed by room and let each session subscribe, instead of the 1:1
fork→session wiring in `jambonz-app.ts handleForkAudio()`.

### 3.5 Supervisor "speak" beyond the mic

The design's optional text-input-to-agents can be implemented with jambonz
primitives: `whisper` (say/play to one leg) against each agent's `call_sid`, or
`room:say` for announce-to-all. Both are mid-call commands like the mode
switches — see `applyMode()` in `session.ts` for the pattern.

### 3.6 Embed the UI, or replace it

The browser talks to the backend over a small typed contract —
`packages/shared/src/index.ts` (four server messages, four client commands).
That contract is deliberately UI-agnostic: embed `RoomRail`/`RoomDetail` in
your ops portal, restyle via the token variables in `apps/web/src/tokens.css`,
or throw the React app away and drive the same WS from your own front end.
The WebRTC leg is standard `@jambonz/client-sdk-web` — any UI that can place
`app-<sid>` calls with headers works.

## 4. File map (where the seams are)

```
apps/server/src/
  jambonz-rest.ts    the five REST calls to jambonz — extend here
  session.ts         per-operator state: room polling/filtering, modes, transcript lifecycle
  jambonz-app.ts     the jambonz application: supervisor leg join + audio fork sink
  transcription.ts   PCM → Deepgram; swap for your STT / AI consumer
  data-ws.ts         browser channel; put your auth here
  caller-app.ts      sample inbound-caller app (portal-editable ROOM_NAME) — a template
                     for "how my call flow creates monitored rooms"
packages/shared/     the browser⇄backend contract (typed, UI-agnostic)
apps/web/src/        the console UI; useRoomMonitor.ts is the only stateful piece
tools/e2e/           closed-loop tests — three fake-mic browsers verifying the
                     audio-visibility contracts; adapt for your CI
docs/ARCHITECTURE.md the full design, including the two-pipeline model
```

A good first exercise when adapting: run `tools/e2e/smoke.mjs` against your own
deployment. It verifies every audio contract (including coach privacy via the
transcript) and will keep verifying them as you change the code.
