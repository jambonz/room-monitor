# Live Test Hand-out (3 people, ~15 minutes)

A ready-to-send script for testing a Room Monitor deployment with real humans:
one **Supervisor**, one **Agent**, one **Caller**. Non-technical testers can
follow it as-is.

> **Operator: before sending this to testers**, replace every `<placeholder>`
> below with your deployment's values (see [DEMO.md](../DEMO.md) for
> provisioning), and share the filled-in copy privately — it will contain
> credentials. Do not commit the filled-in version to a public repo.
>
> | Placeholder | Where it comes from |
> |---|---|
> | `<console-url>` | where the web build is served, e.g. `https://your-host/monitor/` |
> | `<api-base-url>` | your jambonz API, e.g. `https://your-host/api` |
> | `<account-sid>` / `<api-key>` | the jambonz account being monitored |
> | `<sbc-wss-url>` / `<sip-realm>` | your SBC's WebSocket URL + the account's SIP realm |
> | `<app-sid>` | the `room-monitor` application's SID |
> | `<room>` | the caller application's `ROOM_NAME` env var (portal-editable) |
> | `<did>` | the phone number routed to the `room-monitor-caller` application |
> | `<password>` | the webrtc clients' password (`supervisor`, `agent1`) |

---

## What you're testing

The Call Monitor is a supervisor console built on jambonz conferencing. A
supervisor sees every live room in real time and can tap in three ways —
plus a live transcript:

- **Listen** — hears everything; nobody hears the supervisor
- **Coach** — the supervisor speaks **only to the agents**; callers can't hear it
- **Enter Room** — full barge-in; everyone hears the supervisor
- **Live transcript** — on-demand, speaker-labelled, works even while not listening

Each mode is an **audio-visibility contract**: *who hears whom*. Automated
tests verify the plumbing, but the contracts need human ears on real phones —
especially that a real caller cannot hear coaching. That's this test: three
people each holding one corner of the triangle, confirming the contract at
every step.

**Setup notes:** everyone wears **headphones**; ideally you're not all in the
same physical room (feedback). Use **Chrome** (or Edge) for the two browser
roles. Stay on a group text to compare notes on who hears what.

## Person A — Supervisor (browser)

1. Open **`<console-url>`**
2. Fill in the login exactly:
   - Base URL: `<api-base-url>`
   - Account SID: `<account-sid>`
   - API key: `<api-key>`
   - Username: `supervisor`  Password: `<password>`
3. Click **Connect**. You'll see a dark console with a "Rooms" list (empty
   until the others join).

## Person B — Agent (browser)

1. Open **`<console-url>#phone?room=<room>`** (the room prefills from the link)
2. Fill in:
   - SBC WebSocket URL: `<sbc-wss-url>`
   - SIP realm: `<sip-realm>`
   - Application SID: `<app-sid>`
   - Username: `agent1`  Password: `<password>`
3. Pick **Agent**, click **Join room**, and **allow microphone access** when
   the browser asks.

## Person C — Caller (any phone)

1. Dial **`<did>`** from your cell phone.
2. You'll hear *"Welcome. Joining …"* — you're in. Just talk normally with
   the Agent.

## The test script (Supervisor drives)

Once B and C are in, the Supervisor sees the room with **1 agent · 1 other**.
Click the room, then walk through these, checking after each step **who can
hear the Supervisor**:

| Step | Supervisor does | Expected |
|---|---|---|
| 1 | Click **Listen**, then talk | Supervisor hears both of you; **neither** of you hears the Supervisor |
| 2 | Click **Coach**, then talk | **Agent hears the Supervisor; Caller does NOT** ← the key check |
| 3 | Click **Enter Room**, then talk | **Everyone** hears everyone |
| 4 | Click **Leave room** | Supervisor is silent/idle again |
| 5 | Toggle **LIVE TRANSCRIPT** on; B & C keep talking | Speaker-labelled transcript lines appear within ~10s |
| 6 | While transcript is on, Agent clicks **Leave** | Room shows "0 agents"; the **Coach** button disappears |
| 7 | Caller hangs up | Room vanishes from the list |

## If something doesn't work

- No mic prompt / can't be heard → check the browser's mic permission
  (padlock icon in the address bar), refresh, rejoin.
- "Call failed" on the phone page → double-check the Application SID and both
  URLs (easy to typo).
- Agent and Caller can't hear each other → you're probably in different
  rooms; the Agent's Room field must match the caller app's `ROOM_NAME`
  (use the prefilled link in Person B step 1).
- Please note **which step** misbehaved and **what each person heard** —
  that's the most useful feedback. The operator can correlate with
  `pm2 logs room-monitor` on the server (every call arrival, mode change,
  and transcript-pipeline counter is logged).
