# Room Monitor — Demo Setup & Runbook

> **Live on eu.jambonz.io** (as of 2026-07-01):
> - Console: `https://eu.jambonz.io/monitor/`
> - Demo phone: `https://eu.jambonz.io/monitor/#phone`
> - Inbound DID callers: route a phone number to the **`room-monitor-caller`**
>   application. Which room they join is that application's **`ROOM_NAME` env
>   var** — editable on the portal's application screen (the app declares it via
>   OPTIONS discovery), default `lobby`. No redeploy to change rooms.
> - Hosted via nginx: `/monitor/` serves the web build, `/rm-ws` proxies the
>   data-WS (build the frontend with `VITE_BASE=/monitor/` and
>   `VITE_DATA_WS_URL=wss://<host>/rm-ws`).

Everything needed to run a live demo: platform prerequisites, jambonz account
provisioning, app configuration, traffic, and the demo script itself.

## 1. Platform prerequisites (dev system)

The demo requires a jambonz deployment with:

- **MediaJam** as the media server (the conference listen-fork is a MediaJam
  conf-bot), with server-scoped `room.fork` dispatch (mediajam PR #53, merged).
- **feature-server** with conference-level listen
  ([PR #128](https://github.com/jambonz/feature-server/pull/128)) — includes
  `@jambonz/mrf` ≥ 0.2.11.
- **api-server** with the conferences endpoints
  ([PR #62](https://github.com/jambonz/api-server/pull/62)).

Sanity check from anywhere with the API key:

```bash
curl -s -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/v1/Accounts/$ACCOUNT_SID/Conferences?expand=participants"
# → [] (empty array, not an error) when no rooms are live
```

## 2. Provision the jambonz account (portal)

1. **Applications** — create two (or run `tools/e2e/provision.mjs`):
   - **`room-monitor`** (the backend resolves it by this name; override with
     `MONITOR_APP_NAME`): calling webhook `ws://<backend-host>:3002/supervisor`
     (WebSocket). Serves the console's monitoring leg and the phone page. Note
     its **application SID** — the phone page needs it (the console discovers it
     automatically).
   - **`room-monitor-caller`**: calling webhook `ws://<backend-host>:4003/caller`.
     Route your **DID** to this application. Its **`ROOM_NAME` env var** (shown
     on the application screen via OPTIONS discovery) selects the conference
     inbound callers join — change it from the portal any time, default `lobby`.
2. **Clients (webrtc SIP users)** — create at least three, active, with
   passwords:
   - `supervisor` — used by the console login.
   - `agent1`, `caller1` — used by demo phone tabs (more if you want more tabs).
3. **API key** — an account-scoped API key (Account → API Keys).
4. Note the account's **SIP realm** and the SBC's **WebSocket URL**
   (e.g. `wss://<sbc-host>:8443`).

No dial-plan/routing config is needed: both the console and the phone page dial
`app-<sid>` with an `X-Application-Sid` header, which the SBC routes directly to
the application.

## 3. Configure and run the app

Backend (`apps/server/.env`):

```bash
PORT=3001                          # data-WS the browser connects to
JAMBONZ_WS_APP_PORT=3002           # jambonz-facing ws app (/supervisor, /fork)
WEBRTC_SBC_URL=wss://<sbc-host>:8443
# MUST be reachable FROM the MediaJam host (it dials out to this):
FORK_SINK_URL=ws://<backend-host>:3002/fork
DEEPGRAM_API_KEY=<key>             # transcription (backend-only)
```

The backend fails fast at startup if any of the three required values are
missing. Health checks: `GET :3001/health` and `GET :3002/health`.

```bash
npm install
npm run dev:server    # backend
npm run dev:web       # frontend → http://localhost:3000
```

The `ws://<backend-host>:3002` port must be reachable from the feature-server /
MediaJam network (it receives the supervisor call control and the fork audio).

## 4. Create demo traffic

### Live participants — the phone page (primary)

Open `http://localhost:3000/#phone` in one tab per participant. To make sure
everyone lands in the same room, share a link with the room preset — e.g.
`…/#phone?room=support-line` (use the same name as the caller app's
`ROOM_NAME`); the Room field prefills from it.

- SBC URL + Application SID prefill automatically if the console has connected
  on the same browser; otherwise paste them.
- Sign in as `agent1`, pick **Agent**, room `demo-room`, Join.
- Second tab: `caller1`, **Caller**, same room, Join.

Two tabs = a live room with one tagged agent and one caller, real microphones.

### Background rooms — the traffic kit (optional)

Fills the rail with additional live rooms and feeds the transcript with looped
synthesized speech. Requires `sipp` on a host that can reach the SBC.

```bash
cd tools/traffic
./make-wav.sh speech.wav                 # 8k mono PCM speech (say/espeak + sox)
SBC=<sbc-host> APP_SID=<application-sid> WAV=speech.wav \
  ROOMS="billing-helpdesk overflow-queue" ./run.sh
# add AUTH_USER/AUTH_PASS if your SBC digest-challenges INVITEs
```

> Testing with real people? [docs/LIVE-TEST.md](docs/LIVE-TEST.md) is a
> ready-to-send hand-out for a three-person test (supervisor / agent / caller)
> — fill in the placeholders from your deployment and share it privately.

## 5. Demo script

1. **Login** — open `http://localhost:3000`, enter Base URL (api-server),
   Account SID, API key, and `supervisor` + password → Connect. The room list
   populates within ~2s of rooms existing.
2. **Rooms rail** — point out live rooms, agent (teal) vs others counts,
   durations ticking; the empty state if no rooms yet.
3. **Listen** — select `demo-room`, click Listen. You hear both participants;
   they don't hear you (the "You · listening" chip + status line say so). Note
   the supervisor does NOT appear as a participant.
4. **Coach** — click Coach (only offered because an agent is present). Speak:
   the **agent tab hears you, the caller tab does not**. This is
   `conferenceParticipantAction {action: coach, tag: agent}` on the live leg —
   no re-dial.
5. **Enter Room** — click Enter Room: everyone hears you (barge-in). Then
   Leave room → back to idle.
6. **Transcript** — toggle LIVE TRANSCRIPT on. Speaker-labelled lines appear
   (diarized room mix via a MediaJam conf-bot → Deepgram — jambonz only
   transports audio; the STT is the app's). Toggle off; switch rooms — the tap
   stops automatically. Note transcription works with the supervisor fully
   idle: it's independent of listening.
7. **Coach fallback** — while coaching, have the agent tab Leave. Within a
   poll (~2s) the console falls back to Listen and the Coach button disappears.
8. **Teardown** — hang up the phone tabs; the room disappears from the rail;
   sign out.

## 6. Troubleshooting

- **Login fails with "no application named room-monitor"** — the application
  isn't provisioned (or is named differently; set `MONITOR_APP_NAME`).
- **Listen/Coach/Enter does nothing** — check the backend log for
  `supervisor joined conference`; if absent, the SBC isn't routing to the app
  (verify the application's calling webhook URL is reachable from the
  feature-server) or the WebRTC client isn't registered (browser console).
- **Transcript toggle snaps back to Off** — the fork failed to start; check
  api-server → feature-server logs (`conferences: started conference listen
  fork`) and that `FORK_SINK_URL` is reachable **from the MediaJam host**.
- **Transcript on but no lines** — check the backend log for
  `fork audio connected — initial metadata frame` (fork arrived) and Deepgram
  errors after it; verify `DEEPGRAM_API_KEY`.
- **Phone page call fails immediately** — wrong Application SID, or the SBC
  URL is not the WebSocket (wss) endpoint.
