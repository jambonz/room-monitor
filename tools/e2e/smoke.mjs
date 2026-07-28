#!/usr/bin/env node
/**
 * Closed-loop smoke test for room-monitor against a live jambonz system.
 *
 * Launches three Chromium instances with scripted fake microphones
 * (--use-file-for-fake-audio-capture): a supervisor console tab, an agent
 * phone tab, and a caller phone tab. Walks the Phase-3 checklist and verifies
 * the audio path end-to-end via the transcript (known WAV scripts → expected
 * words), including coach privacy (supervisor speech absent from the room mix
 * while coaching, present after Enter Room).
 *
 * Env: WEB_URL (default http://localhost:3000), BASE_URL, ACCOUNT_SID, API_KEY,
 *      SBC_URL, CLIENT_PASSWORD, APP_SID (optional — discovered by name),
 *      ROOM (default e2e-room-1), HEADED=1 to watch.
 *
 * Prereqs: backend running on the box, ssh -L 4001 tunnel up, vite dev server
 * on WEB_URL, account provisioned (provision.mjs).
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'out');
mkdirSync(OUT, { recursive: true });

const env = (k, d) => process.env[k] ?? d;
const WEB_URL = env('WEB_URL', 'http://localhost:3000');
const BASE_URL = env('BASE_URL', '').replace(/\/+$/, '');
const ACCOUNT_SID = env('ACCOUNT_SID', '');
const API_KEY = env('API_KEY', '');
const SBC_URL = env('SBC_URL', 'wss://eu.jambonz.io:8443');
const SIP_REALM = env('SIP_REALM', 'sip.eu.jambonz.io');
const CLIENT_PASSWORD = env('CLIENT_PASSWORD', '');
const ROOM = env('ROOM', 'e2e-room-1');
const HEADED = env('HEADED', '') === '1';

if (!BASE_URL || !ACCOUNT_SID || !API_KEY || !CLIENT_PASSWORD) {
  console.error('need BASE_URL, ACCOUNT_SID, API_KEY, CLIENT_PASSWORD');
  process.exit(1);
}

// words spoken by each fake mic (see audio/*.wav) — transcript assertions
// loose on purpose: TTS → G.711 → 16k mix → Deepgram garbles somewhat
const AGENT_WORDS = /billing|bill you|account|calling support|calling tier/i;
const CALLER_WORDS = /charge|invoice|order number|four four|calling about/i;
// "refund" only — the supervisor's script is "this is the supervisor speaking,
// please offer the customer a full refund immediately", and supervisor lines are
// now LABELLED "supervisor", so matching that word could not tell speech from
// label.
const SUPERVISOR_WORDS = /refund/i;

let failures = 0;
const browsers = [];
const step = (name) => console.log(`\n=== ${name} ===`);
const pass = (msg) => console.log(`  PASS  ${msg}`);
const fail = async (msg, page) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
  if (page) {
    const shot = join(OUT, `fail-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    console.log(`        screenshot: ${shot}`);
  }
};

async function launch(wav) {
  const b = await chromium.launch({
    headless: !HEADED,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${join(here, 'audio', wav)}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  browsers.push(b);
  const page = await b.newPage();
  page.setDefaultTimeout(20000);
  return page;
}

const visible = async (page, text, timeoutMs = 20000) => {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: timeoutMs });
};

async function joinPhone(page, { username, role }) {
  await page.goto(`${WEB_URL}/#phone-raw`);
  await page.getByLabel('SBC WebSocket URL').fill(SBC_URL);
  await page.getByLabel('SIP realm').fill(SIP_REALM);
  const appSid = await discoverAppSid();
  await page.getByLabel('Application SID').fill(appSid);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(CLIENT_PASSWORD);
  await page.getByLabel('Room').fill(ROOM);
  await page.getByRole('button', { name: role === 'agent' ? 'Agent' : 'Caller', exact: true }).click();
  await page.getByRole('button', { name: 'Join room' }).click();
  await visible(page, 'In the room as', 25000);
}

let cachedAppSid = process.env.APP_SID ?? '';
async function discoverAppSid() {
  if (cachedAppSid) return cachedAppSid;
  const res = await fetch(`${BASE_URL}/v1/Accounts/${ACCOUNT_SID}/Applications`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const apps = await res.json();
  const app = apps.find((a) => a.name === (process.env.MONITOR_APP_NAME ?? 'room-monitor'));
  if (!app) throw new Error('room-monitor application not found — run provision.mjs');
  cachedAppSid = app.application_sid;
  return cachedAppSid;
}

// --------------------------------------------------------------------------
let con, agent, caller;
try {
  step('1. supervisor console: login');
  con = await launch('supervisor.wav');
  await con.goto(`${WEB_URL}/#raw`);
  await con.getByLabel('Base URL').fill(BASE_URL);
  await con.getByLabel('Account SID').fill(ACCOUNT_SID);
  await con.getByLabel('API key').fill(API_KEY);
  await con.getByLabel('Username').fill('supervisor');
  await con.getByLabel('Password').fill(CLIENT_PASSWORD);
  await con.getByRole('button', { name: 'Connect' }).click();
  await visible(con, 'live calls', 15000);
  pass('console connected (rooms polling)');

  step('2. agent + caller phones join the room');
  agent = await launch('agent.wav');
  await joinPhone(agent, { username: 'agent1', role: 'agent' });
  pass('agent1 in room');
  caller = await launch('caller.wav');
  await joinPhone(caller, { username: 'caller1', role: 'caller' });
  pass('caller1 in room');

  step('3. room appears with correct counts (and no supervisor leg)');
  await visible(con, ROOM, 15000);
  pass(`room "${ROOM}" in rail`);
  await con.getByText(ROOM).first().click();
  await visible(con, '1 agent', 10000);
  await visible(con, '1 other', 10000);
  pass('counts: 1 agent · 1 other');

  step('4. Listen (silent monitor)');
  await con.getByRole('button', { name: 'Listen' }).click();
  await visible(con, 'Monitoring silently', 25000);
  pass('listening (supervisor leg up, muted)');
  const stillOneOther = await con.getByText('1 other').first().isVisible().catch(() => false);
  if (stillOneOther) pass('supervisor leg not counted as participant');
  else await fail('participant count changed when supervisor joined', con);

  step('5. Coach (whisper to agents)');
  await con.getByRole('button', { name: 'Coach' }).click();
  await visible(con, 'Coaching — only the agents hear you', 15000);
  pass('coach mode active');

  step('6. transcript ON while coaching — audio path + coach privacy');
  await con.getByRole('button', { name: /^(Off|Turn on transcript)/ }).first().click();
  await visible(con, 'Transcribing', 15000);
  pass('fork started (waiting for speech)');
  // participant speech must appear (proves SIP→mix→fork→Deepgram)
  const deadline = Date.now() + 60000;
  let sawParticipant = false;
  while (Date.now() < deadline) {
    const text = await con.locator('.rm-scroll').innerText().catch(() => '');
    if (AGENT_WORDS.test(text) || CALLER_WORDS.test(text)) { sawParticipant = true; break; }
    await con.waitForTimeout(2000);
  }
  if (sawParticipant) pass('participant speech transcribed — audio path verified');
  else await fail('no participant speech in transcript after 60s', con);
  // Member-scoped forks (scope=members) label lines with real participant
  // identities; the diarized mix fallback labels them "Speaker N". Both
  // participants' lines take a few utterances to accumulate — wait for a
  // conclusive read rather than sampling one instant.
  let memberLabels = false;
  {
    const labelDeadline = Date.now() + 45000;
    let text = '';
    while (Date.now() < labelDeadline) {
      text = await con.locator('.rm-scroll').innerText().catch(() => '');
      if (/\bagent\b/.test(text) && /caller1|\+?\d{7,}/.test(text)) { memberLabels = true; break; }
      if (/Speaker \d/.test(text)) break; // diarized fallback mode
      await con.waitForTimeout(2000);
    }
    if (memberLabels) pass('member labels: agent by role, participant by number/identity');
    else if (/Speaker \d/.test(text)) pass('mix-fallback transcript: diarized Speaker labels');
    else await fail('transcript lines carry neither member labels nor Speaker labels', con);
    // supervisor is coaching: their speech should NOT be in the transcript
    if (!SUPERVISOR_WORDS.test(text)) pass('coach privacy: supervisor speech absent from transcript');
    else await fail('coach audio leaked into the transcript', con);

    // Rendered lines must read in speech order. Each participant has its own
    // STT stream and finals arrive when an utterance ENDS, so appending in
    // arrival order interleaves them wrongly; lines carry speech-START times
    // and the UI insert-sorts on them. The displayed m:ss must be monotonic.
    const readStamps = async () => {
      const t = await con.locator('.rm-scroll').innerText().catch(() => '');
      return (t.match(/\b\d+:\d\d\b/g) ?? []).map((s) => {
        const [m, sec] = s.split(':').map(Number);
        return m * 60 + sec;
      });
    };
    // let enough lines accumulate for the check to mean something (each
    // participant speaks in ~7s turns, so a handful of lines takes a moment)
    let stamps = await readStamps();
    const orderDeadline = Date.now() + 60000;
    while (stamps.length < 5 && Date.now() < orderDeadline) {
      await con.waitForTimeout(3000);
      stamps = await readStamps();
    }
    const firstDrop = stamps.findIndex((v, i) => i > 0 && v < stamps[i - 1]);
    if (stamps.length < 3) await fail(`too few transcript lines (${stamps.length}) to check ordering`, con);
    else if (firstDrop === -1) pass(`transcript in speech order (${stamps.length} lines, timestamps monotonic)`);
    else await fail(`transcript out of order at line ${firstDrop + 1}: ${stamps.slice(0, firstDrop + 2).join(', ')}`, con);
  }

  step('7. Enter Room (barge-in)');
  await con.getByRole('button', { name: 'Enter Room' }).click();
  await visible(con, 'everyone can hear you', 15000);
  pass('entered room');
  // The supervisor is now a full participant, so their speech SHOULD be
  // transcribed — labelled "supervisor". This is the other half of the privacy
  // gate asserted above: nothing while coaching, everything once barged in.
  {
    const enterDeadline = Date.now() + 60000;
    let sawSupervisor = false;
    let text = '';
    while (Date.now() < enterDeadline) {
      text = await con.locator('.rm-scroll').innerText().catch(() => '');
      if (SUPERVISOR_WORDS.test(text)) { sawSupervisor = true; break; }
      await con.waitForTimeout(2000);
    }
    if (!sawSupervisor) await fail('supervisor speech never appeared after Enter Room', con);
    else if (/supervisor/i.test(text)) pass('supervisor speech transcribed after barge-in, labelled "supervisor"');
    else await fail('supervisor speech appeared but is not labelled "supervisor"', con);
  }

  step('8. Leave room → idle');
  await con.getByRole('button', { name: 'Leave room' }).click();
  await visible(con, 'not connected to this room', 15000);
  pass('back to idle');

  step('9. coach gating: agent leaves → Coach disappears');
  await agent.getByRole('button', { name: 'Leave' }).click();
  await visible(con, '0 agents', 15000);
  const coachGone = await con.getByRole('button', { name: 'Coach' }).isVisible().catch(() => false);
  if (!coachGone) pass('Coach button hidden with no agents');
  else await fail('Coach still offered with zero agents', con);

  step('10. transcript OFF + teardown');
  await con.getByRole('button', { name: 'On' }).first().click();
  await visible(con, 'Transcript is off', 10000);
  pass('fork stopped');
  await caller.getByRole('button', { name: 'Leave' }).click();
  await visible(con, 'No active calls', 20000);
  pass('room reaped, rail empty');
} catch (err) {
  await fail(`unhandled: ${err.message}`, con);
  if (con) {
    const txt = await con.locator('body').innerText().catch(() => '');
    console.log('--- console page text ---\n' + txt.slice(0, 800));
  }
} finally {
  // hang up before closing — a closed browser never sends BYE and the
  // platform does not reap the abandoned leg, which pollutes later runs
  for (const [page, btn] of [[con, 'Stop'], [con, 'Leave room'], [agent, 'Leave'], [caller, 'Leave']]) {
    if (page) await page.getByRole('button', { name: btn }).click({ timeout: 2000 }).catch(() => {});
  }
  if (con) await con.waitForTimeout(2000);
  for (const b of browsers) await b.close().catch(() => {});
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
