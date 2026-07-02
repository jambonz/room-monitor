# Room Monitor

A desktop web console for an operations supervisor to monitor live **rooms**
(conferences) on a jambonz system for a single account: **Listen** silently,
**Coach** the agents privately, **Enter the room** as a full participant, and
toggle a live, speaker-labelled **transcript** per room.

## Layout

```
apps/web/        React + Vite frontend (jambonz UI Kit, WebRTC SDK, data WS)
apps/server/     Node + TS backend (@jambonz/sdk app + REST, fork sink + Deepgram, data WS)
packages/shared/ shared TS types — the data-WS contract and domain shapes
docs/            ARCHITECTURE.md + design-reference/ (the UI prototype & screenshots)
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). In brief, two independent
pipelines:

- **Supervisor media + control** — WebRTC SDK media leg into the conference;
  Listen/Coach/Enter are `conferenceParticipantAction` mode changes on that one
  leg.
- **Transcription** — a conference-level Listen-fork (MediaJam conf-bot) streams
  the room mix to the backend, which runs diarized STT (Deepgram). Independent of
  the supervisor's leg; jambonz has no concept of transcription here.

## Develop

```bash
npm install
npm run dev:server   # backend
npm run dev:web      # frontend (http://localhost:3000; demo phone at /#phone)
```

Copy `apps/server/.env.example` to `apps/server/.env` and fill in the SBC URL,
fork sink URL, and Deepgram key (the backend fails fast if they're missing).
jambonz connection secrets are supplied per-session via the login screen and
held in memory only.

## Demo

See [DEMO.md](DEMO.md) for platform prerequisites, jambonz account provisioning,
demo traffic (the `/#phone` page + `tools/traffic/`), and the demo runbook.

## Building on this

Room Monitor is a reference application. [docs/ADAPTING.md](docs/ADAPTING.md)
covers the stable jambonz contract it's built on, the demo shortcuts to replace
before production, and the common adaptations (agent tagging in your own call
flow, operator auth/tenancy, swapping the STT/AI audio consumer, per-leg speaker
attribution, embedding the UI) — with pointers to the exact seams in the code.
