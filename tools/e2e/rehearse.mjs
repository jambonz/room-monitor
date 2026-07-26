#!/usr/bin/env node
/**
 * Solo demo rehearsal: spawns a fake agent + caller into a room and choreographs
 * a natural turn-taking conversation (mute-button driven, no overlapping speech)
 * so ONE person can drive the supervisor console against a live room.
 *
 *   ACCOUNT_SID=… API_KEY=… CLIENT_PASSWORD=… node rehearse.mjs
 *
 * Env (defaults for eu.jambonz.io in parens):
 *   WEB_URL (https://eu.jambonz.io/monitor)   hosted console/phone page
 *   SBC_URL (wss://sip.eu.jambonz.io:8443)    SIP over WSS
 *   SIP_REALM (sip.eu.jambonz.io)
 *   APP_SID (discovered by name via BASE_URL/ACCOUNT_SID/API_KEY when unset)
 *   BASE_URL (https://eu.jambonz.io/api)
 *   ROOM (support-line)      the room your console will show
 *   DURATION_S (300)         how long the conversation runs
 *   TURN_S (7)               seconds per speaking turn
 *   AGENT_WAV / CALLER_WAV   continuous speech WAVs (see tools/e2e/audio)
 *   CODEC (unset)            e.g. pcmu to force narrowband PSTN-like legs
 *
 * The fake mics need Chromium's fake capture; WAVs play once, so keep them
 * longer than DURATION_S.
 */
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const env = (k, d) => process.env[k] ?? d;
const WEB = env('WEB_URL', 'https://eu.jambonz.io/monitor');
const SBC = env('SBC_URL', 'wss://sip.eu.jambonz.io:8443');
const REALM = env('SIP_REALM', 'sip.eu.jambonz.io');
const BASE_URL = env('BASE_URL', 'https://eu.jambonz.io/api').replace(/\/+$/, '');
const ROOM = env('ROOM', 'support-line');
const DURATION = Number(env('DURATION_S', '300'));
const TURN = Number(env('TURN_S', '7')) * 1000;
const CODEC = env('CODEC', '');
const AGENT_WAV = env('AGENT_WAV', join(here, 'audio', 'agent.wav'));
const CALLER_WAV = env('CALLER_WAV', join(here, 'audio', 'caller.wav'));
const PASSWORD = process.env.CLIENT_PASSWORD;

let appSid = process.env.APP_SID ?? '';
if (!appSid) {
  const res = await fetch(`${BASE_URL}/v1/Accounts/${process.env.ACCOUNT_SID}/Applications`, {
    headers: { Authorization: `Bearer ${process.env.API_KEY}` },
  });
  const apps = await res.json();
  appSid = apps.find((a) => a.name === 'room-monitor')?.application_sid ?? '';
}
if (!appSid || !PASSWORD) {
  console.error('need APP_SID (or ACCOUNT_SID+API_KEY to discover it) and CLIENT_PASSWORD');
  process.exit(1);
}

const browsers = [];
async function joinPhone(wav, username, role) {
  const b = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${wav}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  browsers.push(b);
  const page = await b.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(`${WEB}/#phone-raw?room=${ROOM}${CODEC ? `&codec=${CODEC}` : ''}`);
  await page.getByLabel('SBC WebSocket URL').fill(SBC);
  await page.getByLabel('SIP realm').fill(REALM);
  await page.getByLabel('Application SID').fill(appSid);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByLabel('Room').fill(ROOM);
  await page.getByRole('button', { name: role, exact: true }).click();
  await page.getByRole('button', { name: 'Join room' }).click();
  await page.getByText('In the room as').waitFor({ state: 'visible' });
  return page;
}

const setMuted = async (page, muted) => {
  // the phone page's toggle reflects state in its label
  const btn = page.getByRole('button', { name: muted ? 'Mute' : 'Unmute' });
  await btn.click({ timeout: 2000 }).catch(() => {});
};

console.log(`joining room "${ROOM}"${CODEC ? ` (codec=${CODEC})` : ''}…`);
const agent = await joinPhone(AGENT_WAV, 'agent1', 'Agent');
console.log('agent1 in room');
const caller = await joinPhone(CALLER_WAV, 'caller1', 'Caller');
console.log('caller1 in room');

// choreograph turns: exactly one participant unmuted at a time (no overlap —
// clean turn-taking like real humans, which diarization depends on)
await setMuted(agent, true);
console.log(`conversation running for ${DURATION}s (${TURN / 1000}s turns) — drive the console at ${WEB}`);
let agentTurn = false; // caller opens
const started = Date.now();
while (Date.now() - started < DURATION * 1000) {
  await new Promise((r) => setTimeout(r, TURN));
  agentTurn = !agentTurn;
  await setMuted(agentTurn ? caller : agent, true);
  await new Promise((r) => setTimeout(r, 250)); // handoff beat, no overlap
  await setMuted(agentTurn ? agent : caller, false);
}

console.log('wrapping up — leaving the room');
for (const p of [agent, caller]) {
  await p.getByRole('button', { name: 'Leave' }).click({ timeout: 2000 }).catch(() => {});
}
await agent.waitForTimeout(1500);
for (const b of browsers) await b.close().catch(() => {});
console.log('done');
